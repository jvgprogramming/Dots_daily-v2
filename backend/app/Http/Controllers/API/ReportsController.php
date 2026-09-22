<?php

namespace App\Http\Controllers\API;

use App\Models\MedicationLog;
use App\Models\Patient;
use App\Models\TreatmentPlan;
use App\Support\Adherence;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Admin medication adherence reports.
 *
 * Reuses the live data model as the single source of truth — no new tables:
 *   MedicationLog   → doses, statuses, proof photos, taken_at, notes
 *   Patient         → per-patient breakdown (name, status)
 *
 * A mobile dose confirmation with proof photo automatically appears here.
 */
class ReportsController extends BaseApiController
{
    /** Maximum report window (days) to keep aggregations fast. */
    private const MAX_RANGE_DAYS = 92;

    /** Recent logs / proof uploads returned per request. */
    private const RECENT_LIMIT = 25;

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'patient_id' => ['nullable', 'integer', 'exists:patients,id'],
        ]);

        $from = isset($data['from'])
            ? CarbonImmutable::parse($data['from'])->startOfDay()
            : CarbonImmutable::today()->subDays(29);
        $to = isset($data['to'])
            ? CarbonImmutable::parse($data['to'])->endOfDay()
            : CarbonImmutable::today()->endOfDay();

        // Keep aggregations fast on very wide ranges
        if ($from->diffInDays($to) > self::MAX_RANGE_DAYS) {
            $to = $from->addDays(self::MAX_RANGE_DAYS)->endOfDay();
        }

        $patientId = $data['patient_id'] ?? null;
        $fromDate = $from->toDateString();
        $toDate = $to->toDateString();

        // ── Base query: logs in range ─────────────────────────────────
        $baseQuery = MedicationLog::query()
            ->whereBetween('scheduled_date', [$fromDate, $toDate])
            ->when($patientId, fn ($q) => $q->where('patient_id', $patientId));

        // ── Overview totals ───────────────────────────────────────────
        $totalDoses = (clone $baseQuery)->count();
        $taken = (clone $baseQuery)->where('status', 'taken')->count();
        $missed = (clone $baseQuery)->where('status', 'missed')->count();
        $late = (clone $baseQuery)->where('status', 'late')->count();
        $dosesWithProof = (clone $baseQuery)
            ->whereNotNull('proof_photo')
            ->where('proof_photo', '!=', '')
            ->count();

        // ── Adherence = days taken ÷ days expected ────────────────────
        // The same definition the patient's app and the monitoring calendar use
        // (see App\Support\Adherence), so all three surfaces agree. A day with no
        // log at all is expected-but-not-taken, not simply absent.
        $scopePatientIds = $patientId
            ? [(int) $patientId]
            : (clone $baseQuery)->distinct()->pluck('patient_id')
                ->merge(TreatmentPlan::query()->distinct()->pluck('patient_id'))
                ->unique()
                ->map(fn ($id) => (int) $id)
                ->values()
                ->all();

        $loggedSets = Adherence::loggedDaySets($scopePatientIds, $from, $to);
        $expectedSets = Adherence::expectedDaySets($scopePatientIds, $from, $to, $loggedSets);
        $daySummary = Adherence::summarize($expectedSets, $loggedSets);
        $scheduledDays = $daySummary['expected'];
        $daysTaken = $daySummary['taken'];

        $adherenceRate = $daySummary['rate'];
        $proofRate = $totalDoses > 0
            ? round(($dosesWithProof / $totalDoses) * 100, 1)
            : null;
        $patientsWithLogs = (clone $baseQuery)->distinct('patient_id')->count('patient_id');

        // ── Daily adherence trend (bars: taken/late/missed, line: rate) ──
        $dailyRows = (clone $baseQuery)
            ->selectRaw("scheduled_date,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken,
                SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late,
                SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed")
            ->groupBy('scheduled_date')
            ->orderBy('scheduled_date')
            ->get()
            ->keyBy(fn ($row) => CarbonImmutable::parse($row->scheduled_date)->toDateString());

        // Days expected/taken per calendar date, so a day the patient never logged
        // plots as 0% instead of dropping out of the trend entirely.
        $expectedPerDate = [];
        $takenPerDate = [];
        foreach ($expectedSets as $pid => $days) {
            foreach (array_keys($days) as $date) {
                $expectedPerDate[$date] = ($expectedPerDate[$date] ?? 0) + 1;
                if (Adherence::countsAsTaken($loggedSets[$pid][$date] ?? null)) {
                    $takenPerDate[$date] = ($takenPerDate[$date] ?? 0) + 1;
                }
            }
        }

        $today = CarbonImmutable::today();
        $trend = [];
        for ($day = $from->startOfDay(); $day->lte($to) && $day->lte($today); $day = $day->addDay()) {
            $iso = $day->toDateString();
            $row = $dailyRows->get($iso);
            $dayTotal = $row ? (int) $row->total : 0;
            $dayTaken = $row ? (int) $row->taken : 0;
            $dayLate = $row ? (int) $row->late : 0;
            $dayMissed = $row ? (int) $row->missed : 0;
            $dayExpected = $expectedPerDate[$iso] ?? 0;

            $trend[] = [
                'date' => $iso,
                'label' => $day->format('M j'),
                'total' => $dayTotal,
                'taken' => $dayTaken,
                'late' => $dayLate,
                'missed' => $dayMissed,
                // How many patients were expected to take a dose that day.
                'expected' => $dayExpected,
                'rate' => $dayExpected > 0
                    ? Adherence::rate($takenPerDate[$iso] ?? 0, $dayExpected)
                    : ($dayTotal > 0 ? round((($dayTaken + $dayLate) / $dayTotal) * 100, 1) : null),
            ];
        }

        // ── Per-patient adherence breakdown ───────────────────────────
        $patientAggregates = (clone $baseQuery)
            ->selectRaw("patient_id,
                COUNT(*) as total_doses,
                SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken,
                SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late,
                SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed,
                SUM(CASE WHEN proof_photo IS NOT NULL AND proof_photo != '' THEN 1 ELSE 0 END) as proof_uploads,
                MAX(scheduled_date) as last_dose_date")
            ->groupBy('patient_id')
            ->orderByDesc('total_doses')
            ->get()
            ->keyBy('patient_id');

        $patients = Patient::query()
            ->with('user')
            ->whereIn('id', $scopePatientIds)
            ->get()
            ->keyBy('id');

        // Built from the scope rather than the aggregates so a patient who was
        // prescribed a course but never logged a single dose still shows up — at
        // 0%, which is exactly the patient an admin needs to see.
        $patientBreakdown = collect($scopePatientIds)->map(function ($id) use ($patientAggregates, $patients, $loggedSets, $expectedSets) {
            $row = $patientAggregates->get($id);
            $patient = $patients->get($id);
            $taken = (int) ($row->taken ?? 0);
            $late = (int) ($row->late ?? 0);

            $patientExpected = count($expectedSets[$id] ?? []);
            $patientTakenDays = 0;
            foreach (array_keys($expectedSets[$id] ?? []) as $date) {
                if (Adherence::countsAsTaken($loggedSets[$id][$date] ?? null)) {
                    $patientTakenDays++;
                }
            }

            return [
                'id' => (int) $id,
                'name' => $patient
                    ? (trim(($patient->first_name ?? '') . ' ' . ($patient->last_name ?? '')) ?: ($patient->user?->name ?? 'Unnamed patient'))
                    : 'Unknown patient',
                'status' => $patient?->status ?? 'registered',
                'total_doses' => (int) ($row->total_doses ?? 0),
                'taken' => $taken,
                'missed' => (int) ($row->missed ?? 0),
                'late' => $late,
                'scheduled_days' => $patientExpected,
                'days_taken' => $patientTakenDays,
                'adherence_rate' => Adherence::rate($patientTakenDays, $patientExpected),
                'last_dose_date' => $row?->last_dose_date ? CarbonImmutable::parse($row->last_dose_date)->toDateString() : null,
                'proof_uploads' => (int) ($row->proof_uploads ?? 0),
            ];
        })->sortByDesc('total_doses')->values();

        // ── Log payload shape (shared by recent logs + proof uploads) ──
        $logPayload = fn (MedicationLog $log) => $this->formatLog($log);

        // ── Recent medication logs (the live feed from mobile confirmations) ──
        $recentLogs = (clone $baseQuery)
            ->with(['patient.user', 'treatmentPlanMedication.medication', 'observedBy'])
            ->orderByDesc('scheduled_date')
            ->orderByDesc('taken_at')
            ->orderByDesc('id')
            ->limit(self::RECENT_LIMIT)
            ->get()
            ->map($logPayload)
            ->values();

        // ── Proof uploads (logs that include photo evidence) ──────────
        $proofUploads = (clone $baseQuery)
            ->whereNotNull('proof_photo')
            ->where('proof_photo', '!=', '')
            ->with(['patient.user', 'treatmentPlanMedication.medication', 'observedBy'])
            ->orderByDesc('scheduled_date')
            ->orderByDesc('taken_at')
            ->orderByDesc('id')
            ->limit(self::RECENT_LIMIT)
            ->get()
            ->map($logPayload)
            ->values();

        return $this->success(data: [
            'overview' => [
                'total_doses' => $totalDoses,
                'taken' => $taken,
                'missed' => $missed,
                'late' => $late,
                'adherence_rate' => $adherenceRate,
                // The denominator behind adherence_rate: days a dose was expected,
                // and how many of them the patient actually took.
                'scheduled_days' => $scheduledDays,
                'days_taken' => $daysTaken,
                'doses_with_proof' => $dosesWithProof,
                'proof_upload_rate' => $proofRate,
                'patients_with_logs' => $patientsWithLogs,
                'from' => $fromDate,
                'to' => $toDate,
            ],
            'trend' => $trend,
            'patients' => $patientBreakdown,
            'recent_logs' => $recentLogs,
            'proof_uploads' => $proofUploads,
            'generated_at' => now()->toIso8601String(),
        ], message: 'Reports data retrieved successfully.');
    }

    /**
     * Uniform medication log shape for the reports feed / proof gallery.
     */
    private function formatLog(MedicationLog $log): array
    {
        $medication = $log->treatmentPlanMedication?->medication;

        return [
            'id' => $log->id,
            'patient_id' => $log->patient_id,
            'patient_name' => $log->patient
                ? (trim(($log->patient->first_name ?? '') . ' ' . ($log->patient->last_name ?? '')) ?: ($log->patient->user?->name ?? 'Unnamed patient'))
                : 'Unknown patient',
            'medication_name' => $medication?->name
                ? trim($medication->name . ($medication->strength ? " {$medication->strength}" : ''))
                : null,
            'scheduled_date' => $log->scheduled_date?->toDateString(),
            'scheduled_time' => $log->scheduled_time,
            'status' => $log->status,
            'taken_at' => $log->taken_at?->toIso8601String(),
            'dose_quantity' => $log->dose_quantity,
            'proof_photo' => $log->proof_photo,
            'proof_url' => $this->proofUrl($log->proof_photo),
            'notes' => $log->notes,
            'observed_by_name' => $log->observedBy?->name,
            'created_at' => $log->created_at?->toIso8601String(),
        ];
    }

    /**
     * Resolve proof photo to a displayable URL.
     * Accepts full URLs (pass through) or stored paths on the public disk.
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
