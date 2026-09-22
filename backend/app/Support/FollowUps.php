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
            // Resolve reschedule chains: the hub reschedules from the date it
            // currently displays, so a follow-up moved twice quotes the first
            // move's output, not the original anchor.
            $effective = CarbonImmutable::parse(self::resolveChain($key, $overrides));
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
     * Latest reschedule wins per quoted date.
     *
     * The map is keyed by the date a reschedule row replaces — usually the
     * plan's original anchor, but after a first reschedule it can be the
     * previously rescheduled date the hub was displaying. Chains are resolved
     * per anchor by {@see resolveChain()}.
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

    /**
     * Follow a reschedule chain to the date it currently resolves to.
     *
     * A follow-up moved from Sep 1 to Sep 15 and then again from Sep 15 to
     * Sep 22 leaves two rows: Sep 1 → Sep 15 and Sep 15 → Sep 22. Walking the
     * map from the anchor follows the quotes to the latest agreed date; the
     * `$seen` guard keeps a pathological cycle of rows from looping forever.
     *
     * @param  Collection<string, string>  $overrides
     */
    private static function resolveChain(string $date, Collection $overrides): string
    {
        $current = $date;
        $seen = [$date => true];

        while (($next = $overrides->get($current)) !== null && ! isset($seen[$next])) {
            $seen[$next] = true;
            $current = $next;
        }

        return $current;
    }
}
