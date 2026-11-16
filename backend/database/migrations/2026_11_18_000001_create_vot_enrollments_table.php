<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Video-Observed Therapy eligibility, decided by clinic staff.
 *
 * One row per patient holds the *current* state (active / suspended / revoked);
 * every change is also written to `activity_logs`, which is the history.
 * The assigned nurse lives here rather than on `patients`, because it only
 * means something for a VOT patient (they review that patient's proofs).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vot_enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('status', 20); // active | suspended | revoked
            $table->date('eligible_since')->nullable();
            $table->foreignId('assigned_nurse_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('granted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->string('status_reason', 500)->nullable();
            $table->timestamp('status_changed_at')->nullable();
            $table->foreignId('status_changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vot_enrollments');
    }
};
