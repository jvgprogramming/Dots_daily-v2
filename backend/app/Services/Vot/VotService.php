<?php

namespace App\Services\Vot;

use App\Models\MedicationLog;
use App\Models\Patient;
use App\Models\User;
use App\Models\VotEnrollment;
use App\Models\VotSubmission;
use App\Services\Medication\DoseLogService;
use App\Services\Medication\DoseStockService;
use App\Services\Notification\NotificationService;
use App\Support\AppSettings;
use App\Support\ProofMedia;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Video-Observed Therapy: eligibility, proof submission and nurse review.
 *
 * Review model (agreed with the clinic): submitting proof does not wait on a
 * nurse. The dose is logged straight away with `verification_status = pending`
 * and counts toward adherence; a nurse later verifies it, rejects it, or asks
 * for new proof — the last two hold it out of adherence until fixed.
 */
class VotService
{
    public function __construct(
        private readonly DoseLogService $doseLogs,
        private readonly DoseStockService $stock,
        private readonly NotificationService $notifications,
    ) {}

    // ─────────────────────────────────────────────────────────────────
    // Eligibility
    // ─────────────────────────────────────────────────────────────────

    /**
     * Create or update a patient's VOT eligibility.
     *
     * @param  array{status: string, eligible_since?: string|null, assigned_nurse_id?: int|null, notes?: string|null, status_reason?: string|null}  $data
     * @return array{enrollment: VotEnrollment, previous_status: string|null}
     */
    public function updateEnrollment(Patient $patient, array $data, User $by): array
    {
        $enrollment = $patient->votEnrollment ?? new VotEnrollment(['patient_id' => $patient->id]);
        $previousStatus = $enrollment->exists ? $enrollment->status : null;
        $statusChanged = $previousStatus !== $data['status'];

        $enrollment->fill([
            'status' => $data['status'],
            'assigned_nurse_id' => $data['assigned_nurse_id'] ?? null,
            'notes' => $data['notes'] ?? null,
            'status_reason' => $data['status_reason'] ?? null,
        ]);

        if ($data['status'] === VotEnrollment::STATUS_ACTIVE) {
            $enrollment->eligible_since = $data['eligible_since']
                ?? $enrollment->eligible_since
                ?? CarbonImmutable::today();
            $enrollment->granted_by ??= $by->id;
        } elseif (array_key_exists('eligible_since', $data) && $data['eligible_since']) {
            $enrollment->eligible_since = $data['eligible_since'];
        }

        if ($statusChanged) {
            $enrollment->status_changed_at = now();
            $enrollment->status_changed_by = $by->id;
        }

        $enrollment->save();

        if ($statusChanged) {
            $this->notifyEnrollmentChange($patient, $enrollment);
        }

        return ['enrollment' => $enrollment, 'previous_status' => $previousStatus];
    }

    // ─────────────────────────────────────────────────────────────────
    // Submission (patient)
    // ─────────────────────────────────────────────────────────────────

    /**
     * Record a proof attempt for a scheduled dose and log the dose as pending.
     *
     * @param  array{scheduled_date: string, scheduled_time: string, taken_at?: string|null, treatment_plan_medication_id?: int|null, media_type: string, duration_seconds?: int|null}  $data
     */
    public function submit(Patient $patient, array $data, UploadedFile $file): VotSubmission
    {
        if (! $patient->isVotActive()) {
            throw new VotException('You are not enrolled in video-observed therapy. Please confirm your dose the usual way.', 403);
        }

        $pivot = $this->doseLogs->resolvePivot(
            $patient,
            isset($data['treatment_plan_medication_id']) ? (int) $data['treatment_plan_medication_id'] : null,
        );
        if (! $pivot) {
            throw new VotException('No active treatment regimen is assigned to you yet, so a dose cannot be recorded.', 409);
        }

        $scheduledDate = CarbonImmutable::parse($data['scheduled_date'], config('app.timezone'));
        $mediaType = $data['media_type'];
        $storedPath = null;

        try {
            $submission = DB::transaction(function () use ($patient, $pivot, $scheduledDate, $data, $file, $mediaType, &$storedPath) {
                $log = $this->doseLogs->fillLog($patient, $pivot, $scheduledDate, [
                    'scheduled_time' => $data['scheduled_time'],
                    'taken_at' => $data['taken_at'] ?? null,
                ]);

                $latest = $log->exists
                    ? VotSubmission::query()
                        ->where('medication_log_id', $log->id)
                        ->lockForUpdate()
                        ->orderByDesc('attempt')
                        ->first()
                    : null;

                $this->assertCanSubmit($latest);

                $storedPath = ProofMedia::store($file, $patient->id, $mediaType);

                // The dose row always points at its latest proof, so the existing
                // reports / monitoring views show it with no extra joins. Earlier
                // files are kept: they are the review history.
                if ($mediaType === 'video') {
                    $log->proof_video_path = $storedPath;
                    $log->proof_video_mime = $file->getMimeType();
                    $log->proof_video_size = $file->getSize();
                } else {
                    $log->proof_photo = $storedPath;
                }
                $log->verification_status = 'pending';
                $log->save();

                return VotSubmission::create([
                    'medication_log_id' => $log->id,
                    'patient_id' => $patient->id,
                    'treatment_plan_id' => $pivot->treatment_plan_id,
                    'attempt' => ($latest?->attempt ?? 0) + 1,
                    'media_type' => $mediaType,
                    'media_path' => $storedPath,
                    'media_mime' => $file->getMimeType(),
                    'media_size' => $file->getSize(),
                    'duration_seconds' => $mediaType === 'video' ? ($data['duration_seconds'] ?? null) : null,
                    'submitted_at' => now(),
                    'status' => VotSubmission::STATUS_PENDING,
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            // Two uploads for a brand-new dose raced; the other one won.
            ProofMedia::delete($storedPath);
            throw new VotException('Proof for this dose has already been submitted.', 409);
        } catch (Throwable $e) {
            ProofMedia::delete($storedPath);
            throw $e;
        }

        $this->notifySubmitted($patient, $submission->load('medicationLog'));

        return $submission;
    }

    /** One live proof per dose: a new one only after a rejection or a request. */
    private function assertCanSubmit(?VotSubmission $latest): void
    {
        if (! $latest) {
            return;
        }

        if (in_array($latest->status, [VotSubmission::STATUS_PENDING, VotSubmission::STATUS_VERIFIED], true)) {
            throw new VotException('Proof for this dose has already been submitted.', 409);
        }

        if ($latest->status === VotSubmission::STATUS_REJECTED
            && ! AppSettings::bool('vot.allow_resubmit_after_reject')) {
            throw new VotException('The proof for this dose was rejected. Please contact your nurse.', 409);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Review (nurse)
    // ─────────────────────────────────────────────────────────────────

    /** @return array{submission: VotSubmission, stock_deducted: array|null} */
    public function verify(VotSubmission $submission, User $by, ?string $notes = null): array
    {
        $deducted = DB::transaction(function () use ($submission, $by, $notes) {
            $this->lockPending($submission);
            $this->decide($submission, VotSubmission::STATUS_VERIFIED, $by, $notes);

            $log = $submission->medicationLog;
            $firstVerification = $log->observed_by === null;
            $log->fill(['verification_status' => 'verified', 'observed_by' => $by->id])->save();

            // Only the first verification of a dose may touch stock.
            return $firstVerification ? $this->stock->deductForVerifiedDose($log, $by) : null;
        });

        $this->notifyPatient(
            $submission,
            'vot.verified',
            'Dose verified',
            'Your nurse verified your dose for '.$this->doseLabel($submission).'. Well done!',
        );

        return ['submission' => $submission, 'stock_deducted' => $deducted];
    }

    public function reject(VotSubmission $submission, User $by, string $reason): VotSubmission
    {
        DB::transaction(function () use ($submission, $by, $reason) {
            $this->lockPending($submission);
            $this->decide($submission, VotSubmission::STATUS_REJECTED, $by, $reason);
            $submission->medicationLog->fill(['verification_status' => 'rejected'])->save();
        });

        $canRetry = AppSettings::bool('vot.allow_resubmit_after_reject');
        $this->notifyPatient(
            $submission,
            'vot.rejected',
            'Proof not accepted',
            'Your proof for '.$this->doseLabel($submission)." was not accepted: {$reason}"
                .($canRetry ? ' You can record a new one from the app.' : ' Please contact your nurse.'),
        );

        return $submission;
    }

    public function requestResubmission(VotSubmission $submission, User $by, string $reason): VotSubmission
    {
        DB::transaction(function () use ($submission, $by, $reason) {
            $this->lockPending($submission);
            $this->decide($submission, VotSubmission::STATUS_RESUBMISSION_REQUESTED, $by, $reason);
            $submission->medicationLog->fill(['verification_status' => 'resubmission_required'])->save();
        });

        $this->notifyPatient(
            $submission,
            'vot.resubmission_requested',
            'Please record your dose again',
            'Your nurse needs a new recording for '.$this->doseLabel($submission).": {$reason}",
        );

        return $submission;
    }

    /** Re-read under a row lock so two nurses cannot both decide one proof. */
    private function lockPending(VotSubmission $submission): void
    {
        $fresh = VotSubmission::query()->lockForUpdate()->find($submission->id);

        if (! $fresh || ! $fresh->isPending()) {
            throw new VotException('This submission has already been reviewed.', 409);
        }
    }

    private function decide(VotSubmission $submission, string $status, User $by, ?string $reason): void
    {
        $submission->fill([
            'status' => $status,
            'reviewed_by' => $by->id,
            'reviewed_at' => now(),
            'review_reason' => $reason,
        ])->save();
    }

    // ─────────────────────────────────────────────────────────────────
    // Overview
    // ─────────────────────────────────────────────────────────────────

    /** Headline counts for the Reports → VOT cards, straight from the tables. */
    public function summary(): array
    {
        $byStatus = VotSubmission::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return [
            'total_submissions' => (int) $byStatus->sum(),
            'pending' => (int) ($byStatus[VotSubmission::STATUS_PENDING] ?? 0),
            'verified' => (int) ($byStatus[VotSubmission::STATUS_VERIFIED] ?? 0),
            'rejected' => (int) ($byStatus[VotSubmission::STATUS_REJECTED] ?? 0),
            'resubmission_requested' => (int) ($byStatus[VotSubmission::STATUS_RESUBMISSION_REQUESTED] ?? 0),
            'enrolled_patients' => VotEnrollment::query()
                ->where('status', VotEnrollment::STATUS_ACTIVE)
                ->whereHas('patient')
                ->count(),
        ];
    }

    // ─────────────────────────────────────────────────────────────────
    // Notifications
    // ─────────────────────────────────────────────────────────────────

    /** The patient's assigned nurse, else every active portal user. */
    public function reviewerIds(Patient $patient): array
    {
        $nurse = $patient->votEnrollment?->assignedNurse;
        if ($nurse && $nurse->is_active) {
            return [$nurse->id];
        }

        return User::query()
            ->whereIn('role', User::PORTAL_ROLES)
            ->where('is_active', true)
            ->pluck('id')
            ->all();
    }

    private function notifySubmitted(Patient $patient, VotSubmission $submission): void
    {
        $name = trim(($patient->first_name ?? '').' '.($patient->last_name ?? '')) ?: 'A patient';
        $label = $this->doseLabel($submission);

        $this->notifications->send(
            'vot.submitted',
            'New proof to review',
            "{$name} submitted a {$submission->media_type} for their dose on {$label}.",
            ['submission_id' => $submission->id, 'patient_id' => $patient->id, 'link' => '/reports?tab=vot&submission='.$submission->id],
            $this->reviewerIds($patient),
        );

        $this->notifications->send(
            'vot.received',
            'Proof submitted',
            "Your {$submission->media_type} for {$label} was submitted and is waiting for your nurse to review it.",
            ['submission_id' => $submission->id],
            [$patient->user_id],
        );
    }

    private function notifyPatient(VotSubmission $submission, string $type, string $title, string $body): void
    {
        $this->notifications->send(
            $type,
            $title,
            $body,
            ['submission_id' => $submission->id, 'medication_log_id' => $submission->medication_log_id],
            [$submission->patient?->user_id],
        );
    }

    private function notifyEnrollmentChange(Patient $patient, VotEnrollment $enrollment): void
    {
        [$title, $body] = match ($enrollment->status) {
            VotEnrollment::STATUS_ACTIVE => ['Video-observed therapy enabled', 'Your clinic enrolled you in video-observed therapy. Record yourself taking each dose from the app.'],
            VotEnrollment::STATUS_SUSPENDED => ['Video-observed therapy paused', 'Your clinic paused video-observed therapy for now. Confirm your doses the usual way.'],
            default => ['Video-observed therapy ended', 'Your clinic ended video-observed therapy for you. Confirm your doses the usual way.'],
        };

        $this->notifications->send('vot.enrollment', $title, $body, ['status' => $enrollment->status], [$patient->user_id]);
    }

    private function doseLabel(VotSubmission $submission): string
    {
        $log = $submission->medicationLog ?? MedicationLog::find($submission->medication_log_id);

        return $log?->scheduled_date?->format('M j, Y') ?? 'your dose';
    }
}
