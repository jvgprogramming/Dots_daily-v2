<?php

namespace App\Models;

use App\Support\ProofMedia;
use Database\Factories\MedicationLogFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'treatment_plan_medication_id',
    'patient_id',
    'scheduled_date',
    'scheduled_time',
    'taken_at',
    'status',
    'dose_quantity',
    'proof_photo',
    'proof_video_path',
    'proof_video_mime',
    'proof_video_size',
    'daily_monitoring_id',
    'notes',
    'observed_by',
    'flagged_at',
    'flagged_by',
    'flag_reason',
])]
class MedicationLog extends Model
{
    /** @use HasFactory<MedicationLogFactory> */
    use HasFactory;

    /** True once a nurse has flagged this dose's proof as suspicious. */
    protected function flagged(): Attribute
    {
        return Attribute::get(fn () => $this->flagged_at !== null);
    }

    public function flaggedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'flagged_by');
    }

    /** Displayable URL for the stored proof video (null when none). */
    protected function proofVideoUrl(): Attribute
    {
        return Attribute::get(fn () => ProofMedia::url($this->proof_video_path));
    }

    /** Displayable URL for the stored proof photo (null when none). */
    protected function proofPhotoUrl(): Attribute
    {
        return Attribute::get(fn () => ProofMedia::url($this->proof_photo));
    }

    public function treatmentPlanMedication(): BelongsTo
    {
        return $this->belongsTo(TreatmentPlanMedication::class);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function dailyMonitoring(): BelongsTo
    {
        return $this->belongsTo(DailyMonitoring::class);
    }

    public function observedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'observed_by');
    }

    protected function casts(): array
    {
        return [
            'scheduled_date' => 'date',
            'scheduled_time' => 'string',
            'taken_at' => 'datetime',
            'flagged_at' => 'datetime',
        ];
    }
}
