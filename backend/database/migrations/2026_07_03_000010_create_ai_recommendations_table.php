<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_recommendations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('daily_monitoring_id')->constrained('daily_monitoring')->cascadeOnDelete();
            $table->string('type', 50);
            $table->string('title');
            $table->text('description');
            $table->string('severity', 10)->default('info');
            $table->string('status', 10)->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('source', 100);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('type');
            $table->index('status');
            $table->index('severity');
            $table->index(['patient_id', 'status', 'severity']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_recommendations');
    }
};
