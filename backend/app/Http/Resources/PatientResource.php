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
            'status' => $this->status ?? 'registered',
            'last_name' => $this->last_name,
            'first_name' => $this->first_name,
            'middle_name' => $this->middle_name,
            'name_extension' => $this->name_extension,
            'date_of_birth' => $this->date_of_birth,
            'gender' => $this->gender,
            'civil_status' => $this->civil_status,
            'address' => $this->address,
            'emergency_contact_name' => $this->emergency_contact_name,
            'emergency_contact_phone' => $this->emergency_contact_phone,
            'occupation' => $this->occupation,
            'weight_kg' => $this->weight_kg,
            'nationality' => $this->nationality,
            'health_id_number' => $this->health_id_number,
            'philhealth_number' => $this->philhealth_number,
            'referred_by' => $this->referred_by,
            'registered_at' => $this->registered_at,
            'draft_data' => $this->when($this->status === 'draft', $this->draft_data),

            // TB records when loaded
            'tb_notifications' => TbNotificationResource::collection($this->whenLoaded('tbNotifications')),
            'laboratory_tests' => LaboratoryTestResource::collection($this->whenLoaded('laboratoryTests')),
            'diagnoses' => DiagnosisResource::collection($this->whenLoaded('diagnoses')),
            'tb_classification' => TbClassificationResource::collection($this->whenLoaded('tbClassification')),
            'close_contacts' => CloseContactResource::collection($this->whenLoaded('closeContacts')),
        ];
    }
}
