<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'name',
    'generic_name',
    'brand_name',
    'dosage_form',
    'strength',
    'unit',
    'description',
    'is_active',
])]
class Medication extends Model
{
    /** @use HasFactory<\Database\Factories\MedicationFactory> */
    use HasFactory;

    public function treatmentPlanMedications(): HasMany
    {
        return $this->hasMany(TreatmentPlanMedication::class);
    }

    public function treatmentPlans(): BelongsToMany
    {
        return $this->belongsToMany(TreatmentPlan::class, 'treatment_plan_medication')
            ->withPivot(['dosage', 'frequency', 'route', 'duration_weeks', 'preferred_time', 'notes'])
            ->withTimestamps();
    }

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }
}
