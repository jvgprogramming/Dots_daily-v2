<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per proof attempt (video or photo) for a scheduled dose.
 *
 * The dose itself stays the single `medication_logs` row (unique per patient,
 * medicine and day), so a resubmission adds an attempt here instead of a
 * second dose — a dose can never be counted twice. Earlier attempts are kept
 * with their review outcome, which is the resubmission history.
 *
 * The media file lives on the private `local` disk; only its path is stored.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vot_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('medication_log_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('treatment_plan_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedSmallInteger('attempt')->default(1);
            $table->string('media_type', 10); // video | photo
            $table->string('media_path');
            $table->string('media_mime', 64)->nullable();
            $table->unsignedInteger('media_size')->nullable();
            $table->unsignedSmallInteger('duration_seconds')->nullable();
            $table->timestamp('submitted_at');
            // pending | verified | rejected | resubmission_requested
            $table->string('status', 30)->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('review_reason', 500)->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('submitted_at');
            $table->index(['medication_log_id', 'attempt']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vot_submissions');
    }
};
