<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CloseContactResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'full_name' => $this->full_name,
            'age' => $this->age,
            'sex' => $this->sex,
            'relationship' => $this->relationship,
            'screening_date' => $this->screening_date,
            'followup_date' => $this->followup_date,
            'remarks' => $this->remarks,
        ];
    }
}
