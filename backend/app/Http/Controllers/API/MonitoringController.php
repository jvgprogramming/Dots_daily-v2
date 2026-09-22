<?php

namespace App\Http\Controllers\API;

use App\Models\DailyMonitoring;
use App\Models\MedicationLog;
use App\Models\Patient;
use App\Support\Adherence;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Patient-centric treatment monitoring data for the admin monitoring calendar.
 *
 * Reuses the existing data model — no new storage:
 *   TreatmentPlan   → timeline anchor (start, expected/actual end, phase, status)
 *   MedicationLog   → per-date adherence (scheduled_date, taken_at, status, notes)
 *   DailyMonitoring → per-date health status (recorded_date, vitals, notes)
 */
class MonitoringController extends BaseApiController
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'required_with:from', 'after_or_equal:from'],
            'date' => ['nullable', 'date'],
        ]);

        $patient = Patient::query()
            ->withCount([
                'treatmentPlans as active_treatments_count' => fn ($q) => $q->where('status', 'active'),
            ])
            ->findOrFail($data['patient_id']);

        // ── Timeline anchor: the treatment plan (active first, then latest) ──
        $plan = $patient->treatmentPlans()
            ->with('medications')
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderByDesc('start_date')
            ->first();

        // ── Date range: defaults to the current calendar month ──
        $from = isset($data['from'])
            ? CarbonImmutable::parse($data['from'])->startOfDay()
            : CarbonImmutable::now()->startOfMonth();
        $to = isset($data['to'])
            ? CarbonImmutable::parse($data['to'])->endOfDay()
            : CarbonImmutable::now()->endOfMonth();

        // ── Medication logs in range ──
        $logs = MedicationLog::query()
            ->where('patient_id', $patient->id)
            ->whereBetween('scheduled_date', [$from->toDateString(), $to->toDateString()])
            ->get();

        // ── Daily monitoring dates in range ──
        $monitoring = DailyMonitoring::where('patient_id', $patient->id)
            ->whereBetween('recorded_date', [$from->toDateString(), $to->toDateString()])
            ->orderBy('recorded_date')
            ->get();

        $monitoringByDate = $monitoring->keyBy(fn (DailyMonitoring $m) => $m->recorded_date->toDateString());

        // ── Selected date for the calendar detail panel ──
        $selectedDate = isset($data['date'])
            ? CarbonImmutable::parse($data['date'])->toDateString()
            : null;

        $doseDetail = null;
        if ($selectedDate !== null) {
            $doseLogs = MedicationLog::query()
                ->where('patient_id', $patient->id)
                ->whereDate('scheduled_date', $selectedDate)
                ->with(['treatmentPlanMedication.medication', 'observedBy'])
                ->orderBy('scheduled_time')
                ->get();

            $doseDetail = $doseLogs->map(fn (MedicationLog $log) => $this->formatDoseLog($log))->values();
        }

        // ── Recent medication history for the History tab ──
        $recentHistory = MedicationLog::query()
            ->where('patient_id', $patient->id)
            ->with(['treatmentPlanMedication.medication'])
            ->orderByDesc('scheduled_date')
            ->orderByDesc('scheduled_time')
            ->orderByDesc('id')
            ->limit(15)
            ->get()
            ->map(fn (MedicationLog $log) => $this->formatDoseLog($log))
            ->values();

        // ── Adherence grouped by date ──
        $adherenceByDate = $logs
            ->groupBy(fn (MedicationLog $log) => $log->scheduled_date->toDateString())
            ->map(function ($dateLogs, $date) use ($monitoringByDate) {
                /** @var \Illuminate\Support\Collection<int, MedicationLog> $dateLogs */
                return [
                    'date' => $date,
                    'total_doses' => $dateLogs->count(),
                    'taken' => $dateLogs->where('status', 'taken')->count(),
                    'missed' => $dateLogs->where('status', 'missed')->count(),
                    'late' => $dateLogs->where('status', 'late')->count(),
                    // Doses taken but not yet confirmed by a DOTS observer. This is
                    // the same "not verified" state the patient's app shows as a
                    // pending day, so both calendars can agree.
                    'pending' => $dateLogs
                        ->whereIn('status', ['taken', 'late'])
                        ->whereNull('observed_by')
                        ->count(),
                    'verified' => $dateLogs
                        ->whereIn('status', ['taken', 'late'])
                        ->whereNotNull('observed_by')
                        ->count(),
                    'daily_monitoring_recorded' => $monitoringByDate->has($date),
                ];
            })
            ->values();

        // ── Range summary ──
        $totalDoses = $logs->count();
        $takenCount = $logs->where('status', 'taken')->count();
        $missedCount = $logs->where('status', 'missed')->count();
        $lateCount = $logs->where('status', 'late')->count();
        $pendingCount = $logs
            ->whereIn('status', ['taken', 'late'])
            ->whereNull('observed_by')
            ->count();
        // ── Adherence = days taken ÷ days expected (plan-aware) ──
        // A day the patient never logged is expected-but-not-taken, exactly like
        // a day recorded `missed`, so a patient cannot score well by going quiet.
        $loggedSets = Adherence::loggedDaySets([$patient->id], $from, $to);
        $expectedSets = Adherence::expectedDaySets([$patient->id], $from, $to, $loggedSets);
        $daySummary = Adherence::summarize($expectedSets, $loggedSets);
        $adherenceRate = $daySummary['rate'];
        $scheduledDays = $daySummary['expected'];
        $daysTaken = $daySummary['taken'];
        $notRecordedDays = max(0, $scheduledDays - count($loggedSets[$patient->id] ?? []));

        // ── Treatment progress + risk indicators ──
        $today = CarbonImmutable::today();
        $progress = null;
        if ($plan) {
            $start = CarbonImmutable::parse($plan->start_date);
            $expectedEnd = CarbonImmutable::parse($plan->expected_end_date);
            $actualEnd = $plan->actual_end_date ? CarbonImmutable::parse($plan->actual_end_date) : null;

            $totalDays = max(1, (int) $start->diffInDays($expectedEnd));
            $elapsed = $today->lt($start) ? 0 : min($totalDays, (int) $start->diffInDays($today));
            $progressPct = $plan->status === 'completed' ? 100 : (int) floor(($elapsed / $totalDays) * 100);
            $daysRemaining = $plan->status === 'completed' ? 0 : max(0, (int) $expectedEnd->diffInDays($today));

            // Risk flags — most severe first
            $risk = 'on_track';
            if ($plan->status === 'discontinued') {
                $risk = 'discontinued';
            } elseif ($plan->status === 'interrupted') {
                $risk = 'interrupted';
            } elseif ($plan->status === 'active' && $expectedEnd->isPast() && $actualEnd === null) {
                $risk = 'overdue';
            } elseif ($plan->status === 'active' && $adherenceRate !== null && $adherenceRate < 80) {
                $risk = 'high_risk';
            } elseif ($plan->status === 'active' && $adherenceRate !== null && $adherenceRate < 90) {
                $risk = 'watch';
            }

            $progress = [
                'start_date' => $start->toDateString(),
                'expected_end_date' => $expectedEnd->toDateString(),
                'actual_end_date' => $plan->actual_end_date?->toDateString(),
                'phase' => $plan->phase,
                'status' => $plan->status,
                'regimen_type' => $plan->regimen_type,
                'plan_name' => $plan->plan_name,
                'total_days' => $totalDays,
                'days_elapsed' => $elapsed,
                'progress_pct' => $progressPct,
                'days_remaining' => $daysRemaining,
                'approaching_end' => $plan->status === 'active' && $daysRemaining > 0 && $daysRemaining <= 14,
                'risk' => $risk,
            ];
        }

        return $this->success(data: [
            'patient' => [
                'id' => $patient->id,
                'name' => trim(($patient->first_name ?? '') . ' ' . ($patient->last_name ?? '')) ?: ($patient->user?->name ?? 'Unnamed patient'),
                'first_name' => $patient->first_name,
                'last_name' => $patient->last_name,
                'status' => $patient->status ?? 'registered',
                'active_treatments_count' => (int) $patient->active_treatments_count,
            ],
            'treatment_plan' => $plan ? [
                'id' => $plan->id,
                'plan_name' => $plan->plan_name,
                'regimen_type' => $plan->regimen_type,
                'phase' => $plan->phase,
                'status' => $plan->status,
                'start_date' => $plan->start_date?->toDateString(),
                'expected_end_date' => $plan->expected_end_date?->toDateString(),
                'actual_end_date' => $plan->actual_end_date?->toDateString(),
                'discontinuation_reason' => $plan->discontinuation_reason,
                'medications_count' => $plan->medications->count(),
                'medications' => $plan->medications->map(fn ($m) => [
                    'id' => $m->id,
                    'name' => $m->name,
                    'dosage' => $m->pivot->dosage,
                    'frequency' => $m->pivot->frequency,
                    'preferred_time' => $m->pivot->preferred_time,
                ]),
            ] : null,
            'adherence_by_date' => $adherenceByDate,
            'selected_date' => $selectedDate,
            'dose_logs' => $doseDetail ?? [],
            'recent_history' => $recentHistory,
            'monitoring_entries' => $monitoring->map(fn (DailyMonitoring $m) => [
                'id' => $m->id,
                'recorded_date' => $m->recorded_date->toDateString(),
                'weight_kg' => $m->weight_kg,
                'temperature_c' => $m->temperature_c,
                'blood_pressure_systolic' => $m->blood_pressure_systolic,
                'blood_pressure_diastolic' => $m->blood_pressure_diastolic,
                'heart_rate_bpm' => $m->heart_rate_bpm,
                'respiratory_rate' => $m->respiratory_rate,
                'oxygen_saturation' => $m->oxygen_saturation,
                'notes' => $m->notes,
            ]),
            'summary' => [
                'adherence_rate' => $adherenceRate,
                // Days a dose was expected vs actually taken — the numbers behind
                // the rate, so the admin never has to guess at the denominator.
                'scheduled_days' => $scheduledDays,
                'days_taken' => $daysTaken,
                'total_doses' => $totalDoses,
                'taken' => $takenCount,
                'missed' => $missedCount,
                'late' => $lateCount,
                'verified' => $takenCount + $lateCount - $pendingCount,
                'pending' => $pendingCount,
                'not_recorded_days' => $notRecordedDays,
                'monitoring_entries_count' => $monitoring->count(),
            ],
            'progress' => $progress,
        ], message: 'Monitoring data retrieved successfully.');
    }

    /**
     * Uniform dose-log shape for the calendar detail panel (Medication,
     * Notes, and History tabs). Reads the live medication_logs rows —
     * no separate storage.
     */
    private function formatDoseLog(MedicationLog $log): array
    {
        $tpm = $log->treatmentPlanMedication;
        $medication = $tpm?->medication;

        return [
            'id' => $log->id,
            'medication_id' => $tpm?->medication_id,
            'medication_name' => $medication?->name ?? 'Unknown medication',
            'strength' => $medication?->strength,
            'dosage' => $tpm?->dosage,
            'dose_quantity' => $log->dose_quantity,
            'scheduled_date' => $log->scheduled_date?->toDateString(),
            'scheduled_time' => $log->scheduled_time,
            'taken_at' => $log->taken_at?->toIso8601String(),
            'status' => $log->status,
            'proof_status' => $log->proof_photo ? 'provided' : 'none',
            'proof_url' => $log->proof_photo ? $this->proofUrl($log->proof_photo) : null,
            'patient_notes' => $log->notes,
            'plan_medication_notes' => $tpm?->notes,
            'observed_by_name' => $log->observedBy?->name,
        ];
    }

    /**
     * Resolve a proof photo path to a displayable URL (same rules as ReportsController).
     */
    private function proofUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }
        if (Str::startsWith($path, ['http://', 'https://'])) {
            return $path;
        }
        if (Str::startsWith($path, 'storage/')) {
            return rtrim(config('app.url'), '/') . '/' . ltrim($path, '/');
        }

        return Storage::disk('public')->url(ltrim($path, '/'));
    }
}
