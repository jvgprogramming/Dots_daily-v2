<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Point password reset emails at the Next.js app. Without this the stock
        // notification builds its link with route('password.reset'), which this
        // API-only backend does not define, and sending the mail throws.
        ResetPassword::createUrlUsing(function ($notifiable, string $token): string {
            $email = urlencode((string) $notifiable->getEmailForPasswordReset());

            return rtrim((string) config('app.frontend_url'), '/')
                ."/reset-password?token={$token}&email={$email}";
        });
    }
}
