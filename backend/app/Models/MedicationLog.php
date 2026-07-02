<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
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
    'daily_monitoring_id',
    'notes',
    'observed_by',
])]
class MedicationLog extends Model
{
    /** @use HasFactory<\Database\Factories\MedicationLogFactory> */
    use HasFactory;

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
        ];
    }
}
