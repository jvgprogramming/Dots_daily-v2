<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'patient_id',
    'assigned_by',
    'plan_name',
    'regimen_type',
    'regimen_type_end',
    'phase',
    'start_date',
    'expected_end_date',
    'actual_end_date',
    'status',
    'discontinuation_reason',
    'outcome',
    'outcome_date',
    'outcome_reason',
    'draft_reason',
    'notes',
])]
class TreatmentPlan extends Model
{
    /** @use HasFactory<\Database\Factories\TreatmentPlanFactory> */
    use HasFactory, SoftDeletes;

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function treatmentPlanMedications(): HasMany
    {
        return $this->hasMany(TreatmentPlanMedication::class);
    }

    public function medications(): BelongsToMany
    {
        return $this->belongsToMany(Medication::class, 'treatment_plan_medication')
            ->withPivot(['dosage', 'frequency', 'route', 'duration_weeks', 'preferred_time', 'notes'])
            ->withTimestamps();
    }

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'expected_end_date' => 'date',
            'actual_end_date' => 'date',
            'outcome_date' => 'date',
        ];
    }
}
