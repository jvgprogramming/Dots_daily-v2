<?php

namespace App\Http\Requests;

use App\Support\Symptoms;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates a patient's symptom self-report from the Flutter app.
 *
 * One report may carry several symptoms (the patient ticks everything they feel
 * and rates each), so `symptoms` is an array — the controller writes one
 * `symptom_logs` row per entry. Types and severities are checked against the
 * shared catalogue in App\Support\Symptoms so the app and API never drift.
 */
class StoreSymptomLogRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Route is behind auth:sanctum; the controller rejects a non-patient
        // account with a tailored 403.
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'recorded_date' => ['nullable', 'date_format:Y-m-d'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'symptoms' => ['required', 'array', 'min:1', 'max:20'],
            'symptoms.*.type' => ['required', 'string', Rule::in(Symptoms::slugs())],
            'symptoms.*.severity' => ['required', 'string', Rule::in(Symptoms::SEVERITIES)],
            'symptoms.*.duration_hours' => ['nullable', 'integer', 'min:0', 'max:8760'],
        ];
    }
}
