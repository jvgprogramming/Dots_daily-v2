<?php

namespace App\Http\Requests;

use App\Models\User;
use App\Models\VotEnrollment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** A nurse grants, suspends or revokes a patient's VOT eligibility. */
class UpdateVotEnrollmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manageVot', $this->route('patient')) ?? false;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(VotEnrollment::STATUSES)],
            'eligible_since' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
            // Must be an active portal user — a patient account can't review proofs.
            'assigned_nurse_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(
                    fn ($q) => $q->whereIn('role', User::PORTAL_ROLES)->where('is_active', true),
                ),
            ],
            'notes' => ['nullable', 'string', 'max:2000'],
            // Taking VOT away from a patient is a clinical decision — record why.
            'status_reason' => [
                Rule::requiredIf(fn () => in_array($this->input('status'), [VotEnrollment::STATUS_SUSPENDED, VotEnrollment::STATUS_REVOKED], true)),
                'nullable',
                'string',
                'max:500',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'status_reason.required' => 'Please give a reason for suspending or revoking VOT.',
            'assigned_nurse_id.exists' => 'Choose an active nurse or admin account.',
            'eligible_since.before_or_equal' => 'The eligibility date cannot be in the future.',
        ];
    }
}
