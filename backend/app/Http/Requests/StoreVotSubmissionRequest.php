<?php

namespace App\Http\Requests;

use App\Support\AppSettings;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A patient's proof upload (video or photo) for one scheduled dose.
 *
 * Limits come from Settings → Video-Observed Therapy so the clinic controls
 * them. File type is checked against the *detected* content type, not the
 * name or the type the phone claims.
 */
class StoreVotSubmissionRequest extends FormRequest
{
    private const VIDEO_MIMES = 'video/mp4,video/quicktime,video/3gpp';

    private const PHOTO_MIMES = 'image/jpeg,image/png,image/heic,image/heif';

    public function authorize(): bool
    {
        // Patient-profile and enrollment checks happen in VotService, which
        // answers with messages the app can show.
        return $this->user()?->isPatient() ?? false;
    }

    public function rules(): array
    {
        $isVideo = $this->input('media_type') === 'video';
        $maxKb = AppSettings::int($isVideo ? 'vot.max_video_mb' : 'vot.max_photo_mb', $isVideo ? 64 : 10) * 1024;

        return [
            'scheduled_date' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'scheduled_time' => ['required', 'date_format:H:i'],
            'taken_at' => ['nullable', 'date'],
            'treatment_plan_medication_id' => ['nullable', 'integer'],
            'media_type' => ['required', Rule::in(AppSettings::list('vot.allowed_media'))],
            'media' => [
                'required',
                'file',
                'mimetypes:'.($isVideo ? self::VIDEO_MIMES : self::PHOTO_MIMES),
                "max:{$maxKb}",
            ],
            'duration_seconds' => [
                Rule::requiredIf($isVideo),
                'nullable',
                'integer',
                'min:'.AppSettings::int('vot.min_video_seconds', 5),
                'max:'.AppSettings::int('vot.max_video_seconds', 120),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'media_type.in' => 'Your clinic does not accept this kind of proof.',
            'media.mimetypes' => $this->input('media_type') === 'video'
                ? 'The proof must be an MP4 or QuickTime video.'
                : 'The proof must be a JPEG, PNG or HEIC photo.',
            'media.max' => 'The file is too large to upload.',
            'duration_seconds.min' => 'The video is too short. Please record the whole dose.',
            'duration_seconds.max' => 'The video is too long. Please keep it shorter.',
            'scheduled_date.before_or_equal' => 'You cannot submit proof for a future dose.',
        ];
    }
}
