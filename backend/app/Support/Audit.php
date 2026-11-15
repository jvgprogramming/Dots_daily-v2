<?php

namespace App\Support;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Throwable;

/**
 * One way to write the audit trail (`activity_logs`).
 *
 * Action names are dotted `<area>.<verb>` (e.g. `patient.updated`,
 * `login.failed`) so the Security & Audit panel can filter by area. Login
 * events are always recorded; everything else respects the admin's
 * `security.audit_logging_enabled` switch. Logging never breaks the request
 * it describes.
 */
final class Audit
{
    /** Areas the audit panel filters on → action prefix. */
    public const AREAS = [
        'logins' => 'login.',
        'auth' => 'auth.',
        'patients' => 'patient.',
        'treatments' => 'treatment.',
        'doses' => 'dose.',
        'medications' => 'medication.',
        'users' => 'user.',
        'settings' => 'settings.',
    ];

    /** Fields never written into an audit diff. */
    private const HIDDEN = ['password', 'remember_token', 'updated_at', 'created_at'];

    public static function log(
        ?Request $request,
        string $action,
        string $description,
        ?Model $subject = null,
        array $properties = [],
        ?int $userId = null,
    ): void {
        $alwaysOn = str_starts_with($action, 'login.') || str_starts_with($action, 'auth.');
        if (! $alwaysOn && ! AppSettings::bool('security.audit_logging_enabled')) {
            return;
        }

        try {
            ActivityLog::create([
                'user_id' => $userId ?? $request?->user()?->id,
                'action' => $action,
                'description' => mb_substr($description, 0, 500),
                'subject_type' => $subject ? $subject::class : null,
                'subject_id' => $subject?->getKey(),
                'properties' => $properties === [] ? null : $properties,
                'ip_address' => $request?->ip(),
                'user_agent' => $request ? mb_substr((string) $request->userAgent(), 0, 500) : null,
                'created_at' => now(),
            ]);
        } catch (Throwable $e) {
            report($e);
        }
    }

    /**
     * Before/after for the attributes a save actually changed. Call after
     * `save()`/`update()` — it reads Eloquent's own change tracking.
     *
     * @return array{changes?: array<string, array{from: mixed, to: mixed}>}
     */
    public static function diff(Model $model): array
    {
        // After a save Eloquent has already synced "original", so the prior
        // values live in getPrevious().
        $previous = $model->getPrevious();
        $changes = [];
        foreach ($model->getChanges() as $field => $to) {
            if (in_array($field, self::HIDDEN, true)) {
                continue;
            }
            $changes[$field] = ['from' => $previous[$field] ?? null, 'to' => $to];
        }

        return $changes === [] ? [] : ['changes' => $changes];
    }

    /** Before/after for two plain arrays (e.g. settings values). */
    public static function arrayDiff(array $before, array $after): array
    {
        $changes = [];
        foreach ($after as $key => $to) {
            $from = $before[$key] ?? null;
            if ((string) $from !== (string) $to) {
                $changes[$key] = ['from' => $from, 'to' => $to];
            }
        }

        return $changes === [] ? [] : ['changes' => $changes];
    }
}
