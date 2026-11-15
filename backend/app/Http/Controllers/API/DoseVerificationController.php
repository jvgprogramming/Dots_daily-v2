<?php

namespace App\Http\Controllers\API;

use App\Models\Medication;
use App\Models\MedicationLog;
use App\Models\MedicationStockMovement;
use App\Support\AppSettings;
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
    public function verify(Request $request, MedicationLog $log): JsonResponse
    {
        $this->ensureVisible($request, $log);

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
            return $wasVerified ? null : $this->deductStock($request, $log);
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
            'notes' => $log->notes,
            'observed_by_name' => $log->observedBy?->name,
            // What the admin UI toggles from the reports table.
            'verified' => $log->observed_by !== null,
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

    /**
     * Settings → Inventory → "Deduct stock when a dose is verified": take the
     * dose out of the medicine's stock and record it in the stock ledger.
     * Returns what was deducted, or null when off / nothing to deduct.
     *
     * @return array{medication: string, quantity: int}|null
     */
    private function deductStock(Request $request, MedicationLog $log): ?array
    {
        if (! AppSettings::bool('inventory.auto_deduct_on_verify')) {
            return null;
        }

        $medicationId = $log->treatmentPlanMedication?->medication_id;
        $medication = $medicationId ? Medication::query()->lockForUpdate()->find($medicationId) : null;
        if (! $medication || $medication->quantity <= 0) {
            return null;
        }

        // dose_quantity is free text ("2 tablets"); its leading number is the count.
        $qty = preg_match('/\d+/', (string) $log->dose_quantity, $m) ? max(1, (int) $m[0]) : 1;
        $qty = min($qty, (int) $medication->quantity);

        $before = (int) $medication->quantity;
        $medication->quantity = $before - $qty;
        $medication->stock_status = $medication->computeStockStatus();
        $medication->save();

        $medication->stockMovements()->create([
            'type' => MedicationStockMovement::TYPE_DEDUCTION,
            'quantity_change' => -$qty,
            'quantity_before' => $before,
            'quantity_after' => $before - $qty,
            'reason' => "Verified dose #{$log->id} (patient #{$log->patient_id})",
            'user_id' => $request->user()->id,
        ]);

        return ['medication' => $medication->name, 'quantity' => $qty];
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
