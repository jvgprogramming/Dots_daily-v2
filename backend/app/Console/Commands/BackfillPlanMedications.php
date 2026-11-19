<?php

namespace App\Console\Commands;

use App\Models\TreatmentPlan;
use App\Services\Medication\RegimenPrescriber;
use Illuminate\Console\Command;

/**
 * Gives active treatment plans that have no medicines their regimen's
 * standard drugs. Plans created by registration before RegimenPrescriber
 * existed are empty, which stops the patient logging any dose.
 */
class BackfillPlanMedications extends Command
{
    protected $signature = 'treatment-plans:backfill-medications {--dry-run : List the plans without changing them}';

    protected $description = 'Add regimen medicines to active treatment plans that have none';

    public function handle(RegimenPrescriber $prescriber): int
    {
        $plans = TreatmentPlan::query()
            ->where('status', 'active')
            ->doesntHave('treatmentPlanMedications')
            ->with('patient')
            ->get();

        if ($plans->isEmpty()) {
            $this->info('No active plans without medicines.');

            return self::SUCCESS;
        }

        foreach ($plans as $plan) {
            $who = trim(($plan->patient?->first_name ?? '').' '.($plan->patient?->last_name ?? '')) ?: "patient #{$plan->patient_id}";
            $label = "plan #{$plan->id} ({$who}, {$plan->regimen_type}, {$plan->phase})";

            if ($this->option('dry-run')) {
                $this->line("Would fill {$label}");

                continue;
            }

            $added = $prescriber->prescribe($plan);
            $added
                ? $this->info("Added {$added} medicines to {$label}")
                : $this->warn("Skipped {$label}: no standard medicines for this regimen — prescribe by hand");
        }

        return self::SUCCESS;
    }
}
