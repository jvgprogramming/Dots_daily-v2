<?php

use App\Models\Medication;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Data fix for medicines that existed before the inventory module:
 *
 *  1. `unit` used to hold the DOSE unit (mg/g — mirroring `strength`).
 *     Inventory quantity counts discrete items, so mass-unit rows are
 *     remapped to a count unit inferred from dosage_form
 *     (tablet → tablets, injection → vials, capsule → capsules …).
 *  2. `dosage` is backfilled from `strength` + dosage_form so legacy
 *     rows display a presentation like "300mg capsule".
 *  3. `stock_status` is recomputed so quantity/reorder_level/expiry
 *     reflect the real state after remapping.
 *
 * Runs after the inventory-fields migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Legacy dose units (mg/g) → stock count units by dosage_form
        $formToUnit = [
            'tablet' => 'tablets',
            'capsule' => 'capsules',
            'injection' => 'vials',
            'vial' => 'vials',
            'ampoule' => 'ampoules',
            'sachet' => 'sachets',
            'strip' => 'strips',
            'bottle' => 'bottles',
            'solution' => 'bottles',
            'suspension' => 'bottles',
        ];

        $legacy = Medication::query()
            ->where(function ($q) {
                $q->whereIn('unit', ['mg', 'g'])
                    ->orWhereNull('unit')
                    ->orWhere('unit', '');
            })
            ->get();

        foreach ($legacy as $med) {
            $unit = $formToUnit[$med->dosage_form] ?? 'tablets';
            $formWord = $unit === 'vials' ? 'injection' : rtrim((string) $unit, 's');

            $med->unit = $unit;
            $med->dosage = $med->dosage ?: trim(($med->strength ?: '') . ' ' . $formWord);
            $med->save();
        }

        // 2. Backfill any remaining null dosage from strength + form
        Medication::query()
            ->whereNull('dosage')
            ->orWhere('dosage', '')
            ->get()
            ->each(function (Medication $med) {
                $formWord = rtrim((string) $med->unit, 's');
                $med->dosage = trim(($med->strength ?: '') . ' ' . $formWord) ?: null;
                $med->save();
            });

        // 3. Recompute stock_status everywhere (cheap, table is small)
        Medication::query()->chunkById(100, function ($meds) {
            foreach ($meds as $med) {
                $status = $med->computeStockStatus();
                if ($med->stock_status !== $status) {
                    DB::table('medications')
                        ->where('id', $med->id)
                        ->update(['stock_status' => $status]);
                }
            }
        });
    }

    public function down(): void
    {
        // Intentionally irreversible: the original dose-unit values are not
        // recoverable once remapped, and re-deriving them adds no value.
    }
};
