<?php

namespace App\Http\Controllers\API;

use App\Models\MedicationLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
    public function verify(Request $request, MedicationLog $log): JsonResponse
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        if (! in_array($log->status, ['taken', 'late'], true)) {
            return $this->error(
                'Only taken or late doses can be verified — a missed or skipped dose has nothing to confirm.',
                422,
            );
        }

        $log->fill([
            'observed_by' => $request->user()->id,
            'notes' => $data['notes'] ?? $log->notes,
        ])->save();

        return $this->success(
            data: $this->formatLog($log->load(['patient.user', 'treatmentPlanMedication.medication', 'observedBy'])),
            message: 'Dose verified successfully.',
        );
    }

    public function unverify(Request $request, MedicationLog $log): JsonResponse
    {
        if ($log->observed_by === null) {
            return $this->error('This dose is not verified.', 422);
        }

        $log->fill(['observed_by' => null])->save();

        return $this->success(
            data: $this->formatLog($log->load(['patient.user', 'treatmentPlanMedication.medication', 'observedBy'])),
            message: 'Dose verification removed.',
        );
    }

    /**
     * The same shape the reports feed uses, so the admin UI can swap the row
     * in place after a (un)verify without reshaping anything.
     */
    private function formatLog(MedicationLog $log): array
    {
        $medication = $log->treatmentPlanMedication?->medication;

        return [
            'id' => $log->id,
            'patient_id' => $log->patient_id,
            'patient_name' => $log->patient
                ? (trim(($log->patient->first_name ?? '') . ' ' . ($log->patient->last_name ?? '')) ?: ($log->patient->user?->name ?? 'Unnamed patient'))
                : 'Unknown patient',
            'medication_name' => $medication?->name
                ? trim($medication->name . ($medication->strength ? " {$medication->strength}" : ''))
                : null,
            'scheduled_date' => $log->scheduled_date?->toDateString(),
            'scheduled_time' => $log->scheduled_time,
            'status' => $log->status,
            'taken_at' => $log->taken_at?->toIso8601String(),
            'dose_quantity' => $log->dose_quantity,
            'proof_photo' => $log->proof_photo,
            'notes' => $log->notes,
            'observed_by_name' => $log->observedBy?->name,
            // What the admin UI toggles from the reports table.
            'verified' => $log->observed_by !== null,
            'created_at' => $log->created_at?->toIso8601String(),
        ];
    }
}
