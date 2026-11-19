<?php

namespace App\Services\Medication;

use App\Models\Medication;
use App\Models\TreatmentPlan;
use App\Support\AppSettings;

/**
 * Fills a treatment plan with the standard medicines for its regimen.
 *
 * Registration only records the regimen code (e.g. "2HRZE/4HR"). Doses — and
 * video-observed proof — are logged against a prescribed medicine, so a plan
 * with no medicines leaves the patient unable to log anything. This gives the
 * plan its regimen's drugs for the current phase so the app works right away;
 * staff can still adjust dosages afterwards.
 */
class RegimenPrescriber
{
    /**
     * Drugs per regimen code and phase, by medications.name. Drugs not in the
     * medications table (e.g. Pretomanid, Linezolid) are skipped. Regimens not
     * listed here ("individualized", custom ones) are prescribed by hand.
     */
    private const REGIMEN_DRUGS = [
        '2HRZE/4HR' => [
            'intensive' => ['Isoniazid', 'Rifampicin', 'Pyrazinamide', 'Ethambutol'],
            'continuation' => ['Isoniazid', 'Rifampicin'],
        ],
        '2HRZE/10HR' => [
            'intensive' => ['Isoniazid', 'Rifampicin', 'Pyrazinamide', 'Ethambutol'],
            'continuation' => ['Isoniazid', 'Rifampicin'],
        ],
        '9H' => ['continuation' => ['Isoniazid']],
        '3HP' => ['continuation' => ['Isoniazid', 'Rifapentine']],
        '4R' => ['continuation' => ['Rifampicin']],
        'BPaLM' => ['intensive' => ['Bedaquiline', 'Pretomanid', 'Linezolid', 'Moxifloxacin']],
        'BPaL' => ['intensive' => ['Bedaquiline', 'Pretomanid', 'Linezolid']],
    ];

    /** Regimens taken once a week rather than daily. */
    private const WEEKLY = ['3HP'];

    /**
     * Adds the regimen's medicines to a plan that has none. Leaves a plan that
     * already has medicines untouched (dose logs hang off them).
     *
     * @return int How many medicines were added.
     */
    public function prescribe(TreatmentPlan $plan): int
    {
        if ($plan->treatmentPlanMedications()->exists()) {
            return 0;
        }

        $phase = $plan->phase === 'continuation' ? 'continuation' : 'intensive';
        $byPhase = self::REGIMEN_DRUGS[$plan->regimen_type] ?? [];
        // Single-phase regimens list only the phase they have.
        $names = $byPhase[$phase] ?? (count($byPhase) === 1 ? reset($byPhase) : []);
        if ($names === []) {
            return 0;
        }

        $regimen = AppSettings::regimen($plan->regimen_type) ?? [];
        $phaseDays = (int) ($regimen[$phase.'_days'] ?? 0)
            ?: (int) ($regimen['intensive_days'] ?? 0) + (int) ($regimen['continuation_days'] ?? 0);
        $durationWeeks = max(1, (int) ceil($phaseDays / 7));
        $frequency = in_array($plan->regimen_type, self::WEEKLY, true) ? 'Once weekly' : 'Once daily';

        $medications = Medication::query()->whereIn('name', $names)->get()->keyBy('name');

        $added = 0;
        // Keep the regimen's order: the first medicine is the one a combined
        // daily intake is logged against (DoseLogService::regimenMedications).
        foreach ($names as $name) {
            $medication = $medications->get($name);
            if (! $medication) {
                continue;
            }
            $plan->treatmentPlanMedications()->create([
                'medication_id' => $medication->id,
                'dosage' => $medication->strength ?: 'As prescribed',
                'frequency' => $frequency,
                'route' => 'oral',
                'duration_weeks' => $durationWeeks,
                'notes' => 'Added from the '.$plan->regimen_type.' regimen at registration. Adjust the dose to the patient\'s weight band if needed.',
            ]);
            $added++;
        }

        return $added;
    }
}
