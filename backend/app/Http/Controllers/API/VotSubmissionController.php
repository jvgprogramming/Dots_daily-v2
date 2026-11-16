<?php

namespace App\Http\Controllers\API;

use App\Http\Requests\ReviewVotSubmissionRequest;
use App\Http\Resources\VotSubmissionResource;
use App\Models\Patient;
use App\Models\VotSubmission;
use App\Services\Vot\VotService;
use App\Support\Audit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** Portal: the Reports → Video-Observed Therapy review queue. */
class VotSubmissionController extends BaseApiController
{
    private const RELATIONS = [
        'patient.user',
        'patient.votEnrollment.assignedNurse',
        'treatmentPlan',
        'medicationLog.treatmentPlanMedication.medication',
        'reviewedBy',
    ];

    public function __construct(private readonly VotService $vot) {}

    /** GET /vot/summary — the overview cards. */
    public function summary(): JsonResponse
    {
        Gate::authorize('viewAny', VotSubmission::class);

        return $this->success(data: $this->vot->summary());
    }

    /** GET /vot/submissions — filtered, searchable, paginated. */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', VotSubmission::class);

        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'patient_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(VotSubmission::STATUSES)],
            'nurse_id' => ['nullable', 'integer'],
            'treatment_status' => ['nullable', 'string', 'max:20'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $visiblePatients = Patient::query()->visibleTo($request->user())->select('id');

        $query = VotSubmission::query()
            ->with(self::RELATIONS)
            ->whereIn('patient_id', $visiblePatients)
            ->when($data['patient_id'] ?? null, fn (Builder $q, $id) => $q->where('patient_id', $id))
            ->when($data['status'] ?? null, fn (Builder $q, $s) => $q->where('status', $s))
            ->when($data['from'] ?? null, fn (Builder $q, $d) => $q->whereDate('submitted_at', '>=', $d))
            ->when($data['to'] ?? null, fn (Builder $q, $d) => $q->whereDate('submitted_at', '<=', $d))
            ->when($data['treatment_status'] ?? null, fn (Builder $q, $s) => $q->whereHas('treatmentPlan', fn ($p) => $p->where('status', $s)))
            ->when($data['nurse_id'] ?? null, fn (Builder $q, $id) => $q->whereHas(
                'patient.votEnrollment',
                fn ($e) => $e->where('assigned_nurse_id', $id),
            ))
            // Every word must match a name or the health ID, so "juan cruz"
            // finds Juan Dela Cruz. Portable across MySQL and SQLite (no CONCAT).
            ->when($data['search'] ?? null, function (Builder $q, string $term) {
                $q->whereHas('patient', function ($p) use ($term) {
                    foreach (preg_split('/\s+/', trim($term)) as $word) {
                        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $word).'%';
                        $p->where(fn ($w) => $w
                            ->where('first_name', 'like', $like)
                            ->orWhere('last_name', 'like', $like)
                            ->orWhere('health_id_number', 'like', $like)
                            ->when(ctype_digit($word), fn ($w2) => $w2->orWhere('patients.id', (int) $word)));
                    }
                });
            })
            // Oldest pending first is what a nurse works through; everything
            // else newest first.
            ->orderByRaw("CASE WHEN status = 'pending' THEN 0 ELSE 1 END")
            ->orderByDesc('submitted_at')
            ->orderByDesc('id');

        $page = $query->paginate((int) ($data['per_page'] ?? 15));
        $page->setCollection($page->getCollection()->map(
            fn (VotSubmission $s) => (new VotSubmissionResource($s))->resolve($request),
        ));

        return $this->paginated($page, 'VOT submissions retrieved.');
    }

    /** GET /vot/submissions/{submission} — detail, playable link, attempt history. */
    public function show(Request $request, VotSubmission $submission): JsonResponse
    {
        Gate::authorize('view', $submission);

        $submission->load(self::RELATIONS);

        $history = VotSubmission::query()
            ->with('reviewedBy')
            ->where('medication_log_id', $submission->medication_log_id)
            ->orderBy('attempt')
            ->get()
            ->map(fn (VotSubmission $s) => [
                'id' => $s->id,
                'attempt' => $s->attempt,
                'status' => $s->status,
                'media_type' => $s->media_type,
                'submitted_at' => $s->submitted_at?->toIso8601String(),
                'reviewed_at' => $s->reviewed_at?->toIso8601String(),
                'reviewed_by_name' => $s->reviewedBy?->name,
                'review_reason' => $s->review_reason,
            ]);

        // Who opened which patient's recording, and when.
        Audit::log($request, 'vot.viewed', "Viewed VOT proof #{$submission->id} for patient #{$submission->patient_id}", $submission);

        return $this->success(data: [
            ...(new VotSubmissionResource($submission))->withMedia()->resolve($request),
            'history' => $history,
        ]);
    }

    public function verify(ReviewVotSubmissionRequest $request, VotSubmission $submission): JsonResponse
    {
        ['stock_deducted' => $deducted] = $this->vot->verify($submission, $request->user(), $request->validated('reason'));

        $this->audit($request, $submission, 'vot.verified', 'Verified', $deducted ? ['stock_deducted' => $deducted] : []);

        return $this->respond($request, $submission, 'Dose verified.');
    }

    public function reject(ReviewVotSubmissionRequest $request, VotSubmission $submission): JsonResponse
    {
        $this->vot->reject($submission, $request->user(), $request->validated('reason'));

        $this->audit($request, $submission, 'vot.rejected', 'Rejected', ['reason' => $request->validated('reason')]);

        return $this->respond($request, $submission, 'Submission rejected.');
    }

    public function requestResubmission(ReviewVotSubmissionRequest $request, VotSubmission $submission): JsonResponse
    {
        $this->vot->requestResubmission($submission, $request->user(), $request->validated('reason'));

        $this->audit($request, $submission, 'vot.resubmission_requested', 'Requested new proof for', ['reason' => $request->validated('reason')]);

        return $this->respond($request, $submission, 'New proof requested from the patient.');
    }

    private function respond(Request $request, VotSubmission $submission, string $message): JsonResponse
    {
        return $this->success(
            data: (new VotSubmissionResource($submission->refresh()->load(self::RELATIONS)))->resolve($request),
            message: $message,
        );
    }

    private function audit(Request $request, VotSubmission $submission, string $action, string $verb, array $properties = []): void
    {
        Audit::log(
            $request,
            $action,
            "{$verb} VOT proof #{$submission->id} (dose #{$submission->medication_log_id}) for patient #{$submission->patient_id}",
            $submission,
            $properties,
        );
    }
}
