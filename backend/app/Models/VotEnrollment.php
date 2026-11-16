<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A patient's Video-Observed Therapy eligibility — the current state only;
 * the change history lives in `activity_logs` (action `vot.enrollment.*`).
 */
#[Fillable([
    'patient_id',
    'status',
    'eligible_since',
    'assigned_nurse_id',
    'granted_by',
    'notes',
    'status_reason',
    'status_changed_at',
    'status_changed_by',
])]
class VotEnrollment extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_SUSPENDED = 'suspended';

    public const STATUS_REVOKED = 'revoked';

    public const STATUSES = [self::STATUS_ACTIVE, self::STATUS_SUSPENDED, self::STATUS_REVOKED];

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function assignedNurse(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_nurse_id');
    }

    public function grantedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'granted_by');
    }

    public function statusChangedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'status_changed_by');
    }

    protected function casts(): array
    {
        return [
            'eligible_since' => 'date',
            'status_changed_at' => 'datetime',
        ];
    }
}
