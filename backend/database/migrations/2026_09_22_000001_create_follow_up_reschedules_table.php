<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Minimal audit trail for rescheduled treatment follow-ups.
 *
 * The schedule itself is derived live from treatment plans (monthly anchors
 * between start_date and expected_end_date) — this table only stores the
 * reschedule events so history and reporting can distinguish
 * scheduled vs rescheduled follow-ups. No duplicate schedule storage.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('follow_up_reschedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('treatment_plan_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->date('original_date');      // follow-up date before the reschedule
            $table->date('new_date');           // follow-up date after the reschedule
            $table->date('rescheduled_at');     // the day the change was recorded
            $table->string('reason')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('rescheduled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['treatment_plan_id', 'original_date']);
            $table->index('patient_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('follow_up_reschedules');
    }
};
