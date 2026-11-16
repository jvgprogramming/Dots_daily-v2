<?php

namespace App\Http\Controllers\API;

use App\Models\MedicationLog;
use App\Services\Medication\DoseStockService;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The admin half of the verification loop.
 *
 * A patient confirms an intake from their phone; that log sits as "pending"
 * until a DOTS observer looks at it. Verifying sets `medication_logs.observed_by`
 * — the column every surface already reads for its green/pending split, so no
 * new storage and no migration.
 *
 * Proof photos stay optional. The original plan has patients attaching a photo
 * or video as evidence, but demanding one from every dose would be taxing for
 * the patient, so the admin's judgement is the source of truth and evidence is
 * only there to help.
 */
class DoseVerificationController extends BaseApiController
{
    public function __construct(private readonly DoseStockService $stock) {}

    public function verify(Request $request, MedicationLog $log): JsonResponse
    {
        $this->ensureVisible($request, $log);

        // A VOT dose is verified by reviewing its proof (Reports → VOT), which
        // also keeps the submission's review record; don't bypass that here.
        if ($log->verification_status !== null) {
            return $this->error(
                'This is a video-observed therapy dose. Review its proof under Reports → Video-Observed Therapy.',
                422,
            );
        }

        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        if (! in_array($log->status, ['taken', 'late'], true)) {
            return $this->error(
                'Only taken or late doses can be verified — a missed or skipped dose has nothing to confirm.',
                422,
            );
        }

        $deducted = DB::transaction(function () use ($request, $log, $data) {
            $wasVerified = $log->observed_by !== null;
            $log->fill([
                'observed_by' => $request->user()->id,
                'notes' => $data['notes'] ?? $log->notes,
            ])->save();

            // First verification only — re-verifying must not deduct twice.
            return $wasVerified ? null : $this->stock->deductForVerifiedDose($log, $request->user());
        });

        $this->audit($request, $log, 'dose.verified', 'Verified dose', $deducted ? ['stock_deducted' => $deducted] : []);

        return $this->success(
            data: $this->formatLog($log->load(['patient.user', 'treatmentPlanMedication.medication', 'observedBy'])),
            message: 'Dose verified successfully.',
        );
    }

    public function unverify(Request $request, MedicationLog $log): JsonResponse
    {
        $this->ensureVisible($request, $log);

        if ($log->verification_status !== null) {
            return $this->error('VOT doses are managed under Reports → Video-Observed Therapy.', 422);
        }

        if ($log->observed_by === null) {
            return $this->error('This dose is not verified.', 422);
        }

        $log->fill(['observed_by' => null])->save();

        $this->audit($request, $log, 'dose.unverified', 'Removed verification of dose');

        return $this->success(
            data: $this->formatLog($log->load(['patient.user', 'treatmentPlanMedication.medication', 'observedBy'])),
            message: 'Dose verification removed.',
        );
    }

    /**
     * Flag a dose whose proof video looks suspicious. The dose stays recorded
     * but is excluded from adherence until a nurse clears the flag.
     */
    public function flag(Request $request, MedicationLog $log): JsonResponse
    {
        $this->ensureVisible($request, $log);

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $log->fill([
            'flagged_at' => now(),
            'flagged_by' => $request->user()->id,
            'flag_reason' => $data['reason'] ?? null,
        ])->save();

        $this->audit(
            $request,
            $log,
            'dose.flagged',
            'Flagged dose',
            array_filter(['reason' => $data['reason'] ?? null]),
        );

        return $this->success(
            data: $this->formatLog($log->load(['patient.user', 'treatmentPlanMedication.medication', 'flaggedBy'])),
            message: 'Dose flagged for follow-up.',
        );
    }

    /** Clear a flag once the concern has been resolved. */
    public function unflag(Request $request, MedicationLog $log): JsonResponse
    {
        $this->ensureVisible($request, $log);

        if ($log->flagged_at === null) {
            return $this->error('This dose is not flagged.', 422);
        }

        $log->fill(['flagged_at' => null, 'flagged_by' => null, 'flag_reason' => null])->save();

        $this->audit($request, $log, 'dose.unflagged', 'Cleared flag on dose');

        return $this->success(
            data: $this->formatLog($log->load(['patient.user', 'treatmentPlanMedication.medication', 'flaggedBy'])),
            message: 'Dose flag cleared.',
        );
    }

    /**
     * The same shape the reports feed uses, so the admin UI can swap the row
     * in place after an action without reshaping anything.
     */
    private function formatLog(MedicationLog $log): array
    {
        $medication = $log->treatmentPlanMedication?->medication;

        return [
            'id' => $log->id,
            'patient_id' => $log->patient_id,
            'patient_name' => $log->patient
                ? (trim(($log->patient->first_name ?? '').' '.($log->patient->last_name ?? '')) ?: ($log->patient->user?->name ?? 'Unnamed patient'))
                : 'Unknown patient',
            'medication_name' => $medication?->name
                ? trim($medication->name.($medication->strength ? " {$medication->strength}" : ''))
                : null,
            'scheduled_date' => $log->scheduled_date?->toDateString(),
            'scheduled_time' => $log->scheduled_time,
            'status' => $log->status,
            'taken_at' => $log->taken_at?->toIso8601String(),
            'dose_quantity' => $log->dose_quantity,
            'proof_photo' => $log->proof_photo,
            'proof_url' => $log->proof_photo_url,
            'proof_video_url' => $log->proof_video_url,
            'has_video' => $log->proof_video_path !== null,
            'notes' => $log->notes,
            'observed_by_name' => $log->observedBy?->name,
            'verified' => $log->observed_by !== null,
            'verification_status' => $log->verification_status,
            // Logged-by-default review model: a dose counts unless it is flagged.
            'flagged' => $log->flagged,
            'flag_reason' => $log->flag_reason,
            'flagged_by_name' => $log->flaggedBy?->name,
            'created_at' => $log->created_at?->toIso8601String(),
        ];
    }

    /**
     * Both portal roles may act on every patient's doses. An unreadable
     * record answers 404 so its existence is not revealed.
     */
    private function ensureVisible(Request $request, MedicationLog $log): void
    {
        $patient = $log->patient;
        abort_unless($patient && $patient->isVisibleTo($request->user()), 404, 'Dose log not found.');
    }

    /** Every (un)verification is recorded in the audit trail with who and where. */
    private function audit(Request $request, MedicationLog $log, string $action, string $verb, array $properties = []): void
    {
        Audit::log(
            $request,
            $action,
            "{$verb} #{$log->id} for patient #{$log->patient_id}",
            $log,
            $properties,
        );
    }
}
