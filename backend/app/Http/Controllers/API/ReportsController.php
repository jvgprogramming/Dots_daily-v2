<?php

namespace App\Http\Controllers\API;

use App\Models\MedicationLog;
use App\Models\Patient;
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

        $adherenceRate = $totalDoses > 0
            ? round((($taken + $late) / $totalDoses) * 100, 1)
            : null;
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

        $today = CarbonImmutable::today();
        $trend = [];
        for ($day = $from->startOfDay(); $day->lte($to) && $day->lte($today); $day = $day->addDay()) {
            $row = $dailyRows->get($day->toDateString());
            $dayTotal = $row ? (int) $row->total : 0;
            $dayTaken = $row ? (int) $row->taken : 0;
            $dayLate = $row ? (int) $row->late : 0;
            $dayMissed = $row ? (int) $row->missed : 0;

            $trend[] = [
                'date' => $day->toDateString(),
                'label' => $day->format('M j'),
                'total' => $dayTotal,
                'taken' => $dayTaken,
                'late' => $dayLate,
                'missed' => $dayMissed,
                'rate' => $dayTotal > 0 ? round((($dayTaken + $dayLate) / $dayTotal) * 100, 1) : null,
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
            ->get();

        $patients = Patient::query()
            ->with('user')
            ->whereIn('id', $patientAggregates->pluck('patient_id'))
            ->get()
            ->keyBy('id');

        $patientBreakdown = $patientAggregates->map(function ($row) use ($patients) {
            $patient = $patients->get($row->patient_id);
            $total = (int) $row->total_doses;
            $taken = (int) $row->taken;
            $late = (int) $row->late;

            return [
                'id' => (int) $row->patient_id,
                'name' => $patient
                    ? (trim(($patient->first_name ?? '') . ' ' . ($patient->last_name ?? '')) ?: ($patient->user?->name ?? 'Unnamed patient'))
                    : 'Unknown patient',
                'status' => $patient?->status ?? 'registered',
                'total_doses' => $total,
                'taken' => $taken,
                'missed' => (int) $row->missed,
                'late' => $late,
                'adherence_rate' => $total > 0 ? round((($taken + $late) / $total) * 100, 1) : null,
                'last_dose_date' => $row->last_dose_date ? CarbonImmutable::parse($row->last_dose_date)->toDateString() : null,
                'proof_uploads' => (int) $row->proof_uploads,
            ];
        })->values();

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
