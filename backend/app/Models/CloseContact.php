<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CloseContact extends Model
{
    protected $fillable = [
        'patient_id',
        'full_name',
        'age',
        'sex',
        'relationship',
        'screening_date',
        'followup_date',
        'remarks',
    ];

    protected $casts = [
        'screening_date' => 'date',
        'followup_date' => 'date',
    ];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }
}
