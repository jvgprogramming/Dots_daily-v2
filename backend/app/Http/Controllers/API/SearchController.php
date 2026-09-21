<?php

namespace App\Http\Controllers\API;

use App\Models\DailyMonitoring;
use App\Models\Medication;
use App\Models\Patient;
use App\Models\TreatmentPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Global search across the main admin-facing entities:
 *   Patients         → name, email, phone, health ID, PhilHealth, occupation
 *   Treatment plans  → plan name, regimen type, notes, patient name
 *   Medications      → name, generic/brand name, dosage form
 *   Monitoring entries → vitals notes, patient name, recorded date
 *
 * Returns grouped, linkable results for the dashboard header search.
 */
class SearchController extends BaseApiController
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        if (mb_strlen($q) < 2) {
            return $this->success(data: [
                'query' => $q,
                'patients' => [],
                'treatment_plans' => [],
                'medications' => [],
                'monitoring_entries' => [],
                'totals' => ['patients' => 0, 'treatment_plans' => 0, 'medications' => 0, 'monitoring_entries' => 0, 'all' => 0],
            ], message: 'Query too short.');
        }

        $like = "%{$q}%";
        $limit = min((int) $request->query('limit', 5), 20);

        // ── Patients ────────────────────────────────────────────────
        $patients = Patient::query()
            ->with('user')
            ->where(function ($query) use ($like) {
                $query->where('first_name', 'like', $like)
                    ->orWhere('last_name', 'like', $like)
                    ->orWhere('health_id_number', 'like', $like)
                    ->orWhere('philhealth_number', 'like', $like)
                    ->orWhere('occupation', 'like', $like)
                    ->orWhereHas('user', function ($uq) use ($like) {
                        $uq->where('name', 'like', $like)
                            ->orWhere('email', 'like', $like)
                            ->orWhere('phone', 'like', $like);
                    });
            })
            ->orderByDesc('registered_at')
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn (Patient $p) => [
                'type' => 'patient',
                'id' => $p->id,
                'title' => trim(($p->first_name ?? '') . ' ' . ($p->last_name ?? '')) ?: ($p->user?->name ?? 'Unnamed patient'),
                'subtitle' => $p->user?->email,
                'meta' => $p->health_id_number,
                'status' => $p->status ?? 'registered',
            ]);

        // ── Treatment plans ─────────────────────────────────────────
        $plans = TreatmentPlan::query()
            ->with(['patient.user'])
            ->where(function ($query) use ($like) {
                $query->where('plan_name', 'like', $like)
                    ->orWhere('regimen_type', 'like', $like)
                    ->orWhere('notes', 'like', $like)
                    ->orWhere('phase', 'like', $like)
                    ->orWhere('status', 'like', $like)
                    ->orWhereHas('patient', function ($pq) use ($like) {
                        $pq->where('first_name', 'like', $like)
                            ->orWhere('last_name', 'like', $like)
                            ->orWhereHas('user', function ($uq) use ($like) {
                                $uq->where('name', 'like', $like);
                            });
                    });
            })
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderByDesc('start_date')
            ->limit($limit)
            ->get()
            ->map(fn (TreatmentPlan $t) => [
                'type' => 'treatment_plan',
                'id' => $t->id,
                'patient_id' => $t->patient_id,
                'title' => $t->plan_name ?: ($t->regimen_type ?: 'Treatment plan'),
                'subtitle' => $t->patient
                    ? (trim(($t->patient->first_name ?? '') . ' ' . ($t->patient->last_name ?? '')) ?: ($t->patient->user?->name ?? 'Unnamed patient'))
                    : null,
                'meta' => trim((string) $t->regimen_type) !== '' && $t->plan_name
                    ? $t->regimen_type
                    : ($t->phase ? ucfirst($t->phase) : null),
                'status' => $t->status,
            ]);

        // ── Medications ─────────────────────────────────────────────
        $medications = Medication::query()
            ->where(function ($query) use ($like) {
                $query->where('name', 'like', $like)
                    ->orWhere('generic_name', 'like', $like)
                    ->orWhere('brand_name', 'like', $like)
                    ->orWhere('dosage_form', 'like', $like);
            })
            ->where('is_active', true)
            ->orderBy('name')
            ->limit($limit)
            ->get()
            ->map(fn (Medication $m) => [
                'type' => 'medication',
                'id' => $m->id,
                'title' => $m->name,
                'subtitle' => trim((string) $m->generic_name) !== '' && strcasecmp($m->generic_name, $m->name) !== 0
                    ? $m->generic_name
                    : null,
                'meta' => trim(sprintf('%s %s %s', $m->strength ?? '', $m->unit ?? '', $m->dosage_form ?? '')) ?: null,
                'status' => null,
            ]);

        // ── Monitoring entries (by notes / patient / date) ──────────
        $monitoring = DailyMonitoring::query()
            ->with('patient.user')
            ->where(function ($query) use ($like, $q) {
                $query->where('notes', 'like', $like)
                    ->orWhereHas('patient', function ($pq) use ($like) {
                        $pq->where('first_name', 'like', $like)
                            ->orWhere('last_name', 'like', $like)
                            ->orWhereHas('user', function ($uq) use ($like) {
                                $uq->where('name', 'like', $like);
                            });
                    });

                // Full date match (e.g. 2026-09-21 or 09/21/2026)
                if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $q)) {
                    $query->orWhere('recorded_date', $q);
                } elseif (preg_match('/^\d{1,2}\/\d{1,2}\/\d{4}$/', $q)) {
                    [$mm, $dd, $yyyy] = explode('/', $q);
                    $query->orWhereDate('recorded_date', sprintf('%04d-%02d-%02d', $yyyy, $mm, $dd));
                }
            })
            ->orderByDesc('recorded_date')
            ->limit($limit)
            ->get()
            ->map(fn (DailyMonitoring $m) => [
                'type' => 'monitoring_entry',
                'id' => $m->id,
                'patient_id' => $m->patient_id,
                'title' => $m->patient
                    ? (trim(($m->patient->first_name ?? '') . ' ' . ($m->patient->last_name ?? '')) ?: ($m->patient->user?->name ?? 'Unnamed patient'))
                    : 'Monitoring entry',
                'subtitle' => 'Monitoring entry · ' . $m->recorded_date->toDateString(),
                'meta' => $m->notes ? \Illuminate\Support\Str::limit($m->notes, 60) : null,
                'status' => null,
            ]);

        $totals = [
            'patients' => $patients->count(),
            'treatment_plans' => $plans->count(),
            'medications' => $medications->count(),
            'monitoring_entries' => $monitoring->count(),
        ];
        $totals['all'] = array_sum($totals);

        return $this->success(data: [
            'query' => $q,
            'patients' => $patients,
            'treatment_plans' => $plans,
            'medications' => $medications,
            'monitoring_entries' => $monitoring,
            'totals' => $totals,
        ], message: 'Search results retrieved successfully.');
    }
}
