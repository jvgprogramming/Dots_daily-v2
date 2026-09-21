<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LaboratoryTest extends Model
{
    protected $fillable = [
        'patient_id',
        'test_type',
        'test_name',
        'test_date',
        'result',
        'status',
        'remarks',
    ];

    protected $casts = [
        'test_date' => 'date',
    ];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }
}
