<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'patient_id',
    'recorded_date',
    'symptom_type',
    'severity',
    'duration_hours',
    'notes',
    'recorded_by',
    'daily_monitoring_id',
])]
class SymptomLog extends Model
{
    /** @use HasFactory<\Database\Factories\SymptomLogFactory> */
    use HasFactory;

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function dailyMonitoring(): BelongsTo
    {
        return $this->belongsTo(DailyMonitoring::class);
    }

    protected function casts(): array
    {
        return [
            'recorded_date' => 'date',
        ];
    }
}
