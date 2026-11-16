<?php

namespace App\Http\Controllers\API;

use App\Models\MedicationLog;
use App\Models\VotSubmission;
use App\Support\ProofMedia;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Streams private proof media to whoever holds a valid signed link.
 *
 * These routes sit behind the `signed` middleware instead of `auth:sanctum`:
 * the link is only ever issued by an authenticated, authorised API call
 * (see ProofMedia), and it expires. A BinaryFileResponse is used because it
 * honours HTTP Range requests, which a <video> element needs to seek.
 */
class ProofMediaController extends BaseApiController
{
    public function log(MedicationLog $log, string $kind): BinaryFileResponse
    {
        abort_unless(in_array($kind, ['photo', 'video'], true), 404);

        $key = $kind === 'video' ? $log->proof_video_path : $log->proof_photo;

        return $this->stream(ProofMedia::absolutePath($key), $kind === 'video' ? $log->proof_video_mime : null);
    }

    public function submission(VotSubmission $submission): BinaryFileResponse
    {
        return $this->stream(ProofMedia::absolutePath($submission->media_path), $submission->media_mime);
    }

    private function stream(?string $path, ?string $mime): BinaryFileResponse
    {
        abort_if($path === null, 404, 'Media not found.');

        return response()->file($path, array_filter([
            'Content-Type' => $mime,
            // Health data: never cache in shared caches, never index.
            'Cache-Control' => 'private, no-store, max-age=0',
            'X-Robots-Tag' => 'noindex',
            'Content-Disposition' => 'inline',
        ]));
    }
}
