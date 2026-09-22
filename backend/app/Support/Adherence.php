<?php

namespace App\Support;

use App\Models\MedicationLog;
use App\Models\TreatmentPlan;
use Carbon\CarbonImmutable;

/**
 * The one definition of adherence, shared by the mobile app, the admin
 * dashboard, the reports and the monitoring calendar.
 *
 * Adherence answers a single question — "how well has this patient kept up with
 * their medicine?" — so it is a ratio of *days*, not of database rows:
 *
 *     days a dose was actually taken  ÷  days a dose was expected
 *
 * The expected days span the treatment window (plan start → min(today, plan
 * end)), so a day the patient never logged counts against them exactly like a
 * day recorded as `missed`. Dividing by recorded rows instead — which is what
 * this used to do — let a patient who simply stopped logging score 100%.
 *
 * A patient with no treatment plan falls back to their own recorded days, so
 * missing plan data never invents an adherence figure.
 */
final class Adherence
{
    /** A dose the patient took, even if it was late. */
    public static function countsAsTaken(?string $status): bool
    {
        return in_array($status, ['taken', 'late'], true);
    }

    /**
     * Expected dose-days per patient within [$from, $to], as a set of 'Y-m-d'
     * keys. Days after today are never expected.
     *
     * @param  array<int, int|string>  $patientIds
     * @param  array<int, array<string, string>>|null  $loggedSets  reuse an existing {@see loggedDaySets()} result
     * @return array<int, array<string, true>>
     */
    public static function expectedDaySets(
        array $patientIds,
        CarbonImmutable $from,
        CarbonImmutable $to,
        ?array $loggedSets = null,
    ): array {
        $ids = array_values(array_map('intval', $patientIds));
        if ($ids === []) {
            return [];
        }

        $loggedSets ??= self::loggedDaySets($ids, $from, $to);
        $today = CarbonImmutable::today();
        $sets = [];

        $plans = TreatmentPlan::query()
            ->whereIn('patient_id', $ids)
            ->get(['patient_id', 'start_date', 'expected_end_date', 'actual_end_date', 'status']);

        foreach ($plans as $plan) {
            if ($plan->start_date === null) {
                continue;
            }

            $start = CarbonImmutable::parse($plan->start_date);
            $end = $plan->actual_end_date
                ? CarbonImmutable::parse($plan->actual_end_date)
                : ($plan->expected_end_date
                    ? CarbonImmutable::parse($plan->expected_end_date)
                    : $today);

            // An active plan has not run past today yet.
            if ($plan->status === 'active') {
                $end = $end->min($today);
            }

            $windowStart = $start->max($from);
            $windowEnd = $end->min($to);

            if ($windowStart->gt($windowEnd)) {
                continue;
            }

            $patientId = (int) $plan->patient_id;
            for ($day = $windowStart; $day->lte($windowEnd); $day = $day->addDay()) {
                $sets[$patientId][$day->toDateString()] = true;
            }
        }

        // No plan to schedule from → the patient is only accountable for the days
        // we actually recorded, which is the pre-existing behaviour.
        foreach ($ids as $id) {
            if (! isset($sets[$id])) {
                $sets[$id] = array_fill_keys(array_keys($loggedSets[$id] ?? []), true);
            }
        }

        return $sets;
    }

    /**
     * The treatment window per patient — plan start → scheduled end, future
     * days *included* — mapped as 'Y-m-d' => true, ready for {@see summarize()}.
     *
     * This is the basis for every headline adherence figure (admin dashboard,
     * reports, treatments hub, the patient's app): a course of TB treatment is
     * judged over the whole regimen, not from the first log to the last. The
     * scheduled end is the actual end for a concluded plan, else the expected
     * end — so a patient two months into a six-month course at perfect
     * adherence sits at ~33% and climbs as the course is completed.
     *
     * A patient without a plan falls back to their own recorded days, so
     * missing plan data never invents a figure.
     *
     * @param  array<int, int|string>  $patientIds
     * @return array<int, array<string, true>>
     */
    public static function planWindowDaySets(array $patientIds): array
    {
        $ids = array_values(array_map('intval', $patientIds));
        if ($ids === []) {
            return [];
        }

        $today = CarbonImmutable::today();
        $sets = [];
        $plannedIds = [];

        $plans = TreatmentPlan::query()
            ->whereIn('patient_id', $ids)
            ->get(['patient_id', 'start_date', 'expected_end_date', 'actual_end_date']);

        foreach ($plans as $plan) {
            if ($plan->start_date === null) {
                continue;
            }

            $start = CarbonImmutable::parse($plan->start_date);
            // No expected end recorded → the best we can judge is up to today.
            $end = $plan->actual_end_date
                ? CarbonImmutable::parse($plan->actual_end_date)
                : ($plan->expected_end_date
                    ? CarbonImmutable::parse($plan->expected_end_date)
                    : $today);

            if ($start->gt($end)) {
                continue;
            }

            $patientId = (int) $plan->patient_id;
            $plannedIds[$patientId] = true;
            for ($day = $start; $day->lte($end); $day = $day->addDay()) {
                $sets[$patientId][$day->toDateString()] = true;
            }
        }

        // No plan to schedule from → only the days we actually recorded.
        $unplannedIds = array_diff($ids, array_keys($plannedIds));
        if ($unplannedIds !== []) {
            $earliestLog = MedicationLog::query()
                ->whereIn('patient_id', $unplannedIds)
                ->min('scheduled_date');

            $logged = self::loggedDaySets(
                $unplannedIds,
                $earliestLog ? CarbonImmutable::parse($earliestLog) : $today,
                $today,
            );
            foreach ($unplannedIds as $id) {
                $sets[$id] = array_fill_keys(array_keys($logged[$id] ?? []), true);
            }
        }

        return $sets;
    }

    /**
     * Adherence over each patient's full scheduled course, ready-made:
     * expected days from {@see planWindowDaySets()} plus the doses actually
     * logged within them (a day recorded `missed` counts against the patient,
     * exactly as in {@see summarize()}).
     *
     * @param  array<int, int|string>  $patientIds
     * @return array{expected: array<int, array<string, true>>, logged: array<int, array<string, string>>, summary: array{expected: int, taken: int, rate: float|null}}
     */
    public static function planWindowSummary(array $patientIds): array
    {
        $ids = array_values(array_map('intval', $patientIds));
        $expectedSets = self::planWindowDaySets($ids);

        $starts = [];
        foreach ($expectedSets as $days) {
            foreach (array_keys($days) as $date) {
                $starts[] = $date;
            }
        }

        $today = CarbonImmutable::today();
        $loggedSets = $starts === []
            ? []
            : self::loggedDaySets($ids, CarbonImmutable::parse(min($starts)), $today);

        return [
            'expected' => $expectedSets,
            'logged' => $loggedSets,
            'summary' => self::summarize($expectedSets, $loggedSets),
        ];
    }

    /**
     * Recorded dose-days per patient, mapping 'Y-m-d' => status. Every status is
     * returned (including `missed`) so callers can split them. A day with any
     * taken dose is a taken day, even if another row that day says `missed`.
     *
     * @param  array<int, int|string>  $patientIds
     * @return array<int, array<string, string>>
     */
    public static function loggedDaySets(
        array $patientIds,
        CarbonImmutable $from,
        CarbonImmutable $to,
    ): array {
        $ids = array_values(array_map('intval', $patientIds));
        if ($ids === []) {
            return [];
        }

        $rows = MedicationLog::query()
            ->whereIn('patient_id', $ids)
            ->whereDate('scheduled_date', '>=', $from->toDateString())
            ->whereDate('scheduled_date', '<=', $to->toDateString())
            ->get(['patient_id', 'scheduled_date', 'status']);

        $sets = [];
        foreach ($rows as $row) {
            $patientId = (int) $row->patient_id;
            $date = $row->scheduled_date->toDateString();
            $status = $row->status;

            if (! isset($sets[$patientId][$date]) || self::countsAsTaken($status)) {
                $sets[$patientId][$date] = $status;
            }
        }

        return $sets;
    }

    /**
     * Roll day sets up into a single figure.
     *
     * @param  array<int, array<string, true>>  $expectedSets
     * @param  array<int, array<string, string>>  $loggedSets
     * @return array{expected: int, taken: int, rate: float|null}
     */
    public static function summarize(array $expectedSets, array $loggedSets): array
    {
        $expected = 0;
        $taken = 0;

        foreach ($expectedSets as $patientId => $days) {
            foreach (array_keys($days) as $date) {
                $expected++;
                if (self::countsAsTaken($loggedSets[$patientId][$date] ?? null)) {
                    $taken++;
                }
            }
        }

        return ['expected' => $expected, 'taken' => $taken, 'rate' => self::rate($taken, $expected)];
    }

    /** Taken days ÷ expected days, as a percentage. Null when nothing was expected. */
    public static function rate(int $taken, int $expected): ?float
    {
        return $expected > 0 ? round(($taken / $expected) * 100, 1) : null;
    }
}
