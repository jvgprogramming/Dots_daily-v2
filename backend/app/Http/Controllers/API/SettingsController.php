<?php

namespace App\Http\Controllers\API;

use App\Models\ActivityLog;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Settings — the admin system control panel.
 *
 * One grouped key/value store (`settings` table) backs all sections:
 * facility profile, clinical rules, notification channels, report defaults,
 * and security policies. Users & Roles manages staff accounts with
 * per-module permissions. Audit data reads the existing activity_logs.
 */
class SettingsController extends BaseApiController
{
    /**
     * Defaults for every setting key — the single source of truth for what
     * the panel can edit. Missing rows fall back to these.
     */
    public const DEFAULTS = [
        // ── Facility ──
        'facility.facility_name' => '',
        'facility.branch_name' => '',
        'facility.contact_email' => '',
        'facility.contact_phone' => '',
        'facility.address' => '',
        'facility.region' => '',
        'facility.province' => '',
        'facility.municipality' => '',
        'facility.clinic_schedule' => 'Mon–Fri, 8:00 AM – 5:00 PM',

        // ── Clinical rules ──
        'clinical.reminder_times' => '08:00,12:00,16:00,20:00',   // comma-separated HH:MM
        'clinical.late_dose_threshold_minutes' => '60',
        'clinical.missed_dose_grace_hours' => '4',
        'clinical.followup_reminder_days_before' => '3',
        'clinical.adherence_calculation' => 'taken_plus_late',    // taken_plus_late | taken_only
        'clinical.outcome_options' => 'cured,treatment_completed,died,failed,lost_to_followup',

        // ── Notifications ──
        'notifications.sms_enabled' => '0',
        'notifications.sms_sender' => '',
        'notifications.email_enabled' => '1',
        'notifications.push_enabled' => '1',
        'notifications.missed_dose_alert' => '1',
        'notifications.followup_reminder' => '1',

        // ── Reports ──
        'reports.default_range_days' => '30',
        'reports.default_filter' => 'all',                        // all | taken | late | missed | unrecorded
        'reports.export_format' => 'csv',                         // csv | pdf
        'reports.access_roles' => 'admin',                        // comma-separated roles

        // ── Security ──
        'security.password_min_length' => '8',
        'security.password_expiry_days' => '0',                   // 0 = never
        'security.session_timeout_minutes' => '0',                // 0 = no timeout
        'security.max_login_attempts' => '5',
        'security.audit_logging_enabled' => '1',
    ];

    /** Modules available for per-user access control. */
    public const MODULES = ['patients', 'treatments', 'monitoring', 'reports', 'settings'];

    // ─────────────────────────────────────────────────────────────────
    //  Settings
    // ─────────────────────────────────────────────────────────────────

    /** GET /settings — all sections merged over defaults. */
    public function index(): JsonResponse
    {
        $stored = Setting::query()->get()->keyBy(fn (Setting $s) => "{$s->group}.{$s->key}");

        $settings = [];
        foreach (self::DEFAULTS as $dotted => $default) {
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

    /** PUT /settings — persist a group of keys in one transaction. */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'group' => ['required', 'string', 'in:facility,clinical,notifications,reports,security'],
            'values' => ['required', 'array'],
        ]);

        $group = $data['group'];
        $allowed = collect(self::DEFAULTS)
            ->keys()
            ->filter(fn ($dotted) => str_starts_with($dotted, "{$group}."))
            ->map(fn ($dotted) => substr($dotted, strlen($group) + 1));

        $saved = DB::transaction(function () use ($data, $group, $allowed, $request) {
            $changed = 0;
            foreach ($data['values'] as $key => $value) {
                if (! $allowed->contains($key)) {
                    continue; // silently ignore unknown keys
                }
                Setting::updateOrCreate(
                    ['group' => $group, 'key' => $key],
                    ['value' => is_bool($value) ? ($value ? '1' : '0') : (string) $value, 'updated_by' => $request->user()?->id]
                );
                $changed++;
            }

            if ($changed > 0 && $group === 'security' || $group === 'clinical') {
                $this->logAudit($request, 'settings.updated', "Updated {$group} settings");
            }

            return $changed;
        });

        return $this->success(
            data: ['changed' => $saved],
            message: 'Settings saved successfully.'
        );
    }

    // ─────────────────────────────────────────────────────────────────
    //  Users & Roles
    // ─────────────────────────────────────────────────────────────────

    /** GET /settings/users — staff accounts (admins, clinicians, nurses, staff). */
    public function users(Request $request): JsonResponse
    {
        $query = User::query()
            ->whereIn('role', ['admin', 'clinician', 'nurse', 'staff'])
            ->withCount([])
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
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', 'string', Rule::in(['admin', 'clinician', 'nurse', 'staff'])],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', Rule::in(self::MODULES)],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'password' => Hash::make($data['password']),
            'role' => $data['role'],
            'permissions' => $data['permissions'] ?? $this->defaultPermissions($data['role']),
            'is_active' => $data['is_active'] ?? true,
            'email_verified_at' => now(),
        ]);

        $this->logAudit($request, 'user.created', "Created staff account {$user->email} ({$user->role})", User::class, $user->id);

        return $this->success(data: ['user' => $this->formatUser($user)], message: 'User created successfully.');
    }

    /** PUT /settings/users/{user} — update role, permissions, or status. */
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
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['sometimes', 'string', Rule::in(['admin', 'clinician', 'nurse', 'staff'])],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', Rule::in(self::MODULES)],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $updates = [];
        foreach (['name', 'phone', 'role', 'permissions', 'is_active'] as $field) {
            if (array_key_exists($field, $data)) {
                $updates[$field] = $data[$field];
            }
        }
        if (!empty($data['password'])) {
            $updates['password'] = Hash::make($data['password']);
        }

        // Guard: never demote/deactivate the last active admin
        $losingAdmin = ($user->role === 'admin') && (
            (isset($updates['role']) && $updates['role'] !== 'admin')
            || (isset($updates['is_active']) && $updates['is_active'] === false)
        );
        if ($losingAdmin && User::where('role', 'admin')->where('is_active', true)->where('id', '!=', $user->id)->doesntExist()) {
            return $this->error(message: 'Cannot remove the last active admin account.', code: 422);
        }

        $user->update($updates);

        $this->logAudit($request, 'user.updated', "Updated staff account {$user->email}", User::class, $user->id);

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
        $user->delete();

        $this->logAudit($request, 'user.deleted', "Deleted staff account {$email}", User::class, $user->id);

        return $this->success(message: 'User deleted successfully.');
    }

    // ─────────────────────────────────────────────────────────────────
    //  Security & Audit
    // ─────────────────────────────────────────────────────────────────

    /** GET /settings/audit — login activity + change log from activity_logs. */
    public function audit(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['nullable', 'string', 'in:all,logins,changes'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $query = ActivityLog::query()->with('user')->orderByDesc('created_at')->limit(50);

        if (($data['type'] ?? 'all') === 'logins') {
            $query->where('action', 'like', 'login%');
        } elseif (($data['type'] ?? 'all') === 'changes') {
            $query->where('action', 'not like', 'login%');
        }

        if (!empty($data['search'])) {
            $query->where(function ($q) use ($data) {
                $q->where('description', 'like', "%{$data['search']}%")
                    ->orWhereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$data['search']}%"));
            });
        }

        $entries = $query->get()->map(fn (ActivityLog $log) => [
            'id' => $log->id,
            'user_name' => $log->user?->name ?? 'System',
            'action' => $log->action,
            'description' => $log->description,
            'ip_address' => $log->ip_address,
            'created_at' => $log->created_at?->toIso8601String(),
        ]);

        // Login activity summary from the users table
        $loginActivity = User::query()
            ->whereIn('role', ['admin', 'clinician', 'nurse', 'staff'])
            ->orderByDesc('last_login_at')
            ->limit(10)
            ->get()
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role,
                'last_login_at' => $u->last_login_at?->toIso8601String(),
                'is_active' => $u->is_active,
            ]);

        return $this->success(data: [
            'entries' => $entries,
            'login_activity' => $loginActivity,
        ], message: 'Audit data retrieved successfully.');
    }

    // ─────────────────────────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────────────────────────

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

    /** Role → module access defaults (admins see everything). */
    private function defaultPermissions(string $role): array
    {
        return match ($role) {
            'admin' => self::MODULES,
            'clinician' => ['patients', 'treatments', 'monitoring', 'reports'],
            'nurse' => ['patients', 'monitoring'],
            default => ['patients'],
        };
    }

    private function logAudit(Request $request, string $action, string $description, ?string $subjectType = null, ?int $subjectId = null): void
    {
        ActivityLog::create([
            'user_id' => $request->user()?->id,
            'action' => $action,
            'description' => $description,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 500),
            'created_at' => now(),
        ]);
    }
}
