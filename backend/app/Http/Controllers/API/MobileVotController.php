<?php

namespace App\Http\Controllers\API;

use App\Http\Requests\StoreVotSubmissionRequest;
use App\Services\Vot\VotService;
use App\Support\AppSettings;
use App\Support\ProofMedia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Patient app: VOT status/instructions and proof upload. */
class MobileVotController extends BaseApiController
{
    public function __construct(private readonly VotService $vot) {}

    /**
     * GET /mobile/vot — whether this patient records proof, and the clinic's
     * instructions and limits for doing it. Always 200 for a patient account.
     */
    public function show(Request $request): JsonResponse
    {
        $patient = $request->user()?->patient;
        if (! $patient) {
            return $this->error('This account is not linked to a patient profile.', 403);
        }

        $enrollment = $patient->votEnrollment?->load('assignedNurse');

        return $this->success(data: [
            'enrolled' => $enrollment?->isActive() ?? false,
            'status' => $enrollment?->status,
            'assigned_nurse_name' => $enrollment?->assignedNurse?->name,
            'instructions' => array_values(array_filter(array_map(
                'trim',
                preg_split('/\R/', (string) AppSettings::get('vot.instructions')),
            ))),
            'allowed_media' => AppSettings::list('vot.allowed_media'),
            'min_video_seconds' => AppSettings::int('vot.min_video_seconds', 5),
            'max_video_seconds' => AppSettings::int('vot.max_video_seconds', 120),
            'max_video_mb' => AppSettings::int('vot.max_video_mb', 64),
            'max_photo_mb' => AppSettings::int('vot.max_photo_mb', 10),
            'allow_resubmit_after_reject' => AppSettings::bool('vot.allow_resubmit_after_reject'),
        ]);
    }

    /** POST /mobile/vot/submissions — multipart: dose fields + `media`. */
    public function store(StoreVotSubmissionRequest $request): JsonResponse
    {
        $patient = $request->user()->patient;
        if (! $patient) {
            return $this->error('This account is not linked to a patient profile.', 403);
        }

        $submission = $this->vot->submit($patient, $request->validated(), $request->file('media'));
        $log = $submission->medicationLog;

        return $this->created(
            data: [
                'submission' => [
                    'id' => $submission->id,
                    'attempt' => $submission->attempt,
                    'status' => $submission->status,
                    'media_type' => $submission->media_type,
                    'submitted_at' => $submission->submitted_at?->toIso8601String(),
                    'media_url' => ProofMedia::submissionUrl($submission),
                ],
                'dose' => [
                    'id' => $log->id,
                    'scheduled_date' => $log->scheduled_date?->toDateString(),
                    'scheduled_time' => substr((string) $log->scheduled_time, 0, 5),
                    'taken_at' => $log->taken_at?->toIso8601String(),
                    'status' => $log->status,
                    'verification_status' => $log->verification_status,
                ],
            ],
            message: 'Your proof was submitted and is waiting for your nurse to review it.',
        );
    }
}
