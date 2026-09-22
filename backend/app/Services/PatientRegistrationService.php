<?php

namespace App\Services;

use App\Models\Patient;
use App\Models\TreatmentPlan;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class PatientRegistrationService
{
    /**
     * Create a patient account + patient record + all TB registration records
     * (notification, lab tests, diagnosis, classification, treatment plan,
     * close contacts) in a single transaction.
     *
     * $status is 'registered' for final registration, 'draft' for Save as Draft.
     */
    public function register(Request $request, array $data, string $status = 'registered'): Patient
    {
        return DB::transaction(function () use ($request, $data, $status) {
            $isDraft = $status === 'draft';

            // ── User account — only created when real credentials were provided ──
            // (drafts without a password defer account creation to completion)
            $user = null;
            if (!empty($data['email']) && !empty($data['password'])) {
                $user = User::create([
                    'name' => trim(($data['first_name'] ?? '') . ' ' . ($data['last_name'] ?? '')) ?: ($data['name'] ?? 'Patient'),
                    'email' => $data['email'],
                    'phone' => $data['phone'] ?? $data['contact_number'] ?? null,
                    'password' => Hash::make($data['password']),
                    'role' => 'patient',
                    'is_active' => true,
                ]);
            }

            // ── Patient record ──
            $patient = Patient::create([
                'user_id' => $user?->id,
                'last_name' => $data['last_name'] ?? null,
                'first_name' => $data['first_name'] ?? null,
                'middle_name' => $data['middle_name'] ?? null,
                'name_extension' => $data['name_extension'] ?? null,
                'date_of_birth' => $data['date_of_birth'] ?? null,
                'gender' => $data['gender'] ?? null,
                'civil_status' => $data['civil_status'] ?? null,
                'weight_kg' => $data['weight_kg'] ?? null,
                'nationality' => $data['nationality'] ?? null,
                'address' => $data['address'] ?? null,
                'philhealth_number' => $data['philhealth_number'] ?? null,
                'health_id_number' => $data['health_id_number'] ?? null,
                'referred_by' => $data['referred_by'] ?? null,
                'registered_by' => $request->user()->id,
                'registered_at' => now(),
                'status' => $status,
                // Drafts keep the full wizard payload so the form can be resumed exactly as left
                'draft_data' => $isDraft ? $this->draftPayload($request) : null,
            ]);

            // ── Related TB records (only for finalized registrations) ──
            if (!$isDraft) {
                $this->createRelatedRecords($patient, $data, $request->user()->id);
            }

            return $patient;
        });
    }

    /**
     * Complete a draft: update the patient, create the login account if it
     * wasn't created at draft time, and create all related TB records.
     */
    public function completeDraft(Request $request, Patient $patient, array $data): Patient
    {
        return DB::transaction(function () use ($request, $patient, $data) {
            // ── Login account (create if missing, update if present) ──
            if ($patient->user) {
                $patient->user->update([
                    'name' => trim(($data['first_name'] ?? '') . ' ' . ($data['last_name'] ?? '')) ?: $patient->user->name,
                    'email' => $data['email'] ?? $patient->user->email,
                ]);
                if (!empty($data['password'])) {
                    $patient->user->update(['password' => Hash::make($data['password'])]);
                }
            } elseif (!empty($data['email'])) {
                // No account yet — create one now. Password: provided or securely generated.
                $user = User::create([
                    'name' => trim(($data['first_name'] ?? '') . ' ' . ($data['last_name'] ?? '')) ?: ($data['name'] ?? 'Patient'),
                    'email' => $data['email'],
                    'phone' => $data['phone'] ?? $data['contact_number'] ?? null,
                    'password' => Hash::make($data['password'] ?? \Illuminate\Support\Str::password(14)),
                    'role' => 'patient',
                    'is_active' => true,
                ]);
                $patient->user_id = $user->id;
                $patient->save();
            }

            // ── Patient record ──
            $patient->update([
                'last_name' => $data['last_name'] ?? $patient->last_name,
                'first_name' => $data['first_name'] ?? $patient->first_name,
                'middle_name' => $data['middle_name'] ?? $patient->middle_name,
                'name_extension' => $data['name_extension'] ?? $patient->name_extension,
                'date_of_birth' => $data['date_of_birth'] ?? $patient->date_of_birth,
                'gender' => $data['gender'] ?? $patient->gender,
                'civil_status' => $data['civil_status'] ?? $patient->civil_status,
                'weight_kg' => $data['weight_kg'] ?? $patient->weight_kg,
                'nationality' => $data['nationality'] ?? $patient->nationality,
                'address' => $data['address'] ?? $patient->address,
                'philhealth_number' => $data['philhealth_number'] ?? $patient->philhealth_number,
                'health_id_number' => $data['health_id_number'] ?? $patient->health_id_number,
                'referred_by' => $data['referred_by'] ?? $patient->referred_by,
                'registered_at' => $patient->registered_at ?? now(),
                'status' => 'registered',
                'draft_data' => null,
            ]);

            // ── Related TB records ──
            $this->createRelatedRecords($patient, $data, $request->user()->id);

            return $patient;
        });
    }

    /**
     * Update an existing draft's saved payload without finalizing it.
     */
    public function updateDraft(Request $request, Patient $patient): Patient
    {
        $patient->update([
            'last_name' => $request->input('last_name') ?: $patient->last_name,
            'first_name' => $request->input('first_name') ?: $patient->first_name,
            'middle_name' => $request->input('middle_name') ?: $patient->middle_name,
            'name_extension' => $request->input('name_extension') ?: $patient->name_extension,
            'date_of_birth' => $request->input('date_of_birth') ?: $patient->date_of_birth,
            'gender' => $request->input('gender') ?: $patient->gender,
            'weight_kg' => $request->filled('weight_kg') ? $request->input('weight_kg') : $patient->weight_kg,
            'civil_status' => $request->input('civil_status') ?: $patient->civil_status,
            'nationality' => $request->input('nationality') ?: $patient->nationality,
            'address' => $request->input('address') ?: $patient->address,
            'philhealth_number' => $request->input('philhealth_number') ?: $patient->philhealth_number,
            'status' => 'draft',
            'draft_data' => $this->draftPayload($request),
        ]);

        return $patient;
    }

    /**
     * Create notification, lab tests, diagnosis, classification, treatment
     * plan, and close contacts for a patient.
     */
    private function createRelatedRecords(Patient $patient, array $data, ?int $assignedBy = null): void
    {
        // ── TB Notification ──
        if (!empty($data['notification'])) {
            $patient->tbNotifications()->create([
                'reason' => $data['notification']['reason'] ?? 'new',
                'facility_name' => $data['notification']['facility_name'] ?? null,
                'ntp_facility_code' => $data['notification']['ntp_facility_code'] ?? null,
                'province_huc' => $data['notification']['province_huc'] ?? null,
                'region' => $data['notification']['region'] ?? null,
            ]);
        }

        // ── Laboratory tests ──
        foreach ($data['laboratory_tests'] ?? [] as $test) {
            $patient->laboratoryTests()->create([
                'test_type' => $test['test_type'],
                'test_name' => $test['test_name'] ?? null,
                'test_date' => $test['test_date'] ?? null,
                'result' => $test['result'] ?? null,
                'status' => $test['status'] ?? 'done',
                'remarks' => $test['remarks'] ?? null,
            ]);
        }

        // ── Diagnosis ──
        if (!empty($data['diagnosis'])) {
            $patient->diagnoses()->create([
                'diagnosis_type' => $data['diagnosis']['diagnosis_type'],
                'diagnosis_date' => $data['diagnosis']['diagnosis_date'] ?? null,
                'notification_date' => $data['diagnosis']['notification_date'] ?? null,
                'case_number' => $data['diagnosis']['case_number'] ?? null,
                'attending_physician' => $data['diagnosis']['attending_physician'] ?? null,
                'referral_name' => $data['diagnosis']['referral_name'] ?? null,
                'referral_address' => $data['diagnosis']['referral_address'] ?? null,
                'referral_facility_code' => $data['diagnosis']['referral_facility_code'] ?? null,
                'referral_province_huc' => $data['diagnosis']['referral_province_huc'] ?? null,
                'referral_region' => $data['diagnosis']['referral_region'] ?? null,
            ]);
        }

        // ── TB Classification ──
        if (!empty($data['classification'])) {
            $patient->tbClassification()->create([
                'bacteriological_status' => $data['classification']['bacteriological_status'] ?? null,
                'anatomical_site' => $data['classification']['anatomical_site'] ?? null,
                'extrapulmonary_site' => $data['classification']['extrapulmonary_site'] ?? null,
                'drug_resistance_status' => $data['classification']['drug_resistance_status'] ?? null,
                'registration_group' => $data['classification']['registration_group'] ?? null,
            ]);
        }

        // ── Treatment plan (start info only; outcome fields filled later) ──
        if (!empty($data['treatment']['start_date'])) {
            $startDate = \Carbon\Carbon::parse($data['treatment']['start_date']);
            $expectedEnd = $startDate->copy()->addMonths(6); // standard 6-month course default

            TreatmentPlan::create([
                'patient_id' => $patient->id,
                'assigned_by' => $assignedBy ?? $patient->registered_by,
                'plan_name' => 'TB Treatment — ' . ($data['classification']['registration_group'] ?? 'new'),
                'regimen_type' => $data['treatment']['regimen_type'] ?? null,
                'phase' => 'intensive',
                'start_date' => $startDate->toDateString(),
                'expected_end_date' => $expectedEnd->toDateString(),
                'status' => 'active',
                'draft_reason' => null,
                'notes' => $data['treatment']['notes'] ?? null,
            ]);
        }

        // ── Close contacts ──
        foreach ($data['close_contacts'] ?? [] as $contact) {
            $patient->closeContacts()->create([
                'full_name' => $contact['full_name'],
                'age' => $contact['age'] ?? null,
                'sex' => $contact['sex'] ?? null,
                'relationship' => $contact['relationship'] ?? null,
                'screening_date' => $contact['screening_date'] ?? null,
                'followup_date' => $contact['followup_date'] ?? null,
                'remarks' => $contact['remarks'] ?? null,
            ]);
        }
    }

    /**
     * Full wizard payload preserved for draft resume.
     * Kept top-level so the wizard can spread it back into its form state.
     * Account credentials are excluded (never store passwords in draft_data).
     */
    private function draftPayload(Request $request): array
    {
        return [
            'status' => 'draft',
            'name' => $request->input('name', ''),
            'email' => $request->input('email', ''),
            'phone' => $request->input('phone', ''),
            'last_name' => $request->input('last_name', ''),
            'first_name' => $request->input('first_name', ''),
            'middle_name' => $request->input('middle_name', ''),
            'name_extension' => $request->input('name_extension', ''),
            'date_of_birth' => $request->input('date_of_birth', ''),
            'gender' => $request->input('gender', ''),
            'civil_status' => $request->input('civil_status', ''),
            'weight_kg' => $request->input('weight_kg', ''),
            'nationality' => $request->input('nationality', ''),
            'address' => $request->input('address', ''),
            'contact_number' => $request->input('contact_number', ''),
            'philhealth_number' => $request->input('philhealth_number', ''),
            'notification' => $request->input('notification', []),
            'laboratory_tests' => $request->input('laboratory_tests', []),
            'diagnosis' => $request->input('diagnosis', []),
            'classification' => $request->input('classification', []),
            'treatment' => $request->input('treatment', []),
            'close_contacts' => $request->input('close_contacts', []),
        ];
    }
}
