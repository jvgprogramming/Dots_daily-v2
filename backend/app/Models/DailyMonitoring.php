<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'patient_id',
    'recorded_date',
    'weight_kg',
    'temperature_c',
    'blood_pressure_systolic',
    'blood_pressure_diastolic',
    'heart_rate_bpm',
    'respiratory_rate',
    'oxygen_saturation',
    'notes',
    'recorded_by',
])]
class DailyMonitoring extends Model
{
    /** @use HasFactory<\Database\Factories\DailyMonitoringFactory> */
    use HasFactory;

    protected $table = 'daily_monitoring';

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function medicationLogs(): HasMany
    {
        return $this->hasMany(MedicationLog::class);
    }

    public function symptomLogs(): HasMany
    {
        return $this->hasMany(SymptomLog::class);
    }

    public function aiRecommendations(): HasMany
    {
        return $this->hasMany(AiRecommendation::class);
    }

    protected function casts(): array
    {
        return [
            'recorded_date' => 'date',
            'weight_kg' => 'decimal:2',
            'temperature_c' => 'decimal:2',
            'oxygen_saturation' => 'decimal:0',
        ];
    }
}
