<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DiagnosisResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'diagnosis_type' => $this->diagnosis_type,
            'diagnosis_date' => $this->diagnosis_date,
            'notification_date' => $this->notification_date,
            'case_number' => $this->case_number,
            'attending_physician' => $this->attending_physician,
            'referral_name' => $this->referral_name,
            'referral_address' => $this->referral_address,
            'referral_facility_code' => $this->referral_facility_code,
            'referral_province_huc' => $this->referral_province_huc,
            'referral_region' => $this->referral_region,
        ];
    }
}
