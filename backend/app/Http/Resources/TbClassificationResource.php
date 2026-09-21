<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TbClassificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'bacteriological_status' => $this->bacteriological_status,
            'anatomical_site' => $this->anatomical_site,
            'extrapulmonary_site' => $this->extrapulmonary_site,
            'drug_resistance_status' => $this->drug_resistance_status,
            'registration_group' => $this->registration_group,
        ];
    }
}
