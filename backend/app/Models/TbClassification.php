<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TbClassification extends Model
{
    protected $fillable = [
        'patient_id',
        'bacteriological_status',
        'anatomical_site',
        'extrapulmonary_site',
        'drug_resistance_status',
        'registration_group',
    ];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }
}
