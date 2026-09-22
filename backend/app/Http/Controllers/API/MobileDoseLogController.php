<?php

namespace App\Http\Controllers\API;

use App\Models\MedicationLog;
use App\Models\Patient;
use App\Models\TreatmentPlan;
use App\Models\TreatmentPlanMedication;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

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
 * Verification: `medication_logs` has no "verified" column. A row counts as
 * verified once a DOTS observer confirmed it (`observed_by`), which is exactly
 * the green/pending split the app's calendar draws.
 */
class MobileDoseLogController extends BaseApiController
{
    /** Grace period after the scheduled time before a dose counts as late. */
    private const LATE_AFTER_MINUTES = 120;

    /** Safety cap on the history payload the calendar hydrates from. */
    private const MAX_HISTORY = 400;

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

        $plan = $this->activePlan($patient);
        $medications = $this->regimenMedications($plan);
        $primary = $medications->first();

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
            ->with('treatmentPlanMedication.medication')
            ->orderByDesc('scheduled_date')
            ->orderByDesc('id');

        if (isset($data['from'])) {
            $query->where('scheduled_date', '>=', $data['from']);
        }
        if (isset($data['to'])) {
            $query->where('scheduled_date', '<=', $data['to']);
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
    public function store(Request $request): JsonResponse
    {
        $patient = $request->user()?->patient;

        if (! $patient) {
            return $this->error('This account is not linked to a patient profile.', 403);
        }

        $data = $request->validate([
            'scheduled_date' => ['required', 'date_format:Y-m-d'],
            'scheduled_time' => ['required', 'date_format:H:i'],
            'taken_at' => ['nullable', 'date'],
            'status' => ['nullable', 'in:taken,late,missed,skipped'],
            'dose_quantity' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'treatment_plan_medication_id' => ['nullable', 'integer'],
        ]);

        $medications = $this->regimenMedications($this->activePlan($patient));

        // Never trust the id from the phone: it must be one of this patient's
        // currently prescribed medicines.
        $pivot = isset($data['treatment_plan_medication_id'])
            ? $medications->firstWhere('id', (int) $data['treatment_plan_medication_id'])
            : $medications->first();

        if (! $pivot) {
            return $this->error(
                'No active treatment regimen is assigned to this patient yet, so a dose cannot be logged.',
                409,
            );
        }

        $scheduledDate = CarbonImmutable::parse($data['scheduled_date'], config('app.timezone'));
        $takenAt = isset($data['taken_at'])
            ? CarbonImmutable::parse($data['taken_at'])->setTimezone(config('app.timezone'))
            : CarbonImmutable::now();

        // Matched with whereDate rather than a raw `=` comparison: the model's
        // `date` cast writes a full datetime, which a DATE column truncates on
        // MySQL but quietly keeps on SQLite — so a plain string match would miss
        // and try to insert a duplicate of that day's row.
        $log = MedicationLog::query()
            ->where('patient_id', $patient->id)
            ->where('treatment_plan_medication_id', $pivot->id)
            ->whereDate('scheduled_date', $scheduledDate->toDateString())
            ->first();

        $log ??= new MedicationLog([
            'patient_id' => $patient->id,
            'treatment_plan_medication_id' => $pivot->id,
        ]);

        $log->fill([
            'scheduled_date' => $scheduledDate->toDateString(),
            'scheduled_time' => $data['scheduled_time'].':00',
            'taken_at' => $takenAt,
            'status' => $data['status']
                ?? $this->statusFor($takenAt, $scheduledDate, $data['scheduled_time']),
            'dose_quantity' => $data['dose_quantity'] ?? null,
            'notes' => $data['notes'] ?? null,
        ])->save();

        return $this->success(
            data: $this->formatLog($log->load('treatmentPlanMedication.medication')),
            message: 'Dose logged successfully.',
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────

    /**
     * The patient's current regimen — active plan first, else the latest one.
     */
    private function activePlan(Patient $patient): ?TreatmentPlan
    {
        return $patient->treatmentPlans()
            ->with('treatmentPlanMedications.medication')
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderByDesc('start_date')
            ->first();
    }

    /** @return Collection<int, TreatmentPlanMedication> */
    private function regimenMedications(?TreatmentPlan $plan): Collection
    {
        if (! $plan) {
            return collect();
        }

        // Stable order: the first prescribed medicine is the one a combined
        // daily intake is logged against.
        return $plan->treatmentPlanMedications->sortBy('id')->values();
    }

    /**
     * A dose is late once it lands more than the grace period after the
     * scheduled time; otherwise it is simply taken.
     */
    private function statusFor(
        CarbonImmutable $takenAt,
        CarbonImmutable $scheduledDate,
        string $scheduledTime,
    ): string {
        $scheduled = CarbonImmutable::parse(
            $scheduledDate->toDateString().' '.$scheduledTime,
            config('app.timezone'),
        );

        return $takenAt->greaterThan($scheduled->addMinutes(self::LATE_AFTER_MINUTES))
            ? 'late'
            : 'taken';
    }

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
            // A DOTS observer confirming the dose is what turns a day green.
            'verified' => $log->observed_by !== null,
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
