<?php

namespace App\Services;

use App\Models\Patient;
use App\Models\TreatmentPlan;
use App\Models\User;
use App\Services\Medication\RegimenPrescriber;
use App\Support\AppSettings;
use App\Support\Audit;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class PatientRegistrationService
{
    public function __construct(private RegimenPrescriber $prescriber) {}

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

            // ── User account ──
            // A finished registration always gets one; a draft only when a
            // password was given (otherwise it waits for completion). With no
            // password the account gets a random one nobody knows: the patient
            // activates it from the app with an emailed code and picks their own.
            $user = null;
            if (!empty($data['email']) && (!$isDraft || !empty($data['password']))) {
                $user = User::create([
                    'name' => trim(($data['first_name'] ?? '') . ' ' . ($data['last_name'] ?? '')) ?: ($data['name'] ?? 'Patient'),
                    'email' => $data['email'],
                    'phone' => $data['phone'] ?? $data['contact_number'] ?? null,
                    'password' => Hash::make($data['password'] ?? \Illuminate\Support\Str::password(32)),
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
        if (!empty($data['notification'])) {
            $patient->tbNotifications()->create(self::notificationAttributes($data['notification']));
        }

        foreach ($data['laboratory_tests'] ?? [] as $test) {
            $patient->laboratoryTests()->create(self::labTestAttributes($test));
        }

        if (!empty($data['diagnosis'])) {
            $patient->diagnoses()->create(self::diagnosisAttributes($data['diagnosis']));
        }

        if (!empty($data['classification'])) {
            $patient->tbClassification()->create(self::classificationAttributes($data['classification']));
        }

        // ── Treatment plan (start info only; outcome fields filled later) ──
        if (!empty($data['treatment']['start_date'])) {
            $this->createTreatmentPlan($patient, $data, $assignedBy);
        }

        foreach ($data['close_contacts'] ?? [] as $contact) {
            $patient->closeContacts()->create(self::contactAttributes($contact));
        }
    }

    /**
     * Correct a registered patient's official record in place.
     *
     * The single-record sections (notification, diagnosis, classification,
     * treatment) update the record registration created — the oldest one.
     * Lab tests and close contacts are synced by id: entries with an id are
     * updated, new entries are added, and entries left out are removed.
     * The treatment plan keeps its id, so dose logs and medications stay
     * attached; only its start date, starting regimen and notes change.
     *
     * @return array<string, mixed> What changed, per section, for the audit trail.
     */
    public function correctRegistration(Request $request, Patient $patient, array $data): array
    {
        return DB::transaction(function () use ($request, $patient, $data) {
            $changes = [];

            $sections = [
                'notification' => [$patient->tbNotifications(), self::notificationAttributes($data['notification'])],
                'diagnosis' => [$patient->diagnoses(), self::diagnosisAttributes($data['diagnosis'])],
                'classification' => [$patient->tbClassification(), self::classificationAttributes($data['classification'])],
            ];
            foreach ($sections as $name => [$relation, $attributes]) {
                $record = $relation->oldest('id')->first();
                if ($record) {
                    $record->update($attributes);
                    if ($diff = Audit::diff($record)['changes'] ?? []) {
                        $changes[$name] = $diff;
                    }
                } else {
                    $relation->create($attributes);
                    $changes[$name] = 'added';
                }
            }

            // ── Treatment plan: the one registration created ──
            $plan = $patient->treatmentPlans()->oldest('id')->first();
            if ($plan) {
                $plan->fill([
                    'start_date' => $data['treatment']['start_date'],
                    'regimen_type' => $data['treatment']['regimen_type'],
                    'notes' => $data['treatment']['notes'] ?? null,
                ]);
                // A new start date or regimen moves the expected end date with it.
                if ($plan->isDirty(['start_date', 'regimen_type'])) {
                    $plan->expected_end_date = self::expectedEndDate($data['treatment']['start_date'], $data['treatment']['regimen_type'])->toDateString();
                }
                $plan->save();
                if ($diff = Audit::diff($plan)['changes'] ?? []) {
                    $changes['treatment'] = $diff;
                }
                // Plans registered before medicines were auto-prescribed have
                // none; give them their regimen's now. No-op when it has some.
                if ($added = $this->prescriber->prescribe($plan)) {
                    $changes['treatment_medications'] = "added {$added}";
                }
            } else {
                $this->createTreatmentPlan($patient, $data, $request->user()->id);
                $changes['treatment'] = 'added';
            }

            if ($list = $this->syncList($patient->laboratoryTests(), $data['laboratory_tests'] ?? [], self::labTestAttributes(...))) {
                $changes['laboratory_tests'] = $list;
            }
            if ($list = $this->syncList($patient->closeContacts(), $data['close_contacts'] ?? [], self::contactAttributes(...))) {
                $changes['close_contacts'] = $list;
            }

            return $changes;
        });
    }

    /**
     * Make a patient's list of records match the submitted entries: update
     * those with a known id, add the rest, remove the ones no longer listed.
     * An id that is not one of this patient's records is treated as new.
     *
     * @return array{added?: int, updated?: int, removed?: int}
     */
    private function syncList(HasMany $relation, array $entries, callable $attributes): array
    {
        $existing = $relation->get()->keyBy('id');
        $kept = [];
        $counts = ['added' => 0, 'updated' => 0, 'removed' => 0];

        foreach ($entries as $entry) {
            $record = isset($entry['id']) ? $existing->get((int) $entry['id']) : null;
            if ($record) {
                $record->update($attributes($entry));
                $kept[] = $record->id;
                if ($record->wasChanged()) {
                    $counts['updated']++;
                }
            } else {
                $relation->create($attributes($entry));
                $counts['added']++;
            }
        }

        foreach ($existing->except($kept) as $record) {
            $record->delete();
            $counts['removed']++;
        }

        return array_filter($counts);
    }

    private function createTreatmentPlan(Patient $patient, array $data, ?int $assignedBy): TreatmentPlan
    {
        $regimen = AppSettings::regimen($data['treatment']['regimen_type'] ?? null);
        $intensiveDays = (int) ($regimen['intensive_days'] ?? 0);
        $courseDays = $intensiveDays + (int) ($regimen['continuation_days'] ?? 0);

        $plan = TreatmentPlan::create([
            'patient_id' => $patient->id,
            'assigned_by' => $assignedBy ?? $patient->registered_by,
            'plan_name' => 'TB Treatment — ' . ($data['classification']['registration_group'] ?? 'new'),
            'regimen_type' => $data['treatment']['regimen_type'] ?? null,
            // A regimen with no intensive phase (e.g. TB infection) starts in continuation.
            'phase' => ($regimen && $intensiveDays === 0 && $courseDays > 0) ? 'continuation' : 'intensive',
            'start_date' => Carbon::parse($data['treatment']['start_date'])->toDateString(),
            'expected_end_date' => self::expectedEndDate($data['treatment']['start_date'], $data['treatment']['regimen_type'] ?? null)->toDateString(),
            'status' => 'active',
            'draft_reason' => null,
            'notes' => $data['treatment']['notes'] ?? null,
        ]);

        // Doses are logged against a prescribed medicine — without these the
        // patient's app reports "no active treatment regimen".
        $this->prescriber->prescribe($plan);

        return $plan;
    }

    /**
     * Course length comes from Settings → Treatment protocols for the chosen
     * regimen; unknown/individualized regimens keep the standard 6 months.
     */
    private static function expectedEndDate(string $startDate, ?string $regimenType): Carbon
    {
        $start = Carbon::parse($startDate);
        $regimen = AppSettings::regimen($regimenType);
        $courseDays = (int) ($regimen['intensive_days'] ?? 0) + (int) ($regimen['continuation_days'] ?? 0);

        return $courseDays > 0 ? $start->copy()->addDays($courseDays) : $start->copy()->addMonths(6);
    }

    private static function notificationAttributes(array $n): array
    {
        return [
            'reason' => $n['reason'] ?? 'new',
            'facility_name' => $n['facility_name'] ?? null,
            'ntp_facility_code' => $n['ntp_facility_code'] ?? null,
            'province_huc' => $n['province_huc'] ?? null,
            'region' => $n['region'] ?? null,
        ];
    }

    private static function labTestAttributes(array $test): array
    {
        return [
            'test_type' => $test['test_type'],
            'test_name' => $test['test_name'] ?? null,
            'test_date' => $test['test_date'] ?? null,
            'result' => $test['result'] ?? null,
            'status' => $test['status'] ?? 'done',
            'remarks' => $test['remarks'] ?? null,
        ];
    }

    private static function diagnosisAttributes(array $d): array
    {
        return [
            'diagnosis_type' => $d['diagnosis_type'],
            'diagnosis_date' => $d['diagnosis_date'] ?? null,
            'notification_date' => $d['notification_date'] ?? null,
            'case_number' => $d['case_number'] ?? null,
            'attending_physician' => $d['attending_physician'] ?? null,
            'referral_name' => $d['referral_name'] ?? null,
            'referral_address' => $d['referral_address'] ?? null,
            'referral_facility_code' => $d['referral_facility_code'] ?? null,
            'referral_province_huc' => $d['referral_province_huc'] ?? null,
            'referral_region' => $d['referral_region'] ?? null,
        ];
    }

    private static function classificationAttributes(array $c): array
    {
        return [
            'bacteriological_status' => $c['bacteriological_status'] ?? null,
            'anatomical_site' => $c['anatomical_site'] ?? null,
            // Only extra-pulmonary TB has a site; switching to pulmonary clears it.
            'extrapulmonary_site' => ($c['anatomical_site'] ?? null) === 'extrapulmonary' ? ($c['extrapulmonary_site'] ?? null) : null,
            'drug_resistance_status' => $c['drug_resistance_status'] ?? null,
            'registration_group' => $c['registration_group'] ?? null,
        ];
    }

    private static function contactAttributes(array $contact): array
    {
        return [
            'full_name' => $contact['full_name'],
            'age' => $contact['age'] ?? null,
            'sex' => $contact['sex'] ?? null,
            'relationship' => $contact['relationship'] ?? null,
            'screening_date' => $contact['screening_date'] ?? null,
            'followup_date' => $contact['followup_date'] ?? null,
            'remarks' => $contact['remarks'] ?? null,
        ];
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
