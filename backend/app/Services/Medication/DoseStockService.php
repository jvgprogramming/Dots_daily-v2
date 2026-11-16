<?php

namespace App\Services\Medication;

use App\Models\Medication;
use App\Models\MedicationLog;
use App\Models\MedicationStockMovement;
use App\Models\User;
use App\Support\AppSettings;

/**
 * Settings → Inventory → "Deduct stock when a dose is verified": take the dose
 * out of the medicine's stock and record it in the stock ledger. Shared by the
 * plain dose verification and the VOT proof verification.
 */
class DoseStockService
{
    /**
     * Call inside the verifying transaction, and only on a dose's *first*
     * verification. Returns what was deducted, or null when off / nothing to do.
     *
     * @return array{medication: string, quantity: int}|null
     */
    public function deductForVerifiedDose(MedicationLog $log, User $by): ?array
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
            'user_id' => $by->id,
        ]);

        return ['medication' => $medication->name, 'quantity' => $qty];
    }
}
