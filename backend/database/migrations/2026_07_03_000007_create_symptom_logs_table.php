<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('symptom_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->date('recorded_date');
            $table->string('symptom_type', 100);
            $table->string('severity', 10);
            $table->integer('duration_hours')->nullable();
            $table->text('notes')->nullable();
            $table->string('recorded_by', 20)->default('patient');
            $table->foreignId('daily_monitoring_id')->nullable()->constrained('daily_monitoring')->nullOnDelete();
            $table->timestamps();

            $table->index('recorded_date');
            $table->index('symptom_type');
            $table->index('daily_monitoring_id');
            $table->index(['patient_id', 'recorded_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('symptom_logs');
    }
};
