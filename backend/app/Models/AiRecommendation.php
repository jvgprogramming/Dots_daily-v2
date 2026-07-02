<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'patient_id',
    'daily_monitoring_id',
    'type',
    'title',
    'description',
    'severity',
    'status',
    'reviewed_by',
    'reviewed_at',
    'source',
    'metadata',
])]
class AiRecommendation extends Model
{
    /** @use HasFactory<\Database\Factories\AiRecommendationFactory> */
    use HasFactory;

    protected $table = 'ai_recommendations';

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function dailyMonitoring(): BelongsTo
    {
        return $this->belongsTo(DailyMonitoring::class);
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    protected function casts(): array
    {
        return [
            'reviewed_at' => 'datetime',
            'metadata' => 'array',
        ];
    }
}
