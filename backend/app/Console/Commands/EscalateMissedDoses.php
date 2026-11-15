<?php

namespace App\Console\Commands;

use App\Models\MedicationLog;
use App\Models\Notification;
use App\Models\TreatmentPlan;
use App\Models\User;
use App\Support\Adherence;
use App\Support\AppSettings;
use App\Support\FollowUps;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Staff alerts driven by Settings → Notifications.
 *
 *  - Missed-dose escalation: a patient on an active plan who has gone
 *    `escalate_after_missed` consecutive expected days (up to yesterday)
 *    without a taken dose raises one alert per missed streak.
 *  - Follow-up reminders: one alert per upcoming follow-up date once it is
 *    inside the "due soon" window.
 *
 * Alerts go to active users in `escalate_to_roles`, are held during quiet
 * hours, and are de-duplicated, so the hourly schedule can run it freely.
 */
class EscalateMissedDoses extends Command
{
    protected $signature = 'notifications:escalate-missed {--force : Ignore quiet hours} {--dry-run : Report without creating alerts}';

    protected $description = 'Alert staff about consecutive missed doses and upcoming follow-ups';

    public const TYPE_MISSED = 'missed_dose_escalation';

    public const TYPE_FOLLOWUP = 'followup_reminder';

    public function handle(): int
    {
        $now = CarbonImmutable::now();

        if (! $this->option('force') && self::inQuietHours($now)) {
            $this->info('Quiet hours — alerts held until '.AppSettings::get('notifications.quiet_hours_end').'.');

            return self::SUCCESS;
        }

        $recipients = User::query()
            ->whereIn('role', AppSettings::list('notifications.escalate_to_roles') ?: ['admin'])
            ->where('is_active', true)
            ->pluck('id');

        if ($recipients->isEmpty()) {
            $this->warn('No active recipients for the configured roles.');

            return self::SUCCESS;
        }

        $missed = $this->escalateMissed($recipients, $now);
        $followups = $this->remindFollowUps($recipients, $now);

        $this->info("Missed-dose alerts: {$missed}. Follow-up reminders: {$followups}.");

        return self::SUCCESS;
    }

    /** True when $now falls inside the configured quiet window (may wrap midnight). */
    public static function inQuietHours(CarbonImmutable $now): bool
    {
        $start = AppSettings::get('notifications.quiet_hours_start');
        $end = AppSettings::get('notifications.quiet_hours_end');
        if (! $start || ! $end || $start === $end) {
            return false;
        }

        $t = $now->format('H:i');

        return $start < $end
            ? ($t >= $start && $t < $end)
            : ($t >= $start || $t < $end);
    }

    private function escalateMissed(Collection $recipients, CarbonImmutable $now): int
    {
        $threshold = AppSettings::int('notifications.escalate_after_missed', 3);
        if ($threshold <= 0 || ! AppSettings::bool('notifications.missed_dose_alert')) {
            return 0;
        }

        $yesterday = $now->startOfDay()->subDay();
        $windowStart = $yesterday->subDays(max($threshold, 1) + 30);

        $plans = TreatmentPlan::query()
            ->with('patient.user:id,name')
            ->where('status', 'active')
            ->whereNotNull('start_date')
            ->whereDate('start_date', '<=', $yesterday->toDateString())
            ->get();

        if ($plans->isEmpty()) {
            return 0;
        }

        $logged = Adherence::loggedDaySets($plans->pluck('patient_id')->unique()->all(), $windowStart, $yesterday);
        $created = 0;

        foreach ($plans as $plan) {
            $start = CarbonImmutable::parse($plan->start_date)->startOfDay();
            $days = $logged[$plan->patient_id] ?? [];

            // Walk back from yesterday until a taken day or the plan start.
            $streak = 0;
            $streakStart = null;
            $brokeOnTaken = false;
            for ($d = $yesterday; $d->gte($start) && $d->gte($windowStart); $d = $d->subDay()) {
                if (Adherence::countsAsTaken($days[$d->toDateString()] ?? null)) {
                    $brokeOnTaken = true;
                    break;
                }
                $streak++;
                $streakStart = $d;
            }
            // Ran out of lookback window before reaching a taken day or the plan start.
            $capped = ! $brokeOnTaken && $streakStart !== null && $streakStart->gt($start);

            if ($streak < $threshold || $streakStart === null) {
                continue;
            }

            $patientId = (int) $plan->patient_id;
            // One alert per streak: a streak is identified by the last day a dose
            // was taken (or the plan start), which stays fixed while it continues.
            $lastTaken = MedicationLog::query()
                ->where('patient_id', $patientId)
                ->whereIn('status', ['taken', 'late'])
                ->whereDate('scheduled_date', '>=', $start->toDateString())
                ->whereDate('scheduled_date', '<=', $yesterday->toDateString())
                ->max('scheduled_date');
            $key = $lastTaken
                ? 'after:'.CarbonImmutable::parse($lastTaken)->toDateString()
                : 'plan:'.$plan->id.':'.$start->toDateString();
            if ($this->alreadySent(self::TYPE_MISSED, ['patient_id' => $patientId, 'streak_start' => $key])) {
                continue;
            }

            $name = $this->patientName($plan);
            $body = self::fill(AppSettings::get('notifications.missed_dose_template'), [
                'patient' => $name,
                'count' => $streak.($capped ? '+' : ''),
                'date' => $yesterday->format('M j, Y'),
                'time' => $now->format('g:i A'),
            ]);

            $this->send(self::TYPE_MISSED, "Missed doses: {$name}", $body, [
                'patient_id' => $patientId,
                'treatment_plan_id' => $plan->id,
                'streak_start' => $key,
                'missed_days' => $streak,
                'link' => "/monitoring?patient={$patientId}",
            ], $recipients);
            $created++;
        }

        return $created;
    }

    private function remindFollowUps(Collection $recipients, CarbonImmutable $now): int
    {
        if (! AppSettings::bool('notifications.followup_reminder')) {
            return 0;
        }

        $created = 0;
        $plans = TreatmentPlan::query()->with('patient.user:id,name')->where('status', 'active')->get();

        foreach ($plans as $plan) {
            $next = FollowUps::nextFor($plan, $now->startOfDay());
            if (! $next || $next['status'] !== 'due' || empty($next['date'])) {
                continue;
            }

            $date = CarbonImmutable::parse($next['date'])->toDateString();
            if ($this->alreadySent(self::TYPE_FOLLOWUP, ['treatment_plan_id' => $plan->id, 'followup_date' => $date])) {
                continue;
            }

            $name = $this->patientName($plan);
            $body = self::fill(AppSettings::get('notifications.followup_template'), [
                'patient' => $name,
                'date' => CarbonImmutable::parse($date)->format('M j, Y'),
                'time' => '',
                'count' => '',
            ]);

            $this->send(self::TYPE_FOLLOWUP, "Follow-up due: {$name}", $body, [
                'patient_id' => (int) $plan->patient_id,
                'treatment_plan_id' => $plan->id,
                'followup_date' => $date,
                'link' => '/treatments',
            ], $recipients);
            $created++;
        }

        return $created;
    }

    private function alreadySent(string $type, array $match): bool
    {
        $q = Notification::query()->where('type', $type);
        foreach ($match as $k => $v) {
            $q->where("data->{$k}", $v);
        }

        return $q->exists();
    }

    private function send(string $type, string $title, string $body, array $data, Collection $recipients): void
    {
        if ($this->option('dry-run')) {
            $this->line("[dry-run] {$title} — {$body}");

            return;
        }

        DB::transaction(function () use ($type, $title, $body, $data, $recipients) {
            $n = Notification::create(['type' => $type, 'title' => $title, 'body' => $body, 'data' => $data]);
            $now = now();
            DB::table('notification_recipients')->insert($recipients->map(fn ($id) => [
                'notification_id' => $n->id,
                'user_id' => $id,
                'is_read' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all());
        });
    }

    private function patientName(TreatmentPlan $plan): string
    {
        $p = $plan->patient;

        return trim(($p?->first_name ?? '').' '.($p?->last_name ?? '')) ?: ($p?->user?->name ?? "Patient #{$plan->patient_id}");
    }

    /** Replace {placeholders} in a template. */
    public static function fill(?string $template, array $vars): string
    {
        $out = (string) $template;
        foreach ($vars as $k => $v) {
            $out = str_replace('{'.$k.'}', $v, $out);
        }

        return trim(preg_replace('/\s{2,}/', ' ', $out));
    }
}
