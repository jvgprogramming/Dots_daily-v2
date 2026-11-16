<?php

namespace App\Services\Medication;

use App\Models\MedicationLog;
use App\Models\Patient;
use App\Models\TreatmentPlan;
use App\Models\TreatmentPlanMedication;
use App\Support\AppSettings;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * The patient's regimen and the one-row-per-dose upsert, shared by the plain
 * dose-log endpoint and the VOT proof submission so both write the same
 * `medication_logs` row for a given patient, medicine and day.
 */
class DoseLogService
{
    /** The patient's current regimen — active plan first, else the latest one. */
    public function activePlan(Patient $patient): ?TreatmentPlan
    {
        return $patient->treatmentPlans()
            ->with('treatmentPlanMedications.medication')
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderByDesc('start_date')
            ->first();
    }

    /** @return Collection<int, TreatmentPlanMedication> */
    public function regimenMedications(?TreatmentPlan $plan): Collection
    {
        if (! $plan) {
            return collect();
        }

        // Stable order: the first prescribed medicine is the one a combined
        // daily intake is logged against.
        return $plan->treatmentPlanMedications->sortBy('id')->values();
    }

    /**
     * The prescribed medicine a dose is logged against. Never trusts the id
     * from the phone: it must be one of this patient's current medicines.
     */
    public function resolvePivot(Patient $patient, ?int $pivotId): ?TreatmentPlanMedication
    {
        $medications = $this->regimenMedications($this->activePlan($patient));

        return $pivotId !== null
            ? $medications->firstWhere('id', $pivotId)
            : $medications->first();
    }

    /** The existing row for this patient + medicine + day, if any. */
    public function findLog(Patient $patient, TreatmentPlanMedication $pivot, CarbonImmutable $scheduledDate): ?MedicationLog
    {
        // whereDate rather than `=`: the `date` cast writes a full datetime,
        // which MySQL's DATE column truncates but SQLite keeps — a string match
        // would miss and try to insert a duplicate of that day's row.
        return MedicationLog::query()
            ->where('patient_id', $patient->id)
            ->where('treatment_plan_medication_id', $pivot->id)
            ->whereDate('scheduled_date', $scheduledDate->toDateString())
            ->first();
    }

    /**
     * Create or update the day's row with the patient's report. Not saved —
     * the caller adds its own fields and saves (inside its transaction).
     *
     * @param  array{scheduled_time: string, taken_at?: string|null, status?: string|null, dose_quantity?: string|null, notes?: string|null}  $data
     */
    public function fillLog(
        Patient $patient,
        TreatmentPlanMedication $pivot,
        CarbonImmutable $scheduledDate,
        array $data,
    ): MedicationLog {
        $log = $this->findLog($patient, $pivot, $scheduledDate) ?? new MedicationLog([
            'patient_id' => $patient->id,
            'treatment_plan_medication_id' => $pivot->id,
        ]);

        $takenAt = ! empty($data['taken_at'])
            ? CarbonImmutable::parse($data['taken_at'])->setTimezone(config('app.timezone'))
            : CarbonImmutable::now();

        $log->fill([
            'scheduled_date' => $scheduledDate->toDateString(),
            'scheduled_time' => $data['scheduled_time'].':00',
            'taken_at' => $takenAt,
            'status' => $data['status'] ?? $this->statusFor($takenAt, $scheduledDate, $data['scheduled_time']),
            'dose_quantity' => $data['dose_quantity'] ?? $log->dose_quantity,
            'notes' => $data['notes'] ?? $log->notes,
        ]);

        return $log;
    }

    /**
     * A dose is late once it lands more than the grace period (Settings →
     * Clinical rules → late-dose threshold) after the scheduled time.
     */
    public function statusFor(CarbonImmutable $takenAt, CarbonImmutable $scheduledDate, string $scheduledTime): string
    {
        $scheduled = CarbonImmutable::parse(
            $scheduledDate->toDateString().' '.$scheduledTime,
            config('app.timezone'),
        );

        return $takenAt->greaterThan($scheduled->addMinutes(AppSettings::int('clinical.late_dose_threshold_minutes', 120)))
            ? 'late'
            : 'taken';
    }
}
