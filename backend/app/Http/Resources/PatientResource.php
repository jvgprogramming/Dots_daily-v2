<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PatientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'date_of_birth' => $this->date_of_birth,
            'gender' => $this->gender,
            'address' => $this->address,
            'emergency_contact_name' => $this->emergency_contact_name,
            'emergency_contact_phone' => $this->emergency_contact_phone,
            'occupation' => $this->occupation,
            'nationality' => $this->nationality,
            'health_id_number' => $this->health_id_number,
            'referred_by' => $this->referred_by,
            'registered_at' => $this->registered_at,
        ];
    }
}
