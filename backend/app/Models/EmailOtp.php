<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A patient's current one-time email code (see the create_email_otps migration).
 * The code and the follow-up setup token are only ever stored hashed.
 */
#[Fillable(['user_id', 'code_hash', 'expires_at', 'attempts', 'verified_at', 'setup_token_hash'])]
#[Hidden(['code_hash', 'setup_token_hash'])]
class EmailOtp extends Model
{
    /**
     * Minutes a code stays valid. Wrong guesses don't use it up — only time
     * does; guessing is held back by the verify route's rate limit instead.
     */
    public const CODE_TTL_MINUTES = 5;

    /** Minutes the patient has to choose a password after entering the code. */
    public const SETUP_TTL_MINUTES = 15;

    /** Seconds before another code can be sent. */
    public const RESEND_COOLDOWN_SECONDS = 60;

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /**
     * When the current code was emailed. Derived from expires_at rather than
     * updated_at, which also moves when a code is checked or verified — that
     * made a wrong guess restart the resend cooldown.
     */
    public function sentAt(): \Carbon\CarbonInterface
    {
        return $this->expires_at->copy()->subMinutes(self::CODE_TTL_MINUTES);
    }

    /** Seconds until another code may be sent (0 = now). */
    public function resendIn(): int
    {
        $elapsed = (int) $this->sentAt()->diffInSeconds(now(), absolute: true);

        return max(0, self::RESEND_COOLDOWN_SECONDS - $elapsed);
    }

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'verified_at' => 'datetime',
        ];
    }
}
