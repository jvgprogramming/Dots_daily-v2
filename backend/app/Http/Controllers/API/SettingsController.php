<?php

namespace App\Http\Controllers\API;

use App\Models\ActivityLog;
use App\Models\Setting;
use App\Models\User;
use App\Support\AppSettings;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Settings — the admin system control panel.
 *
 * One grouped key/value store (`settings` table) backs all sections; the
 * defaults and typed reads live in {@see AppSettings}, which every module uses
 * so a saved value takes effect immediately. Users & Roles manages staff
 * accounts; module access is a fixed preset per role. Audit reads
 * activity_logs, written through {@see Audit}.
 */
class SettingsController extends BaseApiController
{
    /** Modules a role can be granted. Presets are fixed — see defaultPermissions(). */
    public const MODULES = ['patients', 'treatments', 'monitoring', 'medications', 'reports', 'settings'];

    // ─────────────────────────────────────────────────────────────────
    //  Settings
    // ─────────────────────────────────────────────────────────────────

    /** GET /settings — all sections merged over defaults. */
    public function index(): JsonResponse
    {
        $stored = Setting::query()->with('updatedBy:id,name')->get()
            ->keyBy(fn (Setting $s) => "{$s->group}.{$s->key}");

        $settings = [];
        foreach (AppSettings::defaults() as $dotted => $default) {
            [$group, $key] = explode('.', $dotted, 2);
            $row = $stored->get($dotted);
            $settings[$group][$key] = [
                'value' => $row?->value ?? $default,
                'updated_at' => $row?->updated_at?->toIso8601String() ?? null,
                'updated_by_name' => $row?->updatedBy?->name ?? null,
            ];
        }

        return $this->success(data: [
            'settings' => $settings,
            'modules' => self::MODULES,
        ], message: 'Settings retrieved successfully.');
    }

    /**
     * GET /settings/public — the subset any signed-in portal user needs to
     * render labels that depend on settings (risk bands, regimens…).
     */
    public function publicSettings(): JsonResponse
    {
        return $this->success(data: [
            'facility_name' => AppSettings::get('facility.facility_name'),
            'clinic_schedule' => AppSettings::get('facility.clinic_schedule'),
            'late_dose_threshold_minutes' => AppSettings::int('clinical.late_dose_threshold_minutes', 120),
            'adherence_calculation' => AppSettings::get('clinical.adherence_calculation'),
            'risk_watch_below' => AppSettings::int('clinical.risk_watch_below', 90),
            'risk_high_below' => AppSettings::int('clinical.risk_high_below', 80),
            'regimens' => AppSettings::json('protocols.regimens'),
            'weight_bands' => AppSettings::json('protocols.weight_bands'),
            'outcome_options' => AppSettings::list('protocols.outcome_options'),
            'low_stock_default' => AppSettings::int('inventory.low_stock_default', 10),
            'near_expiry_days' => AppSettings::int('inventory.near_expiry_days', 90),
        ]);
    }

    /** PUT /settings — persist a group of keys in one transaction. */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'group' => ['required', 'string', Rule::in(AppSettings::groups())],
            'values' => ['required', 'array'],
        ]);

        $group = $data['group'];
        $values = $this->validateGroupValues($group, $data['values']);

        $before = AppSettings::all();

        $changed = DB::transaction(function () use ($group, $values, $request) {
            $count = 0;
            foreach ($values as $key => $value) {
                Setting::updateOrCreate(
                    ['group' => $group, 'key' => $key],
                    ['value' => $value, 'updated_by' => $request->user()?->id]
                );
                $count++;
            }

            return $count;
        });

        AppSettings::flush();

        if ($changed > 0) {
            $prev = [];
            foreach (array_keys($values) as $key) {
                $prev[$key] = $before["{$group}.{$key}"] ?? null;
            }
            $diff = Audit::arrayDiff($prev, $values);
            if ($diff !== []) {
                Audit::log($request, 'settings.updated', 'Updated '.str_replace('_', ' ', $group).' settings', properties: $diff);
            }
        }

        return $this->success(
            data: ['changed' => $changed],
            message: 'Settings saved successfully.'
        );
    }

    /**
     * Drop unknown keys, normalise booleans/JSON, and validate the values whose
     * shape matters to the code that reads them.
     *
     * @return array<string, string>
     */
    private function validateGroupValues(string $group, array $values): array
    {
        $allowed = collect(AppSettings::defaults())
            ->keys()
            ->filter(fn ($dotted) => str_starts_with($dotted, "{$group}."))
            ->map(fn ($dotted) => substr($dotted, strlen($group) + 1))
            ->all();

        $clean = [];
        foreach ($values as $key => $value) {
            if (! in_array($key, $allowed, true)) {
                continue; // silently ignore unknown keys
            }
            $clean[$key] = match (true) {
                is_bool($value) => $value ? '1' : '0',
                is_array($value) => json_encode(array_values($value)),
                default => trim((string) $value),
            };
        }

        $time = 'regex:/^([01]\d|2[0-3]):[0-5]\d$/';
        $rules = [
            'clinical' => [
                'late_dose_threshold_minutes' => ['integer', 'min:0', 'max:1440'],
                'adherence_calculation' => ['in:taken_plus_late,taken_only'],
                'risk_watch_below' => ['integer', 'min:1', 'max:100'],
                'risk_high_below' => ['integer', 'min:0', 'max:100'],
                'followup_due_soon_days' => ['integer', 'min:1', 'max:90'],
                'approaching_end_days' => ['integer', 'min:1', 'max:90'],
                'reminder_times' => ['regex:/^(([01]\d|2[0-3]):[0-5]\d)(,([01]\d|2[0-3]):[0-5]\d)*$/'],
            ],
            'inventory' => [
                'low_stock_default' => ['integer', 'min:0', 'max:100000'],
                'near_expiry_days' => ['integer', 'min:1', 'max:730'],
            ],
            'notifications' => [
                'escalate_after_missed' => ['integer', 'min:0', 'max:30'],
                'quiet_hours_start' => [$time],
                'quiet_hours_end' => [$time],
                'missed_dose_template' => ['max:500'],
                'followup_template' => ['max:500'],
            ],
            'security' => [
                'password_min_length' => ['integer', 'min:8', 'max:64'],
                'session_timeout_minutes' => ['integer', 'min:0', 'max:1440'],
                'max_login_attempts' => ['integer', 'min:3', 'max:20'],
            ],
            'protocols' => [
                'regimens' => ['json'],
                'weight_bands' => ['json'],
            ],
        ][$group] ?? [];

        $validator = validator($clean, array_intersect_key($rules, $clean), [
            'regex' => 'Use 24-hour HH:MM format.',
        ]);
        $validator->after(function ($v) use ($group, $clean) {
            if ($group === 'clinical' && isset($clean['risk_watch_below'], $clean['risk_high_below'])
                && (int) $clean['risk_high_below'] > (int) $clean['risk_watch_below']) {
                $v->errors()->add('risk_high_below', 'High-risk threshold must be at or below the watch threshold.');
            }
            if ($group === 'protocols') {
                foreach (json_decode($clean['regimens'] ?? '[]', true) ?: [] as $i => $r) {
                    if (empty($r['code']) || ! is_numeric($r['intensive_days'] ?? null) || ! is_numeric($r['continuation_days'] ?? null)) {
                        $v->errors()->add('regimens', 'Regimen #'.($i + 1).' needs a code and both phase lengths.');
                    }
                }
            }
        });
        $validator->validate();

        return $clean;
    }

    // ─────────────────────────────────────────────────────────────────
    //  Users & Roles
    // ─────────────────────────────────────────────────────────────────

    /** GET /settings/users — staff accounts only (admins and staff). */
    public function users(Request $request): JsonResponse
    {
        $query = User::query()
            ->whereIn('role', ['admin', 'staff'])
            ->orderBy('name');

        if ($search = trim((string) $request->get('search'))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $users = $query->limit(200)->get()->map(fn (User $u) => $this->formatUser($u));

        return $this->success(data: ['users' => $users], message: 'Staff users retrieved successfully.');
    }

    /** POST /settings/users — create a staff account. */
    public function storeUser(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')],
            'phone' => ['nullable', 'string', 'max:20'],
            'password' => ['required', 'string', 'min:'.self::passwordMin()],
            'role' => ['required', 'string', Rule::in(['admin', 'staff'])],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'password' => Hash::make($data['password']),
            'role' => $data['role'],
            // Module access follows the role preset; it is never hand-picked.
            'permissions' => $this->defaultPermissions($data['role']),
            'is_active' => $data['is_active'] ?? true,
            'email_verified_at' => now(),
        ]);

        Audit::log($request, 'user.created', "Created staff account {$user->email} ({$user->role})", $user);

        return $this->success(data: ['user' => $this->formatUser($user)], message: 'User created successfully.');
    }

    /** PUT /settings/users/{user} — update role, profile, password, or status. */
    public function updateUser(Request $request, User $user): JsonResponse
    {
        if ($user->isPatient()) {
            throw ValidationException::withMessages([
                'user' => 'Patient accounts are managed in the Patients module.',
            ]);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
            'password' => ['nullable', 'string', 'min:'.self::passwordMin()],
            'role' => ['sometimes', 'string', Rule::in(['admin', 'staff'])],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $updates = [];
        foreach (['name', 'phone', 'role', 'is_active'] as $field) {
            if (array_key_exists($field, $data)) {
                $updates[$field] = $data[$field];
            }
        }
        if (! empty($data['password'])) {
            $updates['password'] = Hash::make($data['password']);
        }

        // Keep module access in step with the role preset whenever it changes.
        if (isset($updates['role'])) {
            $updates['permissions'] = $this->defaultPermissions($updates['role']);
        }

        // Guard: never demote/deactivate the last active admin
        $losingAdmin = ($user->role === 'admin') && (
            (isset($updates['role']) && $updates['role'] !== 'admin')
            || (isset($updates['is_active']) && $updates['is_active'] === false)
        );
        if ($losingAdmin && User::where('role', 'admin')->where('is_active', true)->where('id', '!=', $user->id)->doesntExist()) {
            return $this->error(message: 'Cannot remove the last active admin account.', code: 422);
        }

        // A change to who this person is or whether they may sign in ends their
        // current sessions, so the new access level applies immediately.
        $accessChanged = (isset($updates['role']) && $updates['role'] !== $user->role)
            || (isset($updates['is_active']) && $updates['is_active'] === false)
            || isset($updates['password']);

        $user->update($updates);
        $diff = Audit::diff($user);
        unset($diff['changes']['permissions']);
        if (isset($updates['password'])) {
            $diff['password_changed'] = true;
        }

        if ($accessChanged) {
            $user->tokens()->delete();
        }

        Audit::log($request, 'user.updated', "Updated staff account {$user->email}", $user, $diff);

        return $this->success(data: ['user' => $this->formatUser($user->fresh())], message: 'User updated successfully.');
    }

    /** DELETE /settings/users/{user} — deactivate (soft-delete) a staff account. */
    public function destroyUser(Request $request, User $user): JsonResponse
    {
        if ($user->isPatient()) {
            return $this->error(message: 'Patient accounts are managed in the Patients module.', code: 422);
        }
        if ($user->role === 'admin' && User::where('role', 'admin')->where('is_active', true)->where('id', '!=', $user->id)->doesntExist()) {
            return $this->error(message: 'Cannot delete the last active admin account.', code: 422);
        }

        $email = $user->email;
        $user->tokens()->delete();
        $user->delete();

        Audit::log($request, 'user.deleted', "Deleted staff account {$email}", $user);

        return $this->success(message: 'User deleted successfully.');
    }

    /** POST /settings/users/{user}/revoke-sessions — sign the user out everywhere. */
    public function revokeSessions(Request $request, User $user): JsonResponse
    {
        if ($user->isPatient()) {
            return $this->error(message: 'Patient accounts are managed in the Patients module.', code: 422);
        }

        $count = $user->tokens()->count();
        $user->tokens()->delete();

        Audit::log($request, 'user.sessions_revoked', "Signed out all sessions for {$user->email}", $user, ['sessions' => $count]);

        return $this->success(data: ['revoked' => $count], message: 'All sessions for this user were signed out.');
    }

    // ─────────────────────────────────────────────────────────────────
    //  Security & Audit
    // ─────────────────────────────────────────────────────────────────

    /** GET /settings/audit — filtered, paginated audit trail. */
    public function audit(Request $request): JsonResponse
    {
        $filters = $this->auditFilters($request);
        $perPage = (int) ($filters['per_page'] ?? 25);

        $page = $this->auditQuery($filters)->paginate($perPage);

        return $this->success(data: [
            'entries' => collect($page->items())->map(fn (ActivityLog $log) => $this->formatLog($log))->all(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
            'areas' => array_keys(Audit::AREAS),
            'staff' => User::query()->whereIn('role', ['admin', 'staff'])->orderBy('name')->get(['id', 'name']),
            'audit_logging_enabled' => AppSettings::bool('security.audit_logging_enabled'),
        ], message: 'Audit data retrieved successfully.');
    }

    /** GET /settings/audit/export — the same filters as CSV (max 5,000 rows). */
    public function exportAudit(Request $request): StreamedResponse
    {
        $filters = $this->auditFilters($request);
        $rows = $this->auditQuery($filters)->limit(5000)->get();

        Audit::log($request, 'settings.audit_exported', 'Exported audit log ('.$rows->count().' rows)');

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Date/time', 'User', 'Action', 'Description', 'Changes', 'IP address']);
            foreach ($rows as $log) {
                $f = $this->formatLog($log);
                fputcsv($out, [
                    $f['created_at'],
                    $f['user_name'],
                    $f['action'],
                    $f['description'],
                    $f['properties'] ? json_encode($f['properties'], JSON_UNESCAPED_UNICODE) : '',
                    $f['ip_address'],
                ]);
            }
            fclose($out);
        }, 'audit-log-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** GET /settings/login-activity — per-staff sign-in summary. */
    public function loginActivity(): JsonResponse
    {
        $since = now()->subDay();

        $failed = ActivityLog::query()
            ->where('action', 'login.failed')
            ->where('created_at', '>=', $since)
            ->get(['properties', 'user_id'])
            ->groupBy(fn (ActivityLog $l) => strtolower((string) ($l->properties['email'] ?? '')))
            ->map->count();

        $lastIps = ActivityLog::query()
            ->where('action', 'login.success')
            ->whereNotNull('user_id')
            ->orderByDesc('created_at')
            ->get(['user_id', 'ip_address'])
            ->unique('user_id')
            ->pluck('ip_address', 'user_id');

        $users = User::query()
            ->whereIn('role', ['admin', 'staff'])
            ->withCount('tokens')
            ->orderByDesc('last_login_at')
            ->get()
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role,
                'is_active' => $u->is_active,
                'last_login_at' => $u->last_login_at?->toIso8601String(),
                'last_login_ip' => $lastIps[$u->id] ?? null,
                'failed_attempts_24h' => (int) ($failed[strtolower($u->email)] ?? 0),
                'active_sessions' => (int) $u->tokens_count,
            ]);

        // Failed sign-ins for addresses that match no staff account (probing).
        $staffEmails = $users->pluck('email')->map(fn ($e) => strtolower($e))->all();
        $unknown = $failed->filter(fn ($n, $email) => $email !== '' && ! in_array($email, $staffEmails, true));

        return $this->success(data: [
            'users' => $users,
            'failed_logins_24h' => (int) $failed->sum(),
            'unknown_email_attempts_24h' => (int) $unknown->sum(),
        ]);
    }

    private function auditFilters(Request $request): array
    {
        return $request->validate([
            'area' => ['nullable', 'string', Rule::in(['all', 'failed_logins', ...array_keys(Audit::AREAS)])],
            'user_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
    }

    private function auditQuery(array $filters)
    {
        $query = ActivityLog::query()->with('user:id,name')->orderByDesc('created_at')->orderByDesc('id');

        $area = $filters['area'] ?? 'all';
        if ($area === 'failed_logins') {
            $query->where('action', 'login.failed');
        } elseif ($area !== 'all' && isset(Audit::AREAS[$area])) {
            $query->where('action', 'like', Audit::AREAS[$area].'%');
        }
        if (! empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }
        if (! empty($filters['from'])) {
            $query->whereDate('created_at', '>=', $filters['from']);
        }
        if (! empty($filters['to'])) {
            $query->whereDate('created_at', '<=', $filters['to']);
        }
        if (! empty($filters['search'])) {
            $term = $filters['search'];
            $query->where(function ($q) use ($term) {
                $q->where('description', 'like', "%{$term}%")
                    ->orWhere('ip_address', 'like', "%{$term}%")
                    ->orWhereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$term}%"));
            });
        }

        return $query;
    }

    private function formatLog(ActivityLog $log): array
    {
        return [
            'id' => $log->id,
            'user_name' => $log->user?->name ?? ($log->properties['email'] ?? 'System'),
            'action' => $log->action,
            'description' => $log->description,
            'subject_type' => $log->subject_type ? class_basename($log->subject_type) : null,
            'subject_id' => $log->subject_id,
            'properties' => $log->properties,
            'ip_address' => $log->ip_address,
            'user_agent' => $log->user_agent,
            'created_at' => $log->created_at?->toIso8601String(),
        ];
    }

    // ─────────────────────────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────────────────────────

    /** Minimum password length from Security settings (never below 8). */
    public static function passwordMin(): int
    {
        return max(8, AppSettings::int('security.password_min_length', 8));
    }

    private function formatUser(User $u): array
    {
        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'phone' => $u->phone,
            'role' => $u->role,
            'permissions' => $u->permissions ?? $this->defaultPermissions($u->role),
            'is_active' => $u->is_active,
            'email_verified_at' => $u->email_verified_at?->toIso8601String(),
            'last_login_at' => $u->last_login_at?->toIso8601String(),
            'created_at' => $u->created_at?->toIso8601String(),
        ];
    }

    /**
     * Role → module access presets. Admin sees everything; staff runs the
     * clinical workflow but never opens System settings.
     */
    private function defaultPermissions(string $role): array
    {
        return match ($role) {
            'admin' => self::MODULES,
            'staff' => array_values(array_diff(self::MODULES, ['settings'])),
            default => [],
        };
    }
}
