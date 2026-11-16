<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds in-app video proof of intake to each dose log.
 *
 * `proof_video_path` holds a file path on the public disk (the clip itself is
 * stored as a file, not in the DB); the mime and size columns let the admin
 * side validate and report on the upload without opening it. Kept separate from
 * `proof_photo`, which the web portal already renders as an image.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medication_logs', function (Blueprint $table) {
            $table->string('proof_video_path')->nullable()->after('proof_photo');
            $table->string('proof_video_mime', 64)->nullable()->after('proof_video_path');
            $table->unsignedInteger('proof_video_size')->nullable()->after('proof_video_mime');
        });
    }

    public function down(): void
    {
        Schema::table('medication_logs', function (Blueprint $table) {
            $table->dropColumn(['proof_video_path', 'proof_video_mime', 'proof_video_size']);
        });
    }
};
