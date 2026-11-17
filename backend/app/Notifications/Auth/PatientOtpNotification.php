<?php

namespace App\Notifications\Auth;

use App\Models\EmailOtp;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Emails a patient the 6-digit code that activates their account or resets their password. */
class PatientOtpNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly string $code, private readonly bool $activating) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $purpose = $this->activating
            ? 'Use this code to activate your DOTS Daily account and create your password.'
            : 'Use this code to reset your DOTS Daily password.';

        return (new MailMessage)
            ->subject("{$this->code} is your DOTS Daily code")
            ->greeting("Hello {$notifiable->name}!")
            ->line($purpose)
            ->line("**{$this->code}**")
            ->line('The code expires in '.EmailOtp::CODE_TTL_MINUTES.' minutes. Never share it with anyone, including clinic staff.')
            ->line('If you did not ask for this code, you can ignore this email.');
    }
}
