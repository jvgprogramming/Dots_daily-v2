<?php

namespace App\Support;

use App\Models\MedicationLog;
use App\Models\VotSubmission;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

/**
 * Where proof-of-intake media (photos and videos) is kept, and how it is shown.
 *
 * Proof media is health data, so it lives on the private `local` disk
 * (storage/app/private) — never under public/. It is reached only through a
 * signed, expiring URL that the API hands out *after* it has checked who is
 * asking. The signature means a browser <video>/<img> tag can load it without
 * an Authorization header, and the expiry means a leaked link stops working.
 */
class ProofMedia
{
    public const DISK = 'local';

    /** How long a handed-out media link stays valid. */
    public const LINK_TTL_MINUTES = 30;

    /** Store an uploaded proof file privately; returns its disk key. */
    public static function store(UploadedFile $file, int $patientId, string $kind): string
    {
        $ext = $file->guessExtension() ?: ($kind === 'video' ? 'mp4' : 'jpg');

        // Random name: nothing about the patient or dose leaks via the path.
        return $file->storeAs("proofs/{$patientId}/{$kind}s", Str::uuid().'.'.$ext, self::DISK);
    }

    /** Signed URL for a dose log's proof photo or video (null when it has none). */
    public static function logUrl(MedicationLog $log, string $kind): ?string
    {
        $path = $kind === 'video' ? $log->proof_video_path : $log->proof_photo;

        if (! $path) {
            return null;
        }

        // Legacy demo data hosted elsewhere — nothing of ours to protect.
        if (Str::startsWith($path, ['http://', 'https://'])) {
            return $path;
        }

        return URL::temporarySignedRoute(
            'proof-media.log',
            now()->addMinutes(self::LINK_TTL_MINUTES),
            ['log' => $log->id, 'kind' => $kind],
        );
    }

    /** Signed URL for one VOT submission's media. */
    public static function submissionUrl(VotSubmission $submission): string
    {
        return URL::temporarySignedRoute(
            'proof-media.vot',
            now()->addMinutes(self::LINK_TTL_MINUTES),
            ['submission' => $submission->id],
        );
    }

    /** Absolute path on the private disk, or null if the file is missing. */
    public static function absolutePath(?string $key): ?string
    {
        if (! $key || Str::startsWith($key, ['http://', 'https://'])) {
            return null;
        }

        $disk = Storage::disk(self::DISK);

        return $disk->exists($key) ? $disk->path($key) : null;
    }

    public static function delete(?string $key): void
    {
        if ($key && ! Str::startsWith($key, ['http://', 'https://'])) {
            Storage::disk(self::DISK)->delete($key);
        }
    }
}
