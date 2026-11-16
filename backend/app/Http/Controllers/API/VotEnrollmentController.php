<?php

namespace App\Http\Controllers\API;

use App\Http\Requests\UpdateVotEnrollmentRequest;
use App\Http\Resources\VotEnrollmentResource;
use App\Models\Patient;
use App\Models\User;
use App\Services\Vot\VotService;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** Portal: a patient's video-observed therapy eligibility. */
class VotEnrollmentController extends BaseApiController
{
    public function __construct(private readonly VotService $vot) {}

    /** GET /patients/{patient}/vot-enrollment — null data when never enrolled. */
    public function show(Patient $patient): JsonResponse
    {
        Gate::authorize('manageVot', $patient);

        $enrollment = $patient->votEnrollment?->load(['assignedNurse', 'grantedBy', 'statusChangedBy']);

        return $this->success(
            data: $enrollment ? (new VotEnrollmentResource($enrollment))->resolve() : null,
            message: $enrollment ? 'VOT eligibility retrieved.' : 'This patient has not been assessed for VOT.',
        );
    }

    /** PUT /patients/{patient}/vot-enrollment */
    public function update(UpdateVotEnrollmentRequest $request, Patient $patient): JsonResponse
    {
        ['enrollment' => $enrollment, 'previous_status' => $previous] = $this->vot->updateEnrollment(
            $patient,
            $request->validated(),
            $request->user(),
        );

        Audit::log(
            $request,
            $previous === null ? 'vot.enrollment.created' : 'vot.enrollment.updated',
            ($previous === $enrollment->status ? 'Updated' : "Set {$enrollment->status}")." VOT eligibility for patient #{$patient->id}",
            $enrollment,
            array_filter([
                'from' => $previous,
                'to' => $enrollment->status,
                'reason' => $enrollment->status_reason,
                'assigned_nurse_id' => $enrollment->assigned_nurse_id,
            ], fn ($v) => $v !== null),
        );

        return $this->success(
            data: (new VotEnrollmentResource($enrollment->load(['assignedNurse', 'grantedBy', 'statusChangedBy'])))->resolve(),
            message: 'VOT eligibility saved.',
        );
    }

    /** GET /vot/nurses — who a VOT patient can be assigned to. */
    public function nurses(Request $request): JsonResponse
    {
        $users = User::query()
            ->whereIn('role', User::PORTAL_ROLES)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'role']);

        return $this->success(data: $users->map(fn (User $u) => [
            'id' => $u->id,
            'name' => $u->name,
            'role' => $u->role,
        ])->values());
    }
}
