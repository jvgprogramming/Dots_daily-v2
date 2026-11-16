<?php

namespace App\Http\Controllers\API;

use App\Http\Requests\StoreDoseLogRequest;
use App\Models\MedicationLog;
use App\Models\Patient;
use App\Models\TreatmentPlanMedication;
use App\Services\Medication\DoseLogService;
use App\Support\Adherence;
use App\Support\FollowUps;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Patient-facing dose logging for the Flutter app.
 *
 * This is the write half of the adherence loop: the phone posts a confirmed
 * intake here and the admin web app picks it up through the endpoints that
 * already read the same table (/reports/medication-adherence,
 * /patients/monitoring, /dashboard/stats). No new storage is introduced.
 *
 *   TreatmentPlan + TreatmentPlanMedication → the patient's active regimen
 *   MedicationLog                           → one row per daily intake
 *
 * Proof: a patient enrolled in Video-Observed Therapy sends proof through
 * /mobile/vot/submissions (MobileVotController). This endpoint is the plain
 * "I took it" confirmation everyone else uses — it carries no media.
 */
class MobileDoseLogController extends BaseApiController
{
    /** Safety cap on the history payload the calendar hydrates from. */
    private const MAX_HISTORY = 400;

    public function __construct(private readonly DoseLogService $doseLogs) {}

    /**
     * The patient's active regimen: plan, prescribed medicines and which one the
     * app logs its single combined daily intake against.
     *
     * Always 200 — a patient without a plan yet is a normal state the app shows
     * as "no regimen", not an error.
     */
    public function regimen(Request $request): JsonResponse
    {
        $patient = $request->user()?->patient;

        if (! $patient) {
            return $this->error('This account is not linked to a patient profile.', 403);
        }

        $plan = $this->doseLogs->activePlan($patient);
        $medications = $this->doseLogs->regimenMedications($plan);
        $primary = $medications->first();

        // Full-course adherence (plan start → scheduled end, future days
        // included) and the next follow-up — both identical in definition to
        // the admin dashboard, reports and treatments hub.
        $adherence = $plan ? Adherence::planWindowSummary([$patient->id])['summary'] : null;
        $followUp = $plan ? FollowUps::nextFor($plan) : null;

        return $this->success(
            data: [
                'patient' => [
                    'id' => $patient->id,
                    'name' => $this->patientName($patient),
                ],
                'treatment_plan' => $plan ? [
                    'id' => $plan->id,
                    'plan_name' => $plan->plan_name,
                    'regimen_type' => $plan->regimen_type,
                    'phase' => $plan->phase,
                    'status' => $plan->status,
                    'start_date' => $plan->start_date?->toDateString(),
                    'expected_end_date' => $plan->expected_end_date?->toDateString(),
                    'medications_count' => $medications->count(),
                ] : null,
                'medications' => $medications->map(fn (TreatmentPlanMedication $tpm) => [
                    'treatment_plan_medication_id' => $tpm->id,
                    'medication_id' => $tpm->medication_id,
                    'name' => $tpm->medication?->name,
                    'strength' => $tpm->medication?->strength,
                    'dosage' => $tpm->dosage,
                    'frequency' => $tpm->frequency,
                    'preferred_time' => $this->hhmm($tpm->preferred_time),
                ])->values(),
                // The regimen is taken as one combined daily intake, so the app
                // logs against this row.
                'primary_treatment_plan_medication_id' => $primary?->id,
                'reminder_time' => $this->hhmm($primary?->preferred_time),
                'can_log_doses' => $primary !== null,
                // The same figures the admin side reports, so the patient and
                // the clinic never disagree: adherence over the full scheduled
                // course (start → scheduled end), and the derived follow-up
                // schedule the treatments hub shows.
                'adherence' => $plan ? [
                    'scheduled_days' => $adherence['expected'],
                    'days_taken' => $adherence['taken'],
                    'rate' => $adherence['rate'],
                ] : null,
                'treatment_end_date' => $plan
                    ? ($plan->actual_end_date?->toDateString() ?? $plan->expected_end_date?->toDateString())
                    : null,
                'next_follow_up' => $followUp['date'] ?? null,
                'next_follow_up_status' => $followUp['status'] ?? 'none',
                // Whether doses go through Video-Observed Therapy (proof upload)
                // instead of the plain confirmation. Details: GET /mobile/vot.
                'vot_enrolled' => $patient->isVotActive(),
            ],
            message: $primary
                ? 'Regimen retrieved successfully.'
                : 'No active treatment regimen is assigned to this patient yet.',
        );
    }

    /**
     * The patient's dose history, newest day first.
     *
     * The app hydrates its calendar from this in one call — a TB regimen is
     * months long, so the whole history comfortably fits in one payload.
     */
    public function index(Request $request): JsonResponse
    {
        $patient = $request->user()?->patient;

        if (! $patient) {
            return $this->error('This account is not linked to a patient profile.', 403);
        }

        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $query = MedicationLog::query()
            ->where('patient_id', $patient->id)
            ->with(['treatmentPlanMedication.medication', 'latestVotSubmission'])
            ->orderByDesc('scheduled_date')
            ->orderByDesc('id');

        if (isset($data['from'])) {
            $query->whereDate('scheduled_date', '>=', $data['from']);
        }
        if (isset($data['to'])) {
            $query->whereDate('scheduled_date', '<=', $data['to']);
        }

        $logs = $query->limit(self::MAX_HISTORY)->get();

        return $this->success(
            data: [
                'logs' => $logs->map(fn (MedicationLog $log) => $this->formatLog($log))->values(),
                'count' => $logs->count(),
            ],
            message: 'Dose history retrieved successfully.',
        );
    }

    /**
     * Record a confirmed intake.
     *
     * Idempotent per patient + medicine + day (backed by the unique index), so
     * logging the same day twice — a double tap, or a retry after the phone
     * reconnects — updates that day's row instead of creating a phantom dose.
     */
    public function store(StoreDoseLogRequest $request): JsonResponse
    {
        $patient = $request->user()?->patient;

        if (! $patient) {
            return $this->error('This account is not linked to a patient profile.', 403);
        }

        $data = $request->validated();

        $pivot = $this->doseLogs->resolvePivot(
            $patient,
            isset($data['treatment_plan_medication_id']) ? (int) $data['treatment_plan_medication_id'] : null,
        );

        if (! $pivot) {
            return $this->error(
                'No active treatment regimen is assigned to this patient yet, so a dose cannot be logged.',
                409,
            );
        }

        $scheduledDate = CarbonImmutable::parse($data['scheduled_date'], config('app.timezone'));
        $log = $this->doseLogs->fillLog($patient, $pivot, $scheduledDate, $data);

        // A VOT patient's dose needs proof. Logged without it (e.g. synced
        // from the offline queue), it waits as `awaiting_proof` — held out of
        // adherence until the proof arrives. Never overwrite a state the proof
        // flow already set, and a missed/skipped dose has nothing to prove.
        if ($patient->isVotActive()
            && in_array($log->status, ['taken', 'late'], true)
            && $log->verification_status === null) {
            $log->verification_status = 'awaiting_proof';
        }

        $log->save();

        return $this->success(
            data: $this->formatLog($log->load(['treatmentPlanMedication.medication', 'latestVotSubmission'])),
            message: 'Dose logged successfully.',
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────

    private function formatLog(MedicationLog $log): array
    {
        $medication = $log->treatmentPlanMedication?->medication;

        return [
            'id' => $log->id,
            'scheduled_date' => $log->scheduled_date?->toDateString(),
            'scheduled_time' => $this->hhmm($log->scheduled_time),
            'taken_at' => $log->taken_at?->toIso8601String(),
            'status' => $log->status,
            'dose_quantity' => $log->dose_quantity,
            'notes' => $log->notes,
            'medication_name' => $medication?->name,
            'verified' => $log->observed_by !== null,
            'flagged' => $log->flagged,
            'flag_reason' => $log->flag_reason,
            // VOT review state (null for a non-VOT dose): awaiting_proof,
            // pending, verified, rejected or resubmission_required.
            'verification_status' => $log->verification_status,
            'review_reason' => $log->latestVotSubmission?->review_reason,
            'proof_attempts' => $log->latestVotSubmission?->attempt ?? 0,
            // The patient's own proof, so the app can show it back. Signed and
            // short-lived, like every proof link.
            'has_video' => $log->proof_video_path !== null,
            'proof_video_url' => $log->proof_video_url,
            'has_photo' => $log->proof_photo !== null,
            'proof_photo_url' => $log->proof_photo_url,
        ];
    }

    private function patientName(Patient $patient): string
    {
        return trim(($patient->first_name ?? '').' '.($patient->last_name ?? ''))
            ?: ($patient->user?->name ?? 'Patient');
    }

    /** Trims a TIME value (`07:00:00`) down to the app's `HH:mm`. */
    private function hhmm(?string $time): ?string
    {
        return $time ? substr($time, 0, 5) : null;
    }
}
