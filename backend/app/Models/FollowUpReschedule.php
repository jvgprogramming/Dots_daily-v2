<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'treatment_plan_id',
    'patient_id',
    'original_date',
    'new_date',
    'rescheduled_at',
    'reason',
    'notes',
    'rescheduled_by',
])]
class FollowUpReschedule extends Model
{
    /** @use HasFactory<\Database\Factories\FollowUpRescheduleFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'original_date' => 'date',
            'new_date' => 'date',
            'rescheduled_at' => 'date',
        ];
    }

    public function treatmentPlan(): BelongsTo
    {
        return $this->belongsTo(TreatmentPlan::class);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function rescheduledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rescheduled_by');
    }
}
