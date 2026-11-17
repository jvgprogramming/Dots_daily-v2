<?php

namespace App\Http\Controllers\API;

use App\Http\Requests\StoreSymptomLogRequest;
use App\Models\Patient;
use App\Models\SymptomLog;
use App\Models\User;
use App\Services\Notification\NotificationService;
use App\Support\AppSettings;
use App\Support\Symptoms;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Patient-facing symptom self-reporting for the Flutter app (Symptom Monitor).
 *
 * Writes land in `symptom_logs` with `recorded_by = 'patient'`, the same table
 * the admin patient profile already reads (PatientController::show returns the
 * latest ones). A "red-flag" report — a dangerous symptom, or anything the
 * patient rates `severe` — also alerts clinic staff through the shared
 * notification inbox, and tells the app to warn the patient to seek care.
 */
class MobileSymptomController extends BaseApiController
{
    /** Safety cap on the history payload. */
    private const MAX_HISTORY = 100;

    public function __construct(private readonly NotificationService $notifications) {}

    /** GET /mobile/symptoms — the patient's own reports, newest first. */
    public function index(Request $request): JsonResponse
    {
        $patient = $request->user()?->patient;

        if (! $patient) {
            return $this->error('This account is not linked to a patient profile.', 403);
        }

        $logs = SymptomLog::query()
            ->where('patient_id', $patient->id)
            ->orderByDesc('recorded_date')
            ->orderByDesc('id')
            ->limit(self::MAX_HISTORY)
            ->get();

        return $this->success(
            data: [
                'symptoms' => $logs->map(fn (SymptomLog $log) => $this->formatLog($log))->values(),
                'count' => $logs->count(),
            ],
            message: 'Symptom history retrieved successfully.',
        );
    }

    /** POST /mobile/symptoms — record one report (one row per symptom). */
    public function store(StoreSymptomLogRequest $request): JsonResponse
    {
        $patient = $request->user()?->patient;

        if (! $patient) {
            return $this->error('This account is not linked to a patient profile.', 403);
        }

        $data = $request->validated();
        $recordedDate = CarbonImmutable::parse(
            $data['recorded_date'] ?? CarbonImmutable::now(config('app.timezone'))->toDateString(),
        )->toDateString();
        $notes = $data['notes'] ?? null;

        $created = [];
        $redFlag = false;

        foreach ($data['symptoms'] as $entry) {
            $log = SymptomLog::create([
                'patient_id' => $patient->id,
                'recorded_date' => $recordedDate,
                'symptom_type' => $entry['type'],
                'severity' => $entry['severity'],
                'duration_hours' => $entry['duration_hours'] ?? null,
                'notes' => $notes,
                'recorded_by' => 'patient',
            ]);

            $created[] = $this->formatLog($log);
            $redFlag = $redFlag || Symptoms::isRedFlagReport($entry['type'], $entry['severity']);
        }

        if ($redFlag) {
            $this->alertClinic($patient, $created);
        }

        return $this->created(
            data: [
                'symptoms' => $created,
                'red_flag' => $redFlag,
            ],
            message: $redFlag
                ? 'Your report was sent. Some of what you reported may need urgent attention — please contact your clinic.'
                : 'Your symptoms were reported to your clinic.',
        );
    }

    /** Notify clinic staff that a patient reported something concerning. */
    private function alertClinic(Patient $patient, array $reported): void
    {
        $recipients = User::query()
            ->whereIn('role', AppSettings::list('notifications.escalate_to_roles') ?: ['admin'])
            ->where('is_active', true)
            ->pluck('id')
            ->all();

        if ($recipients === []) {
            return;
        }

        $name = $this->patientName($patient);
        $labels = array_values(array_unique(array_map(
            fn (array $s) => $s['severity'] === 'severe' ? $s['label'].' (severe)' : $s['label'],
            array_filter($reported, fn (array $s) => $s['red_flag']),
        )));

        $this->notifications->send(
            'symptom_alert',
            "Symptom alert: {$name}",
            "{$name} reported ".implode(', ', $labels).'. Please follow up.',
            [
                'patient_id' => $patient->id,
                'link' => "/monitoring?patient={$patient->id}",
            ],
            $recipients,
        );
    }

    private function formatLog(SymptomLog $log): array
    {
        return [
            'id' => $log->id,
            'recorded_date' => $log->recorded_date?->toDateString(),
            'symptom_type' => $log->symptom_type,
            'label' => Symptoms::label($log->symptom_type),
            'severity' => $log->severity,
            'duration_hours' => $log->duration_hours,
            'red_flag' => Symptoms::isRedFlagReport($log->symptom_type, (string) $log->severity),
            'notes' => $log->notes,
        ];
    }

    private function patientName(Patient $patient): string
    {
        return trim(($patient->first_name ?? '').' '.($patient->last_name ?? ''))
            ?: ($patient->user?->name ?? 'A patient');
    }
}
