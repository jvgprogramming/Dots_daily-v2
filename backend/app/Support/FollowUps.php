<?php

namespace App\Support;

use App\Models\FollowUpReschedule;
use App\Models\TreatmentPlan;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * The one definition of a follow-up schedule, shared by the admin treatments
 * hub and the patient's mobile app.
 *
 * Follow-up dates are derived live as monthly anniversaries of the plan's
 * `start_date` between start and `expected_end_date`; rows in
 * `follow_up_reschedules` override their original anchor. No duplicated
 * schedule storage — the plan is the source of truth, exactly as on the web.
 */
final class FollowUps
{
    /** Follow-ups due within this window are "due soon". */
    public const DUE_SOON_DAYS = 14;

    /**
     * The next follow-up for a plan with its state, or null when there is none
     * (inactive plan, undated plan, or nothing left to attend).
     *
     * Status: `overdue` → a follow-up date already passed this window without
     * being rescheduled; `due` → within DUE_SOON_DAYS; else `scheduled`.
     *
     * @param  iterable<int, FollowUpReschedule>|null  $planReschedules  pre-fetched reschedules for this plan; queried when null
     * @return array{date: ?string, status: string}|null
     */
    public static function nextFor(TreatmentPlan $plan, ?CarbonImmutable $today = null, ?iterable $planReschedules = null): ?array
    {
        $today ??= CarbonImmutable::today();

        if ($plan->status !== 'active') {
            return null;
        }

        if ($plan->start_date === null || $plan->expected_end_date === null) {
            return null;
        }

        $start = CarbonImmutable::parse($plan->start_date);
        $end = CarbonImmutable::parse($plan->expected_end_date);
        if ($start->gt($end)) {
            return null;
        }

        // Latest reschedule wins per original anchor date. Queried directly —
        // the model has no hasMany relation, and the hub pre-fetches its rows
        // in bulk to avoid N+1.
        $overrides = self::overrides(
            $planReschedules ?? FollowUpReschedule::query()
                ->where('treatment_plan_id', $plan->id)
                ->orderByDesc('id')
                ->get()
                ->all(),
        );

        $anchors = [];
        for ($d = $start->copy(); $d->lte($end); $d = $d->addMonth()) {
            $key = $d->toDateString();
            $effective = $overrides->has($key) ? CarbonImmutable::parse($overrides->get($key)) : $d;
            $anchors[] = ['original' => $key, 'date' => $effective];
        }
        if ($anchors === []) {
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

    /**
     * Latest reschedule wins per original anchor date.
     *
     * @param  iterable<int, FollowUpReschedule>  $reschedules
     * @return Collection<string, string>
     */
    private static function overrides(iterable $reschedules): Collection
    {
        $rows = is_array($reschedules) ? collect($reschedules) : $reschedules;

        return collect($rows)
            ->sortByDesc('id')
            ->groupBy(fn (FollowUpReschedule $r) => $r->original_date->toDateString())
            ->map(fn ($group) => $group->first()->new_date->toDateString());
    }
}
