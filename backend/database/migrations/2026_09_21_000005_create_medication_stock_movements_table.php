<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Stock movement ledger for medicine inventory.
     * Every quantity change (restock, deduction, correction) is recorded
     * here so admins can audit who changed what, when, and why.
     */
    public function up(): void
    {
        Schema::create('medication_stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('medication_id')->constrained('medications')->cascadeOnDelete();
            // adjustment | restock | deduction | initial
            $table->string('type', 20);
            // Signed delta: +50 restock, -3 deduction, -2 correction
            $table->integer('quantity_change');
            $table->unsignedInteger('quantity_before');
            $table->unsignedInteger('quantity_after');
            $table->text('reason')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['medication_id', 'created_at']);
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medication_stock_movements');
    }
};
