<?php

namespace App\Http\Resources;

use App\Models\VotSubmission;
use App\Support\ProofMedia;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A VOT proof for the portal review queue. The signed media link is only
 * included when asked for (the detail view), so a list page never hands out
 * dozens of playable links at once.
 *
 * @mixin VotSubmission
 */
class VotSubmissionResource extends JsonResource
{
    private bool $withMedia = false;

    public function withMedia(): static
    {
        $this->withMedia = true;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $patient = $this->patient;
        $log = $this->medicationLog;
        $plan = $this->treatmentPlan;
        $tpm = $log?->treatmentPlanMedication;
        $medication = $tpm?->medication;

        return [
            'id' => $this->id,
            'attempt' => $this->attempt,
            'status' => $this->status,
            'media_type' => $this->media_type,
            'media_mime' => $this->media_mime,
            'media_size' => $this->media_size,
            'duration_seconds' => $this->duration_seconds,
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'reviewed_by_name' => $this->reviewedBy?->name,
            'review_reason' => $this->review_reason,
            'media_url' => $this->when($this->withMedia, fn () => ProofMedia::submissionUrl($this->resource)),

            'patient' => [
                'id' => $this->patient_id,
                'name' => $patient
                    ? (trim(($patient->first_name ?? '').' '.($patient->last_name ?? '')) ?: ($patient->user?->name ?? 'Unnamed patient'))
                    : 'Unknown patient',
                'health_id_number' => $patient?->health_id_number,
                'assigned_nurse_name' => $patient?->votEnrollment?->assignedNurse?->name,
            ],
            'treatment' => $plan ? [
                'id' => $plan->id,
                'plan_name' => $plan->plan_name,
                'regimen_type' => $plan->regimen_type,
                'phase' => $plan->phase,
                'status' => $plan->status,
            ] : null,
            'dose' => [
                'medication_log_id' => $this->medication_log_id,
                'medication_name' => $medication?->name
                    ? trim($medication->name.($medication->strength ? " {$medication->strength}" : ''))
                    : null,
                'dosage' => $tpm?->dosage,
                'dose_quantity' => $log?->dose_quantity,
                'scheduled_date' => $log?->scheduled_date?->toDateString(),
                'scheduled_time' => $log?->scheduled_time ? substr($log->scheduled_time, 0, 5) : null,
                'taken_at' => $log?->taken_at?->toIso8601String(),
                'dose_status' => $log?->status,
                'verification_status' => $log?->verification_status,
            ],
        ];
    }
}
