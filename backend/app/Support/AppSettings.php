<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Typed, cached access to the admin-editable `settings` table.
 *
 * DEFAULTS is the single source of truth for every key the Settings panel can
 * edit: a missing row falls back to its default, so behaviour is identical
 * before and after an admin first saves a section. Every module that used to
 * hardcode a threshold (late doses, risk bands, expiry windows…) reads it here.
 */
final class AppSettings
{
    private const CACHE_KEY = 'app_settings.v1';

    /**
     * Default TB regimens: intensive / continuation phase days. Codes match
     * the values already stored on treatment plans (web/lib/treatment-options.ts).
     * Days approximate calendar months (2 mo ≈ 60, 4 mo ≈ 122).
     * A single-phase regimen puts its whole course in one phase; 0 + 0 means
     * "set the end date by hand" (individualized regimens).
     */
    private const DEFAULT_REGIMENS = [
        ['code' => '2HRZE/4HR', 'name' => 'DS-TB standard (6 mo)', 'intensive_days' => 60, 'continuation_days' => 122, 'drugs' => 'HRZE (FDC), HR (FDC)'],
        ['code' => '2HRZE/10HR', 'name' => 'Extended — bone/CNS TB (12 mo)', 'intensive_days' => 60, 'continuation_days' => 305, 'drugs' => 'HRZE (FDC), HR (FDC)'],
        ['code' => '9H', 'name' => 'TB infection — 9 months isoniazid', 'intensive_days' => 0, 'continuation_days' => 274, 'drugs' => 'Isoniazid'],
        ['code' => '3HP', 'name' => 'TB infection — 3 months weekly HP', 'intensive_days' => 0, 'continuation_days' => 91, 'drugs' => 'Isoniazid, Rifapentine'],
        ['code' => '4R', 'name' => 'TB infection — 4 months rifampicin', 'intensive_days' => 0, 'continuation_days' => 122, 'drugs' => 'Rifampicin'],
        ['code' => 'BPaLM', 'name' => 'RR/MDR-TB (6 mo)', 'intensive_days' => 182, 'continuation_days' => 0, 'drugs' => 'Bedaquiline, Pretomanid, Linezolid, Moxifloxacin'],
        ['code' => 'BPaL', 'name' => 'RR/MDR-TB (6 mo)', 'intensive_days' => 182, 'continuation_days' => 0, 'drugs' => 'Bedaquiline, Pretomanid, Linezolid'],
        ['code' => '9-11 mo MDR', 'name' => '9–11 month MDR regimen', 'intensive_days' => 122, 'continuation_days' => 152, 'drugs' => 'Bdq, Lfx, Cfz, Z, E, Hh, Eto'],
        ['code' => 'individualized', 'name' => 'Individualized MDR/XDR regimen', 'intensive_days' => 0, 'continuation_days' => 0, 'drugs' => ''],
    ];

    /** The regimen with this code, or null. */
    public static function regimen(?string $code): ?array
    {
        if ($code === null || $code === '') {
            return null;
        }
        foreach (self::json('protocols.regimens') as $r) {
            if (($r['code'] ?? null) === $code) {
                return $r;
            }
        }

        return null;
    }

    /** Default adult FDC tablet counts per weight band (WHO / NTP). */
    private const DEFAULT_WEIGHT_BANDS = [
        ['min_kg' => 25, 'max_kg' => 37, 'intensive_tablets' => 2, 'continuation_tablets' => 2],
        ['min_kg' => 38, 'max_kg' => 54, 'intensive_tablets' => 3, 'continuation_tablets' => 3],
        ['min_kg' => 55, 'max_kg' => 70, 'intensive_tablets' => 4, 'continuation_tablets' => 4],
        ['min_kg' => 71, 'max_kg' => null, 'intensive_tablets' => 5, 'continuation_tablets' => 5],
    ];

    public static function defaults(): array
    {
        return [
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
            'clinical.reminder_times' => '08:00,12:00,16:00,20:00',       // comma-separated HH:MM
            'clinical.late_dose_threshold_minutes' => '120',              // minutes after scheduled time
            'clinical.adherence_calculation' => 'taken_plus_late',        // taken_plus_late | taken_only
            'clinical.risk_watch_below' => '90',                          // adherence % → "watch"
            'clinical.risk_high_below' => '80',                           // adherence % → "high risk"
            'clinical.followup_due_soon_days' => '14',
            'clinical.approaching_end_days' => '14',

            // ── Treatment protocols ──
            'protocols.regimens' => json_encode(self::DEFAULT_REGIMENS),
            'protocols.weight_bands' => json_encode(self::DEFAULT_WEIGHT_BANDS),
            'protocols.outcome_options' => 'cured,treatment_completed,died,failed,lost_to_followup',

            // ── Inventory ──
            'inventory.low_stock_default' => '10',
            'inventory.near_expiry_days' => '90',
            'inventory.auto_deduct_on_verify' => '0',
            'inventory.expiry_alert_enabled' => '1',

            // ── Notifications ──
            'notifications.sms_enabled' => '0',
            'notifications.sms_sender' => '',
            'notifications.email_enabled' => '1',
            'notifications.push_enabled' => '1',
            'notifications.missed_dose_alert' => '1',
            'notifications.followup_reminder' => '1',
            'notifications.escalate_after_missed' => '3',                 // consecutive missed days; 0 = off
            'notifications.escalate_to_roles' => 'admin,staff',
            'notifications.quiet_hours_start' => '21:00',
            'notifications.quiet_hours_end' => '07:00',
            'notifications.missed_dose_template' => '{patient} has missed {count} consecutive doses (last expected {date}). Please follow up.',
            'notifications.followup_template' => 'Reminder: {patient} has a follow-up visit on {date}.',

            // ── Video-Observed Therapy ──
            // One instruction per line, shown to the patient before recording.
            'vot.instructions' => implode("\n", [
                "Say your full name and today's date.",
                'Show your prescribed medicine or its packaging to the camera.',
                'Keep your face, hands and medicine in view the whole time.',
                'Put the medicine in your mouth and swallow it with water.',
                'Open your mouth and lift your tongue toward the camera.',
            ]),
            'vot.allowed_media' => 'video,photo',                         // video | photo | video,photo
            'vot.min_video_seconds' => '5',
            'vot.max_video_seconds' => '120',
            'vot.max_video_mb' => '64',
            'vot.max_photo_mb' => '10',
            'vot.allow_resubmit_after_reject' => '1',                     // may a rejected dose get new proof?

            // ── Reports ──
            'reports.default_range_days' => '30',
            'reports.default_filter' => 'all',                            // all | taken | late | missed | unrecorded
            'reports.export_format' => 'csv',                             // csv | pdf
            'reports.access_roles' => 'admin',                            // comma-separated roles

            // ── Security ──
            'security.password_min_length' => '8',
            'security.session_timeout_minutes' => '0',                    // idle minutes; 0 = no idle timeout
            'security.max_login_attempts' => '5',                         // per email+IP, 15-minute lockout
            'security.audit_logging_enabled' => '1',
        ];
    }

    /** Groups the Settings panel may write. */
    public static function groups(): array
    {
        return array_values(array_unique(array_map(
            fn (string $k) => explode('.', $k, 2)[0],
            array_keys(self::defaults()),
        )));
    }

    /** All values, stored rows merged over defaults, as 'group.key' => string. */
    public static function all(): array
    {
        $stored = Cache::rememberForever(self::CACHE_KEY, function () {
            try {
                if (! Schema::hasTable('settings')) {
                    return [];
                }

                return Setting::query()
                    ->get(['group', 'key', 'value'])
                    ->mapWithKeys(fn (Setting $s) => ["{$s->group}.{$s->key}" => (string) $s->value])
                    ->all();
            } catch (Throwable) {
                return [];
            }
        });

        return array_merge(self::defaults(), array_intersect_key($stored, self::defaults()));
    }

    public static function get(string $dotted, ?string $fallback = null): ?string
    {
        return self::all()[$dotted] ?? $fallback;
    }

    public static function int(string $dotted, int $fallback = 0): int
    {
        $v = self::get($dotted);

        return is_numeric($v) ? (int) $v : $fallback;
    }

    public static function bool(string $dotted): bool
    {
        return in_array(strtolower((string) self::get($dotted)), ['1', 'true', 'on', 'yes'], true);
    }

    /** Comma-separated value → trimmed, non-empty list. */
    public static function list(string $dotted): array
    {
        return array_values(array_filter(array_map('trim', explode(',', (string) self::get($dotted)))));
    }

    /** JSON value → array, falling back to the default when stored JSON is invalid. */
    public static function json(string $dotted): array
    {
        $decoded = json_decode((string) self::get($dotted), true);
        if (is_array($decoded)) {
            return $decoded;
        }

        return json_decode((string) (self::defaults()[$dotted] ?? '[]'), true) ?: [];
    }

    public static function flush(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
