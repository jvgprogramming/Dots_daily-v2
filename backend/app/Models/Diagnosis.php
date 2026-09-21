<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Diagnosis extends Model
{
    protected $fillable = [
        'patient_id',
        'diagnosis_type',
        'diagnosis_date',
        'notification_date',
        'case_number',
        'attending_physician',
        'referral_name',
        'referral_address',
        'referral_facility_code',
        'referral_province_huc',
        'referral_region',
    ];

    protected $casts = [
        'diagnosis_date' => 'date',
        'notification_date' => 'date',
    ];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }
}
