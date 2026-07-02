<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('treatment_plan_medication', function (Blueprint $table) {
            $table->id();
            $table->foreignId('treatment_plan_id')->constrained()->cascadeOnDelete();
            $table->foreignId('medication_id')->constrained()->restrictOnDelete();
            $table->string('dosage', 50);
            $table->string('frequency', 100);
            $table->string('route', 50)->default('oral');
            $table->integer('duration_weeks');
            $table->time('preferred_time')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['treatment_plan_id', 'medication_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('treatment_plan_medication');
    }
};
