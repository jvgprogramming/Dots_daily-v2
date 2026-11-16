<?php

namespace App\Http\Resources;

use App\Models\VotEnrollment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin VotEnrollment */
class VotEnrollmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'patient_id' => $this->patient_id,
            'status' => $this->status,
            'is_active' => $this->isActive(),
            'eligible_since' => $this->eligible_since?->toDateString(),
            'assigned_nurse_id' => $this->assigned_nurse_id,
            'assigned_nurse_name' => $this->assignedNurse?->name,
            'granted_by_name' => $this->grantedBy?->name,
            'notes' => $this->notes,
            'status_reason' => $this->status_reason,
            'status_changed_at' => $this->status_changed_at?->toIso8601String(),
            'status_changed_by_name' => $this->statusChangedBy?->name,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
