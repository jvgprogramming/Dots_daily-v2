<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One proof attempt (video or photo) for a scheduled dose. The media file is
 * on the private `local` disk and is only ever served through a signed link.
 */
#[Fillable([
    'medication_log_id',
    'patient_id',
    'treatment_plan_id',
    'attempt',
    'media_type',
    'media_path',
    'media_mime',
    'media_size',
    'duration_seconds',
    'submitted_at',
    'status',
    'reviewed_by',
    'reviewed_at',
    'review_reason',
])]
class VotSubmission extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_VERIFIED = 'verified';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_RESUBMISSION_REQUESTED = 'resubmission_requested';

    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_VERIFIED,
        self::STATUS_REJECTED,
        self::STATUS_RESUBMISSION_REQUESTED,
    ];

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function medicationLog(): BelongsTo
    {
        return $this->belongsTo(MedicationLog::class);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function treatmentPlan(): BelongsTo
    {
        return $this->belongsTo(TreatmentPlan::class);
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'attempt' => 'integer',
            'media_size' => 'integer',
            'duration_seconds' => 'integer',
        ];
    }
}
