<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medication_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('treatment_plan_medication_id')->constrained('treatment_plan_medication')->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->date('scheduled_date');
            $table->time('scheduled_time');
            $table->timestamp('taken_at')->nullable();
            $table->string('status', 20);
            $table->string('dose_quantity', 50)->nullable();
            $table->string('proof_photo')->nullable();
            $table->foreignId('daily_monitoring_id')->nullable()->constrained('daily_monitoring')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->foreignId('observed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('scheduled_date');
            $table->index('status');
            $table->index('daily_monitoring_id');
            $table->index(['patient_id', 'scheduled_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medication_logs');
    }
};
