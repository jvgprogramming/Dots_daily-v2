<?php

namespace App\Http\Controllers\API;

use App\Models\FollowUpReschedule;
use App\Models\MedicationLog;
use App\Models\TreatmentPlan;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Treatments hub — the clinical operations area for admins.
 *
 * Single source of truth, no duplicated schedule storage:
 *   TreatmentPlan       → treatment records, phases, statuses
 *   MedicationLog       → adherence per plan (taken / late / missed)
 *   FollowUpReschedule  → audit of rescheduled follow-ups (only new storage)
 *
 * Follow-up dates are derived live as monthly anchors between the plan's
 * start_date and expected_end_date; reschedule records override anchors.
 */
class TreatmentsController extends BaseApiController
{
    /** Follow-ups due within this window are "due soon". */
    private const DUE_SOON_DAYS = 14;

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', 'in:all,active,due_soon,rescheduled,completed'],
        ]);

        $search = trim($data['search'] ?? '');
        $statusFilter = $data['status'] ?? 'all';
        $today = CarbonImmutable::today();

        // ── Treatment plans (the source of truth for records) ────────────
        $plansQuery = TreatmentPlan::query()
            ->with(['patient.user', 'treatmentPlanMedications'])
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderByDesc('start_date');

        if ($search !== '') {
            $plansQuery->whereHas('patient', function ($q) use ($search) {
                $q->where(function ($qq) use ($search) {
                    $qq->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%");
                })->orWhereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$search}%"));
            });
        }

        $plans = $plansQuery->limit(300)->get();

        // ── Adherence per plan (live from medication logs) ───────────────
        $tpmIds = $plans->flatMap(fn (TreatmentPlan $p) => $p->treatmentPlanMedications->pluck('id'));

        $adherence = MedicationLog::query()
            ->selectRaw("treatment_plan_medication_id,
                SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken,
                SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late,
                SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed")
            ->whereIn('treatment_plan_medication_id', $tpmIds)
            ->groupBy('treatment_plan_medication_id')
            ->get()
            ->keyBy('treatment_plan_medication_id');

        // ── Reschedule audit per plan (avoids N+1 in anchor derivation) ──
        $reschedulesByPlan = FollowUpReschedule::query()
            ->whereIn('treatment_plan_id', $plans->pluck('id'))
            ->orderByDesc('id')
            ->get()
            ->groupBy('treatment_plan_id');

        // ── Build unified record rows ────────────────────────────────────
        $records = $plans->map(function (TreatmentPlan $plan) use ($adherence, $reschedulesByPlan, $today) {
            $patient = $plan->patient;
            $name = $patient
                ? (trim(($patient->first_name ?? '') . ' ' . ($patient->last_name ?? '')) ?: ($patient->user?->name ?? 'Unnamed patient'))
                : 'Unknown patient';

            $planReschedules = $reschedulesByPlan->get($plan->id) ?? collect();
            $followUp = $this->followUpInfo($plan, $today, $planReschedules);

            $taken = 0;
            $late = 0;
            $missed = 0;
            foreach ($plan->treatmentPlanMedications as $tpm) {
                $row = $adherence->get($tpm->id);
                if ($row) {
                    $taken += (int) $row->taken;
                    $late += (int) $row->late;
                    $missed += (int) $row->missed;
                }
            }
            $totalDoses = $taken + $late + $missed;
            $adherenceRate = $totalDoses > 0 ? round((($taken + $late) / $totalDoses) * 100, 1) : null;

            $lastReschedule = $planReschedules->first();

            // Record status (drives the filter chips)
            $recordStatus = $plan->status;
            if ($plan->status === 'active') {
                if ($lastReschedule !== null) {
                    $recordStatus = 'rescheduled';
                } elseif ($followUp !== null && $followUp['status'] === 'due') {
                    $recordStatus = 'due_soon';
                }
            }

            return [
                'id' => $plan->id,
                'patient_id' => $plan->patient_id,
                'patient_name' => $name,
                'plan_name' => $plan->plan_name,
                'regimen_type' => $plan->regimen_type,
                'regimen_type_end' => $plan->regimen_type_end,
                'outcome' => $plan->outcome,
                'outcome_date' => $plan->outcome_date?->toDateString(),
                'outcome_reason' => $plan->outcome_reason,
                'notes' => $plan->notes,
                'phase' => $plan->phase,
                'status' => $plan->status,
                'record_status' => $recordStatus,
                'start_date' => $plan->start_date?->toDateString(),
                'expected_end_date' => $plan->expected_end_date?->toDateString(),
                'actual_end_date' => $plan->actual_end_date?->toDateString(),
                'next_follow_up' => $followUp['date'] ?? null,
                'next_follow_up_status' => $followUp['status'] ?? 'none',
                'last_reschedule' => $lastReschedule ? [
                    'id' => $lastReschedule->id,
                    'original_date' => $lastReschedule->original_date->toDateString(),
                    'new_date' => $lastReschedule->new_date->toDateString(),
                    'reason' => $lastReschedule->reason,
                    'notes' => $lastReschedule->notes,
                ] : null,
                'adherence' => [
                    'rate' => $adherenceRate,
                    'taken' => $taken,
                    'late' => $late,
                    'missed' => $missed,
                    'total' => $totalDoses,
                ],
                'medications_count' => $plan->treatmentPlanMedications->count(),
            ];
        });

        // ── Filter by chip ───────────────────────────────────────────────
        $filtered = $statusFilter === 'all'
            ? $records->values()
            : $records->filter(fn ($r) => $r['record_status'] === $statusFilter)->values();

        // ── Follow-up schedule (active plans with a next visit) ──────────
        $followUps = $records
            ->filter(fn ($r) => $r['status'] === 'active' && $r['next_follow_up'] !== null)
            ->sortBy('next_follow_up')
            ->values();

        // ── Overview summary ─────────────────────────────────────────────
        $allDoses = (int) $records->sum(fn ($r) => $r['adherence']['total']);
        $allTaken = (int) $records->sum(fn ($r) => $r['adherence']['taken']);
        $allLate = (int) $records->sum(fn ($r) => $r['adherence']['late']);

        return $this->success(data: [
            'summary' => [
                'active_plans' => $records->where('status', 'active')->count(),
                'due_follow_ups' => $followUps->filter(fn ($r) => $r['next_follow_up_status'] === 'due')->count(),
                'overdue_follow_ups' => $followUps->filter(fn ($r) => $r['next_follow_up_status'] === 'overdue')->count(),
                'rescheduled_cases' => $records->where('record_status', 'rescheduled')->count(),
                'completed_plans' => $records->where('status', 'completed')->count(),
                'adherence_rate' => $allDoses > 0 ? round((($allTaken + $allLate) / $allDoses) * 100, 1) : null,
                'total_records' => $records->count(),
            ],
            'records' => $filtered,
            'follow_ups' => $followUps->slice(0, 50)->values(),
        ], message: 'Treatment hub data retrieved successfully.');
    }

    /**
     * Treatment lifecycle update on the EXISTING plan record (no duplicates).
     *
     * Accepts partial updates: current regimen/phase/status, regimen at end,
     * outcome (+ date/reason), progression notes, and appends new lab tests
     * as NEW LaboratoryTest entries (never rewriting registration-era labs).
     * If the plan completes with an outcome, actual_end_date is stamped.
     */
    public function updateTreatment(Request $request, TreatmentPlan $plan): JsonResponse
    {
        $data = $request->validate([
            'regimen_type' => ['sometimes', 'nullable', 'string', 'max:50'],
            'regimen_type_end' => ['sometimes', 'nullable', 'string', 'max:50'],
            'phase' => ['sometimes', 'nullable', 'string', 'in:intensive,continuation'],
            'status' => ['sometimes', 'nullable', 'string', 'in:active,completed,discontinued,interrupted'],
            'outcome' => ['sometimes', 'nullable', 'string', 'in:cured,treatment_completed,died,failed,lost_to_followup'],
            'outcome_date' => ['sometimes', 'nullable', 'date'],
            'outcome_reason' => ['sometimes', 'nullable', 'string', 'max:255'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],

            // Appended as new lab entries for the same patient
            'new_lab_tests' => ['sometimes', 'array'],
            'new_lab_tests.*.test_type' => ['required_with:new_lab_tests', 'string', 'max:50'],
            'new_lab_tests.*.test_name' => ['nullable', 'string', 'max:255'],
            'new_lab_tests.*.test_date' => ['nullable', 'date'],
            'new_lab_tests.*.result' => ['nullable', 'string', 'max:255'],
            'new_lab_tests.*.status' => ['nullable', 'string', 'in:done,not_available,not_yet_done'],
            'new_lab_tests.*.remarks' => ['nullable', 'string', 'max:500'],
        ]);

        $plan = DB::transaction(function () use ($data, $plan, $request) {
            $planFields = collect($data)
                ->only(['regimen_type', 'regimen_type_end', 'phase', 'status', 'outcome', 'outcome_date', 'outcome_reason', 'notes'])
                ->all();

            // `phase` is NOT NULL — a null phase means "no change" and the last
            // recorded phase is kept as history (e.g. when discontinuing).
            if (($planFields['phase'] ?? null) === null) {
                unset($planFields['phase']);
            }

            if (!empty($planFields)) {
                $plan->update($planFields);
            }

            // Outcome recorded → completion date follows the outcome date
            if (array_key_exists('outcome', $data) && $data['outcome']) {
                $plan->update([
                    'actual_end_date' => $data['outcome_date'] ?? CarbonImmutable::today()->toDateString(),
                ]);
            }

            // Append new lab tests as NEW rows (append-only, keeps intake labs intact)
            foreach ($data['new_lab_tests'] ?? [] as $lab) {
                $plan->patient->laboratoryTests()->create([
                    'test_type' => $lab['test_type'],
                    'test_name' => $lab['test_name'] ?? null,
                    'test_date' => $lab['test_date'] ?? null,
                    'result' => $lab['result'] ?? null,
                    'status' => $lab['status'] ?? 'done',
                    'remarks' => $lab['remarks'] ?? null,
                ]);
            }

            return $plan;
        });

        $plan->load(['patient.user', 'treatmentPlanMedications']);

        // Return the same record shape the hub uses so the UI can refresh in place
        $today = CarbonImmutable::today();
        $planReschedules = FollowUpReschedule::where('treatment_plan_id', $plan->id)->orderByDesc('id')->get();
        $followUp = $this->followUpInfo($plan, $today, $planReschedules);

        $taken = (int) MedicationLog::whereHas('treatmentPlanMedication', fn ($q) => $q->where('treatment_plan_id', $plan->id))->where('status', 'taken')->count();
        $late = (int) MedicationLog::whereHas('treatmentPlanMedication', fn ($q) => $q->where('treatment_plan_id', $plan->id))->where('status', 'late')->count();
        $missed = (int) MedicationLog::whereHas('treatmentPlanMedication', fn ($q) => $q->where('treatment_plan_id', $plan->id))->where('status', 'missed')->count();
        $totalDoses = $taken + $late + $missed;

        $record = [
            'id' => $plan->id,
            'patient_id' => $plan->patient_id,
            'patient_name' => trim(($plan->patient->first_name ?? '') . ' ' . ($plan->patient->last_name ?? '')) ?: ($plan->patient->user?->name ?? 'Unnamed patient'),
            'plan_name' => $plan->plan_name,
            'regimen_type' => $plan->regimen_type,
            'regimen_type_end' => $plan->regimen_type_end,
            'outcome' => $plan->outcome,
            'outcome_date' => $plan->outcome_date?->toDateString(),
            'outcome_reason' => $plan->outcome_reason,
            'phase' => $plan->phase,
            'status' => $plan->status,
            'record_status' => $plan->status,
            'start_date' => $plan->start_date?->toDateString(),
            'expected_end_date' => $plan->expected_end_date?->toDateString(),
            'actual_end_date' => $plan->actual_end_date?->toDateString(),
            'next_follow_up' => $followUp['date'] ?? null,
            'next_follow_up_status' => $followUp['status'] ?? 'none',
            'adherence' => [
                'rate' => $totalDoses > 0 ? round((($taken + $late) / $totalDoses) * 100, 1) : null,
                'taken' => $taken,
                'late' => $late,
                'missed' => $missed,
                'total' => $totalDoses,
            ],
            'medications_count' => $plan->treatmentPlanMedications->count(),
            'notes' => $plan->notes,
            'new_labs_count' => count($data['new_lab_tests'] ?? []),
        ];

        return $this->success(data: ['record' => $record], message: 'Treatment updated successfully.');
    }

    /**
     * Reschedule a follow-up for a treatment plan.
     *
     * Records an audit row (patient, plan, current date, reason, new date,
     * actor). The hub and reports derive the schedule from the plan anchors
     * with these records applied — no duplicated schedule storage.
     */
    public function rescheduleFollowUp(Request $request, TreatmentPlan $plan): JsonResponse
    {
        $data = $request->validate([
            'current_date' => ['required', 'date'],
            'new_date' => ['required', 'date', 'after_or_equal:today'],
            'reason' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $reschedule = DB::transaction(function () use ($data, $plan, $request) {
            return FollowUpReschedule::create([
                'treatment_plan_id' => $plan->id,
                'patient_id' => $plan->patient_id,
                'original_date' => CarbonImmutable::parse($data['current_date'])->toDateString(),
                'new_date' => CarbonImmutable::parse($data['new_date'])->toDateString(),
                'rescheduled_at' => CarbonImmutable::today()->toDateString(),
                'reason' => $data['reason'] ?? null,
                'notes' => $data['notes'] ?? null,
                'rescheduled_by' => $request->user()?->id,
            ]);
        });

        return $this->success(data: [
            'id' => $reschedule->id,
            'treatment_plan_id' => $plan->id,
            'patient_id' => $plan->patient_id,
            'original_date' => $reschedule->original_date->toDateString(),
            'new_date' => $reschedule->new_date->toDateString(),
            'reason' => $reschedule->reason,
            'notes' => $reschedule->notes,
        ], message: 'Follow-up rescheduled successfully.');
    }

    /**
     * Next follow-up for a plan with its state.
     *
     * Anchors are monthly anniversaries of start_date within the treatment
     * window. A reschedule record replaces its original anchor with the new
     * date. Status: overdue → a follow-up date already passed this window
     * without being rescheduled; due → within DUE_SOON_DAYS; else scheduled.
     */
    private function followUpInfo(TreatmentPlan $plan, CarbonImmutable $today, Collection $planReschedules): ?array
    {
        if ($plan->status !== 'active') {
            return null;
        }

        $start = CarbonImmutable::parse($plan->start_date);
        $end = CarbonImmutable::parse($plan->expected_end_date);
        if ($start->gt($end)) {
            return null;
        }

        // Latest reschedule wins per original anchor date
        $overrides = $planReschedules
            ->groupBy(fn (FollowUpReschedule $r) => $r->original_date->toDateString())
            ->map(fn ($group) => $group->first()->new_date->toDateString());

        $anchors = [];
        for ($d = $start->copy(); $d->lte($end); $d = $d->addMonth()) {
            $key = $d->toDateString();
            $effective = $overrides->has($key) ? CarbonImmutable::parse($overrides->get($key)) : $d;
            $anchors[] = ['original' => $key, 'date' => $effective];
        }
        if (empty($anchors)) {
            return null;
        }

        // Next upcoming follow-up
        $upcoming = collect($anchors)
            ->filter(fn (array $a) => $a['date']->gte($today))
            ->sortBy(fn (array $a) => $a['date']->toDateString())
            ->first();

        // Overdue rule: any follow-up anchor (effective date) strictly before
        // today, excluding the baseline start anchor itself (treatment start
        // day is not a follow-up visit).
        $baseline = $start->toDateString();
        $hasOverdue = collect($anchors)->contains(
            fn (array $a) => $a['date']->lt($today)
                && $a['original'] !== $baseline
        );

        if ($upcoming === null) {
            return $hasOverdue
                ? ['date' => null, 'status' => 'overdue']
                : null;
        }

        $status = 'scheduled';
        if ($hasOverdue) {
            $status = 'overdue';
        } elseif ($upcoming['date']->lte($today->addDays(self::DUE_SOON_DAYS))) {
            $status = 'due';
        }

        return ['date' => $upcoming['date']->toDateString(), 'status' => $status];
    }
}
