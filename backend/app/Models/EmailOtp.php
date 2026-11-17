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
    /** Minutes a code stays valid. */
    public const CODE_TTL_MINUTES = 10;

    /** Minutes the patient has to choose a password after entering the code. */
    public const SETUP_TTL_MINUTES = 15;

    /** Wrong guesses allowed per code. */
    public const MAX_ATTEMPTS = 5;

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

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'verified_at' => 'datetime',
        ];
    }
}
