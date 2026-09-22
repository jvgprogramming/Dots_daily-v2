<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\API\BaseApiController;
use App\Http\Requests\StorePatientRequest;
use App\Http\Requests\UpdatePatientRequest;
use App\Http\Resources\PatientResource;
use App\Http\Resources\UserResource;
use App\Models\Patient;
use App\Models\User;
use App\Services\PatientRegistrationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class PatientController extends BaseApiController
{
    /**
     * Display a paginated, filterable list of patients.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Patient::query()
            ->with(['user', 'registeredBy'])
            ->withCount(['treatmentPlans', 'medicationLogs', 'dailyMonitoring']);

        // Filter by registration status (draft / registered)
        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        // Search by name, email, health ID, or phone
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->whereHas('user', function ($uq) use ($search) {
                    $uq->where('name', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%")
                      ->orWhere('phone', 'like', "%{$search}%");
                })
                ->orWhere('health_id_number', 'like', "%{$search}%")
                ->orWhere('occupation', 'like', "%{$search}%");
            });
        }

        // Filter by gender
        if ($gender = $request->get('gender')) {
            $query->where('gender', $gender);
        }

        // Filter by date range (registered_at)
        if ($dateFrom = $request->get('date_from')) {
            $query->whereDate('registered_at', '>=', $dateFrom);
        }
        if ($dateTo = $request->get('date_to')) {
            $query->whereDate('registered_at', '<=', $dateTo);
        }

        // Sort
        $sortField = $request->get('sort_by', 'created_at');
        $sortDir = $request->get('sort_dir', 'desc');
        $allowedSorts = ['created_at', 'name', 'gender', 'registered_at'];

        if (in_array($sortField, $allowedSorts)) {
            if ($sortField === 'name') {
                $query->join('users', 'patients.user_id', '=', 'users.id')
                    ->orderBy('users.name', $sortDir === 'asc' ? 'asc' : 'desc')
                    ->select('patients.*');
            } else {
                $query->orderBy($sortField, $sortDir === 'asc' ? 'asc' : 'desc');
            }
        }

        $perPage = min((int) $request->get('per_page', 15), 50);
        $patients = $query->paginate($perPage);

        return $this->paginated($patients, 'Patients retrieved successfully.');
    }

    /**
     * Store a newly created patient (user + patient record + TB records).
     * Handles both full registration and "Save as Draft".
     */
    public function store(StorePatientRequest $request, PatientRegistrationService $service): JsonResponse
    {
        $data = $request->validated();
        $isDraft = $request->isDraft();

        try {
            $patient = $service->register($request, $data, $isDraft ? 'draft' : 'registered');

            $patient->load(['user', 'registeredBy']);

            return $this->created(
                data: [
                    'patient' => new PatientResource($patient),
                    'user' => $patient->user ? new UserResource($patient->user) : null,
                ],
                message: $isDraft ? 'Patient draft saved successfully.' : 'Patient registered successfully.',
            );
        } catch (\Exception $e) {
            return $this->error(
                message: 'Failed to register patient. ' . $e->getMessage(),
                code: 500,
            );
        }
    }

    /**
     * Update a draft's saved payload (wizard "Save as Draft" during resume).
     */
    public function updateDraft(Request $request, Patient $patient, PatientRegistrationService $service): JsonResponse
    {
        if ($patient->status !== 'draft') {
            return $this->error(message: 'Patient is not a draft.', code: 422);
        }

        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'first_name' => ['nullable', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'name_extension' => ['nullable', 'string', 'max:20'],
            'date_of_birth' => ['nullable', 'date'],
            'gender' => ['nullable', 'string', 'in:male,female,other'],
            'civil_status' => ['nullable', 'string', 'max:20'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:500'],
            'contact_number' => ['nullable', 'string', 'max:20'],
            'philhealth_number' => ['nullable', 'string', 'max:30'],
            'notification' => ['nullable', 'array'],
            'laboratory_tests' => ['nullable', 'array'],
            'diagnosis' => ['nullable', 'array'],
            'classification' => ['nullable', 'array'],
            'treatment' => ['nullable', 'array'],
            'close_contacts' => ['nullable', 'array'],
        ]);

        $patient = $service->updateDraft($request, $patient);

        return $this->success(
            data: ['patient' => new PatientResource($patient->fresh())],
            message: 'Draft updated successfully.',
        );
    }

    /**
     * Complete a draft patient registration (creates related TB records).
     */
    public function completeDraft(Request $request, Patient $patient, PatientRegistrationService $service): JsonResponse
    {
        if ($patient->status !== 'draft') {
            return $this->error(message: 'Patient is not a draft.', code: 422);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($patient->user_id)],
            'phone' => ['nullable', 'string', 'max:20'],
            'password' => ['nullable', 'string', 'min:8'],

            'last_name' => ['required', 'string', 'max:255'],
            'first_name' => ['required', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'name_extension' => ['nullable', 'string', 'max:20'],
            'date_of_birth' => ['required', 'date'],
            'gender' => ['required', 'string', 'in:male,female,other'],
            'civil_status' => ['nullable', 'string', 'max:20'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'address' => ['required', 'string', 'max:500'],
            'contact_number' => ['nullable', 'string', 'max:20'],
            'philhealth_number' => ['nullable', 'string', 'max:30'],

            'notification' => ['required', 'array'],
            'notification.reason' => ['required', 'string', 'in:new,update,final_outcome'],
            'notification.facility_name' => ['nullable', 'string', 'max:255'],
            'notification.ntp_facility_code' => ['nullable', 'string', 'max:50'],
            'notification.province_huc' => ['nullable', 'string', 'max:255'],
            'notification.region' => ['nullable', 'string', 'max:255'],

            'laboratory_tests' => ['nullable', 'array'],
            'laboratory_tests.*.test_type' => ['required_with:laboratory_tests', 'string', 'max:50'],
            'laboratory_tests.*.test_name' => ['nullable', 'string', 'max:255'],
            'laboratory_tests.*.test_date' => ['nullable', 'date'],
            'laboratory_tests.*.result' => ['nullable', 'string', 'max:255'],
            'laboratory_tests.*.status' => ['nullable', 'string', 'in:done,not_available,not_yet_done'],
            'laboratory_tests.*.remarks' => ['nullable', 'string', 'max:500'],

            'diagnosis' => ['required', 'array'],
            'diagnosis.diagnosis_type' => ['required', 'string', 'in:tb_disease,tb_infection'],
            'diagnosis.diagnosis_date' => ['required', 'date'],
            'diagnosis.notification_date' => ['nullable', 'date'],
            'diagnosis.case_number' => ['nullable', 'string', 'max:50'],
            'diagnosis.attending_physician' => ['nullable', 'string', 'max:255'],
            'diagnosis.referral_name' => ['nullable', 'string', 'max:255'],
            'diagnosis.referral_address' => ['nullable', 'string', 'max:500'],
            'diagnosis.referral_facility_code' => ['nullable', 'string', 'max:50'],
            'diagnosis.referral_province_huc' => ['nullable', 'string', 'max:255'],
            'diagnosis.referral_region' => ['nullable', 'string', 'max:255'],

            'classification' => ['required', 'array'],
            'classification.bacteriological_status' => ['required', 'string', 'in:bacteriologically_confirmed,clinically_diagnosed'],
            'classification.anatomical_site' => ['required', 'string', 'in:pulmonary,extrapulmonary'],
            'classification.extrapulmonary_site' => ['required_if:classification.anatomical_site,extrapulmonary', 'nullable', 'string', 'max:255'],
            'classification.drug_resistance_status' => ['required', 'string', 'in:drug_susceptible,bc_rr_tb,bc_mdr_tb,bc_xdr_tb,cd_mdr_tb,other_dr_resistant'],
            'classification.registration_group' => ['required', 'string', 'in:new,relapse,taf,tpt,talf,unknown_history'],

            'treatment' => ['required', 'array'],
            'treatment.start_date' => ['required', 'date'],
            'treatment.regimen_type' => ['required', 'string', 'max:50'],
            'treatment.notes' => ['nullable', 'string', 'max:1000'],

            'close_contacts' => ['nullable', 'array'],
            'close_contacts.*.full_name' => ['required_with:close_contacts', 'string', 'max:255'],
            'close_contacts.*.age' => ['nullable', 'integer', 'min:0', 'max:150'],
            'close_contacts.*.sex' => ['nullable', 'string', 'in:male,female'],
            'close_contacts.*.relationship' => ['nullable', 'string', 'max:100'],
            'close_contacts.*.screening_date' => ['nullable', 'date'],
            'close_contacts.*.followup_date' => ['nullable', 'date'],
            'close_contacts.*.remarks' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $patient = $service->completeDraft($request, $patient, $data);

            $patient->load(['user', 'registeredBy']);

            return $this->success(
                data: [
                    'patient' => new PatientResource($patient),
                    'user' => $patient->user ? new UserResource($patient->user) : null,
                ],
                message: 'Patient registration completed successfully.',
            );
        } catch (\Exception $e) {
            return $this->error(
                message: 'Failed to complete registration. ' . $e->getMessage(),
                code: 500,
            );
        }
    }

    /**
     * Display the specified patient with full details.
     */
    public function show(Patient $patient): JsonResponse
    {
        $patient->load([
            'user',
            'registeredBy',
            'tbNotifications',
            'laboratoryTests',
            'diagnoses',
            'tbClassification',
            'closeContacts',
            'treatmentPlans' => fn ($q) => $q->with('medications')->latest(),
            'dailyMonitoring' => fn ($q) => $q->latest()->limit(10),
            'medicationLogs' => fn ($q) => $q->latest()->limit(10),
            'symptomLogs' => fn ($q) => $q->latest()->limit(10),
        ]);

        // Include counts
        $patient->loadCount([
            'treatmentPlans as active_treatments_count' => fn ($q) => $q->where('status', 'active'),
            'medicationLogs as total_medication_logs',
            'dailyMonitoring as total_monitoring_sessions',
        ]);

        return $this->success(
            data: [
                'patient' => new PatientResource($patient),
                'user' => $patient->user ? new UserResource($patient->user) : null,
                'stats' => [
                    'active_treatments' => (int) $patient->active_treatments_count,
                    'total_medication_logs' => (int) $patient->total_medication_logs,
                    'total_monitoring_sessions' => (int) $patient->total_monitoring_sessions,
                ],
                'recent_activity' => [
                    'treatment_plans' => $patient->treatmentPlans,
                    'daily_monitoring' => $patient->dailyMonitoring,
                    'medication_logs' => $patient->medicationLogs,
                    'symptom_logs' => $patient->symptomLogs,
                ],
            ],
            message: 'Patient retrieved successfully.',
        );
    }

    /**
     * Update the specified patient.
     */
    public function update(UpdatePatientRequest $request, Patient $patient): JsonResponse
    {
        $data = $request->validated();

        try {
            DB::beginTransaction();

            // Update user fields (draft patients may not have an account)
            $userData = array_filter([
                'name' => $data['name'] ?? null,
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? null,
            ], fn ($v) => $v !== null);

            if (!empty($userData) && $patient->user) {
                $patient->user->update($userData);
            }

            // Update password if provided
            if (!empty($data['password']) && $patient->user) {
                $patient->user->update([
                    'password' => Hash::make($data['password']),
                ]);
            }

            // Update patient fields
            $patientData = array_filter([
                'last_name' => $data['last_name'] ?? null,
                'first_name' => $data['first_name'] ?? null,
                'middle_name' => $data['middle_name'] ?? null,
                'name_extension' => $data['name_extension'] ?? null,
                'date_of_birth' => $data['date_of_birth'] ?? null,
                'gender' => $data['gender'] ?? null,
                'civil_status' => $data['civil_status'] ?? null,
                'weight_kg' => $data['weight_kg'] ?? null,
                'address' => $data['address'] ?? null,
                'emergency_contact_name' => $data['emergency_contact_name'] ?? null,
                'emergency_contact_phone' => $data['emergency_contact_phone'] ?? null,
                'occupation' => $data['occupation'] ?? null,
                'nationality' => $data['nationality'] ?? null,
                'health_id_number' => $data['health_id_number'] ?? null,
                'philhealth_number' => $data['philhealth_number'] ?? null,
                'referred_by' => $data['referred_by'] ?? null,
            ], fn ($v) => $v !== null);

            if (!empty($patientData)) {
                $patient->update($patientData);
            }

            DB::commit();

            $patient = $patient->fresh()->load(['user', 'registeredBy']);

            return $this->success(
                data: [
                    'patient' => new PatientResource($patient),
                    'user' => $patient->user ? new UserResource($patient->user) : null,
                ],
                message: 'Patient updated successfully.',
            );
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error(
                message: 'Failed to update patient. ' . $e->getMessage(),
                code: 500,
            );
        }
    }

    /**
     * Remove the specified patient (soft delete).
     */
    public function destroy(Patient $patient): JsonResponse
    {
        // Draft patients may not have a linked user account
        if ($patient->user) {
            $patient->user->delete(); // Soft delete user (cascades to patient)
        }
        $patient->delete();       // Soft delete patient

        return $this->success(message: 'Patient deleted successfully.');
    }

    /**
     * Get patient profile for the authenticated user.
     */
    public function profile(Request $request): JsonResponse
    {
        $user = $request->user()->load('patient');

        if (!$user->patient) {
            return $this->error(message: 'Patient profile not found.', code: 404);
        }

        $user->patient->loadCount([
            'treatmentPlans as active_treatments_count' => fn ($q) => $q->where('status', 'active'),
            'medicationLogs as total_medication_logs',
            'dailyMonitoring as total_monitoring_sessions',
        ]);

        return $this->success(
            data: [
                'user' => new UserResource($user),
                'patient' => new PatientResource($user->patient),
                'stats' => [
                    'active_treatments' => (int) $user->patient->active_treatments_count,
                    'total_medication_logs' => (int) $user->patient->total_medication_logs,
                    'total_monitoring_sessions' => (int) $user->patient->total_monitoring_sessions,
                ],
            ],
            message: 'Profile retrieved successfully.',
        );
    }

    /**
     * Get patients list for dropdown/select (lightweight, no pagination).
     */
    public function list(Request $request): JsonResponse
    {
        $query = Patient::query()->with('user');

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->whereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$search}%"))
                  ->orWhere('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%");
            });
        }

        // Inner join would silently drop draft patients (no user account)
        $patients = $query->leftJoin('users', 'patients.user_id', '=', 'users.id')
            ->orderByRaw('COALESCE(NULLIF(TRIM(CONCAT_WS(" ", patients.first_name, patients.last_name)), ""), users.name) ASC')
            ->select('patients.*')
            ->limit(50)
            ->get();

        return $this->success(
            data: $patients->map(fn ($p) => [
                'id' => $p->id,
                'name' => trim(($p->first_name ?? '') . ' ' . ($p->last_name ?? '')) ?: ($p->user?->name ?? 'Unnamed patient'),
                'email' => $p->user?->email,
                'health_id_number' => $p->health_id_number,
                'status' => $p->status ?? 'registered',
            ]),
            message: 'Patient list retrieved successfully.',
        );
    }
}
