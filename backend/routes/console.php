<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Missed-dose escalation + follow-up reminders (Settings → Notifications).
// Hourly so alerts held during quiet hours go out soon after they end; the
// command de-duplicates, so re-running never repeats an alert.
// Requires the scheduler: `php artisan schedule:work` (dev) or a cron entry
// running `php artisan schedule:run` every minute (production).
Schedule::command('notifications:escalate-missed')->hourly()->withoutOverlapping();
