<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TbNotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reason' => $this->reason,
            'facility_name' => $this->facility_name,
            'ntp_facility_code' => $this->ntp_facility_code,
            'province_huc' => $this->province_huc,
            'region' => $this->region,
        ];
    }
}
