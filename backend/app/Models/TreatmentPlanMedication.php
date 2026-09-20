<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'treatment_plan_id',
    'medication_id',
    'dosage',
    'frequency',
    'route',
    'duration_weeks',
    'preferred_time',
    'notes',
])]
class TreatmentPlanMedication extends Model
{
    /** @use HasFactory<\Database\Factories\TreatmentPlanMedicationFactory> */
    use HasFactory;

    protected $table = 'treatment_plan_medication';

    public function treatmentPlan(): BelongsTo
    {
        return $this->belongsTo(TreatmentPlan::class);
    }

    public function medication(): BelongsTo
    {
        return $this->belongsTo(Medication::class);
    }

    public function medicationLogs(): HasMany
    {
        return $this->hasMany(MedicationLog::class);
    }

    protected function casts(): array
    {
        return [
            'preferred_time' => 'string',
        ];
    }
}
