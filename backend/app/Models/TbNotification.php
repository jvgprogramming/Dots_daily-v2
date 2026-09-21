<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TbNotification extends Model
{
    protected $table = 'tb_notifications';

    protected $fillable = [
        'patient_id',
        'reason',
        'facility_name',
        'ntp_facility_code',
        'province_huc',
        'region',
    ];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }
}
