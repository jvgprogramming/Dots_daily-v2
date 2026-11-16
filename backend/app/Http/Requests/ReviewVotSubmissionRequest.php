<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * A nurse's decision on a proof. Verifying takes optional notes; rejecting or
 * asking for new proof must say why — the patient is shown that reason.
 */
class ReviewVotSubmissionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('review', $this->route('submission')) ?? false;
    }

    public function rules(): array
    {
        $needsReason = $this->route()?->getActionMethod() !== 'verify';

        return [
            'reason' => [$needsReason ? 'required' : 'nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'reason.required' => 'Please give a reason — the patient will see it.',
        ];
    }
}
