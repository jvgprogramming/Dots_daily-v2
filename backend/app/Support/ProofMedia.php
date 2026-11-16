<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Resolves a stored proof-media path (photo or video) to a displayable URL.
 *
 * The same three path shapes have been resolved inline in several controllers
 * (reports proof gallery, monitoring, dose verification). This centralises that
 * logic so the photo and the new video proof share one implementation.
 */
class ProofMedia
{
    /**
     * Accepts a full URL (passed through), a `storage/`-prefixed path, or a
     * bare key on the public disk. Returns null for an empty path.
     */
    public static function url(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        if (Str::startsWith($path, ['http://', 'https://'])) {
            return $path;
        }

        if (Str::startsWith($path, 'storage/')) {
            return rtrim(config('app.url'), '/').'/'.ltrim($path, '/');
        }

        return Storage::disk('public')->url(ltrim($path, '/'));
    }
}
