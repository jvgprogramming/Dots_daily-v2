<?php

namespace App\Http\Controllers\API;

use App\Models\DailyMonitoring;
use App\Models\Medication;
use App\Models\MedicationLog;
use App\Models\Patient;
use App\Models\SymptomLog;
use App\Models\TreatmentPlan;
use App\Support\Adherence;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Dashboard statistics for the admin dashboard.
 *
 * Aggregates live database data — no new storage, reuses existing models:
 *   Patient         → totals, new registrations, drafts
 *   TreatmentPlan   → active treatments, phase distribution, success rate
 *   MedicationLog   → adherence trend + overall adherence rate
 *   DailyMonitoring → follow-up (monitoring) activity
 *   SymptomLog      → pending reviews / critical alerts
 */
class DashboardController extends BaseApiController
{
    public function stats(Request $request): JsonResponse
    {
        $tz = config('app.timezone', 'UTC');
        $now = CarbonImmutable::now($tz);
        $today = $now->toDateString();
        $startOfMonth = $now->startOfMonth()->toDateString();
        $startOfWeek = $now->startOfWeek()->toDateString();
        $sixMonthsAgo = $now->subMonths(5)->startOfMonth()->toDateString();

        // ── KPI cards ────────────────────────────────────────────────
        $totalPatients = Patient::count();
        $newPatientsThisMonth = Patient::whereDate('registered_at', '>=', $startOfMonth)->count();
        $draftPatients = Patient::where('status', 'draft')->count();

        $activeTreatments = TreatmentPlan::where('status', 'active')->count();
        $treatmentsThisWeek = TreatmentPlan::whereDate('created_at', '>=', $startOfWeek)->count();

        // "Pending reviews" = patients whose daily monitoring has gaps this month
        // (active treatment, but monitoring entries missing for scheduled days).
        $activePlanPatientIds = TreatmentPlan::where('status', 'active')->pluck('patient_id')->unique();
        $pendingReviews = DailyMonitoring::query()
            ->whereIn('patient_id', $activePlanPatientIds)
            ->whereDate('recorded_date', '>=', $startOfMonth)
            ->distinct('patient_id')
            ->count('patient_id');

        $criticalAlerts = $this->countCriticalAlerts($activePlanPatientIds, $startOfMonth);

        // ── Medication inventory (new module) ─────────────────────────
        $totalMedicines = Medication::count();
        $totalUnitsInStock = (int) Medication::sum('quantity');
        $lowStockMeds = Medication::where('stock_status', Medication::STOCK_LOW_STOCK)->count();
        $outOfStockMeds = Medication::where('stock_status', Medication::STOCK_OUT_OF_STOCK)->count();
        $expiredMeds = Medication::where('stock_status', Medication::STOCK_EXPIRED)->count();
        $nearingExpiryMeds = Medication::query()
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '>=', $today)
            ->whereDate('expiry_date', '<=', $now->addDays(Medication::NEARING_EXPIRY_DAYS)->toDateString())
            ->count();

        $stockNoteParts = array_filter([
            $lowStockMeds > 0 ? "{$lowStockMeds} low stock" : null,
            $outOfStockMeds > 0 ? "{$outOfStockMeds} out of stock" : null,
            $expiredMeds > 0 ? "{$expiredMeds} expired" : null,
            $nearingExpiryMeds > 0 ? "{$nearingExpiryMeds} nearing expiry" : null,
        ]);

        $stats = [
            [
                'title' => 'Total Patients',
                'value' => $totalPatients,
                'change' => "+{$newPatientsThisMonth} this month",
                'trend' => 'up',
            ],
            [
                'title' => 'Active Treatments',
                'value' => $activeTreatments,
                'change' => "+{$treatmentsThisWeek} this week",
                'trend' => 'up',
            ],
            [
                'title' => 'Pending Reviews',
                'value' => $pendingReviews,
                'change' => "{$draftPatients} drafts waiting",
                'patient_drafts' => $draftPatients,
                'trend' => 'neutral',
                'change_note' => 'Patients with monitoring gaps this month',
            ],
            [
                'title' => 'Critical Alerts',
                'value' => $criticalAlerts,
                'change' => 'urgent attention needed',
                'trend' => 'down',
            ],
            [
                'title' => 'Medicine Inventory',
                'value' => $totalMedicines,
                'change' => "{$totalUnitsInStock} units in stock",
                'trend' => ($outOfStockMeds > 0 || $expiredMeds > 0)
                    ? 'down'
                    : (($lowStockMeds > 0 || $nearingExpiryMeds > 0) ? 'neutral' : 'up'),
                'change_note' => count($stockNoteParts) > 0
                    ? implode(' · ', $stockNoteParts)
                    : 'All items well stocked',
            ],
        ];

        // Patients the clinic can hold to a schedule: anyone with a plan or a log.
        // Used by every adherence figure below.
        $scopePatientIds = MedicationLog::query()->distinct()->pluck('patient_id')
            ->merge(TreatmentPlan::query()->distinct()->pluck('patient_id'))
            ->unique()
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
        $todayDate = CarbonImmutable::parse($today);

        // ── Adherence trend (last 6 months) ──────────────────────────
        // Days taken ÷ days expected — the same definition the patient's app and
        // the reports use (see App\Support\Adherence).
        $adherenceData = [];
        for ($i = 5; $i >= 0; $i--) {
            $monthStart = $now->subMonths($i)->startOfMonth();
            // Never expect doses in the future, so the current month stops today.
            $monthEnd = $now->subMonths($i)->endOfMonth()->min($todayDate);

            $monthLogged = Adherence::loggedDaySets($scopePatientIds, $monthStart, $monthEnd);
            $monthExpected = Adherence::expectedDaySets($scopePatientIds, $monthStart, $monthEnd, $monthLogged);

            $adherenceData[] = [
                'month' => $monthStart->format('M'),
                'rate' => Adherence::summarize($monthExpected, $monthLogged)['rate'] ?? 0,
            ];
        }

        // ── Patient activity (last 7 days: new registrations vs monitoring follow-ups) ──
        $patientActivity = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = $now->subDays($i);
            $patientActivity[] = [
                'day' => $day->format('D'),
                'new' => Patient::whereDate('registered_at', $day->toDateString())->count(),
                'followups' => DailyMonitoring::whereDate('recorded_date', $day->toDateString())->count(),
            ];
        }

        // ── Treatment phase distribution (active plans by phase) ─────
        $phaseCounts = TreatmentPlan::query()
            ->select('phase', DB::raw('count(*) as count'))
            ->whereIn('status', ['active', 'completed'])
            ->groupBy('phase')
            ->pluck('count', 'phase');

        $distribution = [
            ['phase' => 'Intensive', 'key' => 'intensive', 'color' => 'bg-primary-500'],
            ['phase' => 'Continuation', 'key' => 'continuation', 'color' => 'bg-warning'],
            ['phase' => 'Completed', 'key' => 'completed', 'color' => 'bg-primary-700'],
            ['phase' => 'Interrupted', 'key' => 'interrupted', 'color' => 'bg-danger'],
        ];
        $totalForDistribution = max(1, (int) $phaseCounts->sum());
        $treatmentDistribution = array_map(function ($d) use ($phaseCounts, &$totalForDistribution) {
            $count = (int) ($phaseCounts[$d['key']] ?? 0);
            return $d + [
                'count' => $count,
                'percentage' => $count > 0 ? round(($count / $totalForDistribution) * 100) : 0,
            ];
        }, $distribution);

        // ── Recent patients ──────────────────────────────────────────
        $recentPatients = Patient::query()
            ->with('user')
            ->orderByDesc('registered_at')
            ->orderByDesc('created_at')
            ->limit(5)
            ->get()
            ->map(fn (Patient $p) => [
                'id' => $p->id,
                'name' => trim(($p->first_name ?? '') . ' ' . ($p->last_name ?? '')) ?: ($p->user?->name ?? 'Unnamed patient'),
                'health_id_number' => $p->health_id_number,
                'date' => ($p->registered_at ?? $p->created_at)?->format('M d, Y'),
                'status' => $p->status ?? 'registered',
            ]);

        // ── Bottom overview metrics ──────────────────────────────────
        // Overall adherence across every patient in scope, judged over each
        // patient's full scheduled course — plan start → scheduled end, future
        // days included (see App\Support\Adherence::planWindowSummary). A course
        // of TB treatment is months long, so "from first log to today" would
        // flatter patients who joined late and say nothing about the road ahead.
        $overallAdherence = Adherence::planWindowSummary($scopePatientIds)['summary']['rate'];

        // Treatment success = completed (non-interrupted) / all concluded plans
        $concluded = TreatmentPlan::whereIn('status', ['completed', 'discontinued', 'interrupted'])->count();
        $completed = TreatmentPlan::where('status', 'completed')->count();
        $treatmentSuccess = $concluded > 0 ? round(($completed / $concluded) * 100, 1) : null;

        // Follow-up rate = patients with ≥1 monitoring entry / registered patients
        $registeredPatients = Patient::where('status', 'registered')->count();
        $patientsWithFollowups = DailyMonitoring::query()
            ->distinct('patient_id')
            ->count('patient_id');

        return $this->success(data: [
            'stats' => $stats,
            'adherence_trend' => $adherenceData,
            'patient_activity' => $patientActivity,
            'treatment_distribution' => $treatmentDistribution,
            'recent_patients' => $recentPatients,
            'overview' => [
                'adherence_rate' => $overallAdherence,
                'treatment_success' => $treatmentSuccess,
                'follow_up_rate' => $registeredPatients > 0
                    ? round(($patientsWithFollowups / $registeredPatients) * 100, 1)
                    : null,
            ],
            'generated_at' => $now->toIso8601String(),
        ], message: 'Dashboard statistics retrieved successfully.');
    }

    /**
     * Critical alerts for the current month:
     *  - patients with an active plan whose overall adherence fell below 80%
     *  - high-severity symptoms logged this month
     */
    private function countCriticalAlerts($activePlanPatientIds, string $startOfMonth): int
    {
        // High-severity symptoms this month
        $severeSymptoms = SymptomLog::query()
            ->whereIn('patient_id', $activePlanPatientIds)
            ->whereDate('recorded_date', '>=', $startOfMonth)
            ->where('severity', 'severe')
            ->count();

        // Low-adherence patients: fewer than 80% of the days they were expected to
        // take a dose in the last 30 days. Day-based, so a patient who simply
        // stopped logging is flagged instead of looking perfectly adherent.
        $windowEnd = CarbonImmutable::today();
        $windowStart = $windowEnd->subDays(29);
        $ids = collect($activePlanPatientIds)->map(fn ($id) => (int) $id)->values()->all();
        $lowAdherence = 0;

        if ($ids !== []) {
            $loggedSets = Adherence::loggedDaySets($ids, $windowStart, $windowEnd);
            $expectedSets = Adherence::expectedDaySets($ids, $windowStart, $windowEnd, $loggedSets);

            foreach ($expectedSets as $patientId => $days) {
                $expected = count($days);
                if ($expected === 0) {
                    continue;
                }

                $takenDays = 0;
                foreach (array_keys($days) as $date) {
                    if (Adherence::countsAsTaken($loggedSets[$patientId][$date] ?? null)) {
                        $takenDays++;
                    }
                }

                if (($takenDays / $expected) < 0.8) {
                    $lowAdherence++;
                }
            }
        }

        return $severeSymptoms + $lowAdherence;
    }
}
