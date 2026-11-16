<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates a patient's dose-log write from the Flutter app.
 *
 * The plain "I took my dose" confirmation. Proof media is not accepted here —
 * VOT patients send it to /mobile/vot/submissions (StoreVotSubmissionRequest).
 * The patient→profile check and the "which prescribed medicine" resolution
 * stay in the controller, which returns tailored 403/409 messages the generic
 * authorize() cannot.
 */
class StoreDoseLogRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Route is already behind auth:sanctum; the controller does the
        // patient-profile and regimen checks with specific messages.
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'scheduled_date' => ['required', 'date_format:Y-m-d'],
            'scheduled_time' => ['required', 'date_format:H:i'],
            'taken_at' => ['nullable', 'date'],
            'status' => ['nullable', 'in:taken,late,missed,skipped'],
            'dose_quantity' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'treatment_plan_medication_id' => ['nullable', 'integer'],
        ];
    }
}
