<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\API\BaseApiController;
use App\Http\Requests\StorePatientRequest;
use App\Http\Requests\UpdatePatientRequest;
use App\Http\Resources\PatientResource;
use App\Http\Resources\UserResource;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

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
     * Store a newly created patient (user + patient record).
     */
    public function store(StorePatientRequest $request): JsonResponse
    {
        $data = $request->validated();

        try {
            DB::beginTransaction();

            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'password' => Hash::make($data['password']),
                'role' => 'patient',
                'is_active' => true,
            ]);

            $patient = Patient::create([
                'user_id' => $user->id,
                'date_of_birth' => $data['date_of_birth'] ?? null,
                'gender' => $data['gender'] ?? null,
                'address' => $data['address'] ?? null,
                'emergency_contact_name' => $data['emergency_contact_name'] ?? null,
                'emergency_contact_phone' => $data['emergency_contact_phone'] ?? null,
                'occupation' => $data['occupation'] ?? null,
                'nationality' => $data['nationality'] ?? null,
                'health_id_number' => $data['health_id_number'] ?? null,
                'referred_by' => $data['referred_by'] ?? null,
                'registered_by' => $request->user()->id,
                'registered_at' => now(),
            ]);

            DB::commit();

            $patient->load(['user', 'registeredBy']);

            return $this->created(
                data: [
                    'patient' => new PatientResource($patient),
                    'user' => new UserResource($user),
                ],
                message: 'Patient registered successfully.',
            );
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error(
                message: 'Failed to register patient. ' . $e->getMessage(),
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
                'user' => new UserResource($patient->user),
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

            // Update user fields
            $userData = array_filter([
                'name' => $data['name'] ?? null,
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? null,
            ], fn ($v) => $v !== null);

            if (!empty($userData)) {
                $patient->user->update($userData);
            }

            // Update password if provided
            if (!empty($data['password'])) {
                $patient->user->update([
                    'password' => Hash::make($data['password']),
                ]);
            }

            // Update patient fields
            $patientData = array_filter([
                'date_of_birth' => $data['date_of_birth'] ?? null,
                'gender' => $data['gender'] ?? null,
                'address' => $data['address'] ?? null,
                'emergency_contact_name' => $data['emergency_contact_name'] ?? null,
                'emergency_contact_phone' => $data['emergency_contact_phone'] ?? null,
                'occupation' => $data['occupation'] ?? null,
                'nationality' => $data['nationality'] ?? null,
                'health_id_number' => $data['health_id_number'] ?? null,
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
                    'user' => new UserResource($patient->user),
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
        $patient->user->delete(); // Soft delete user (cascades to patient)
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
            $query->whereHas('user', fn ($q) => $q->where('name', 'like', "%{$search}%"));
        }

        $patients = $query->join('users', 'patients.user_id', '=', 'users.id')
            ->orderBy('users.name', 'asc')
            ->select('patients.*')
            ->limit(50)
            ->get();

        return $this->success(
            data: $patients->map(fn ($p) => [
                'id' => $p->id,
                'name' => $p->user->name,
                'email' => $p->user->email,
                'health_id_number' => $p->health_id_number,
            ]),
            message: 'Patient list retrieved successfully.',
        );
    }
}
