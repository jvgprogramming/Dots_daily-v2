<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Proof photos and videos were stored on the `public` disk, reachable by anyone
 * with the URL. They are health data, so move them to the private `local` disk;
 * from now on they are only served through short-lived signed links
 * (see App\Support\ProofMedia).
 *
 * Paths that are full URLs (old seed/demo data hosted elsewhere) are left
 * untouched. `storage/…` paths are normalised to a bare disk key.
 */
return new class extends Migration
{
    public function up(): void
    {
        $public = Storage::disk('public');
        $private = Storage::disk('local');

        DB::table('medication_logs')
            ->where(fn ($q) => $q->whereNotNull('proof_photo')->orWhereNotNull('proof_video_path'))
            ->orderBy('id')
            ->chunkById(200, function ($rows) use ($public, $private) {
                foreach ($rows as $row) {
                    $updates = [];

                    foreach (['proof_photo', 'proof_video_path'] as $column) {
                        $path = $row->{$column};
                        if (! $path || Str::startsWith($path, ['http://', 'https://'])) {
                            continue;
                        }

                        $key = ltrim(Str::startsWith($path, 'storage/') ? Str::after($path, 'storage/') : $path, '/');

                        if ($public->exists($key) && ! $private->exists($key)) {
                            $private->writeStream($key, $public->readStream($key));
                            $public->delete($key);
                        }

                        if ($key !== $path) {
                            $updates[$column] = $key;
                        }
                    }

                    if ($updates !== []) {
                        DB::table('medication_logs')->where('id', $row->id)->update($updates);
                    }
                }
            });
    }

    public function down(): void
    {
        // Intentionally one-way: moving health data back to a public folder is
        // never something a rollback should do silently.
    }
};
