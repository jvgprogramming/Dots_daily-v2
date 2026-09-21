<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('treatment_plans', function (Blueprint $table) {
            $table->string('regimen_type', 50)->nullable()->after('plan_name'); // structured regimen at start
            $table->string('regimen_type_end', 50)->nullable()->after('regimen_type'); // regimen at end (filled at outcome)
            $table->string('outcome', 30)->nullable()->after('regimen_type_end'); // cured | treatment_completed | died | failed | lost_to_followup
            $table->date('outcome_date')->nullable()->after('outcome');
            $table->string('outcome_reason')->nullable()->after('outcome_date'); // reason for failed/LTFU/died
            $table->string('draft_reason', 20)->nullable()->after('outcome_reason'); // tracks draft vs final creation

            $table->index('regimen_type');
            $table->index('outcome');
        });
    }

    public function down(): void
    {
        Schema::table('treatment_plans', function (Blueprint $table) {
            $table->dropIndex(['regimen_type']);
            $table->dropIndex(['outcome']);
            $table->dropColumn([
                'regimen_type',
                'regimen_type_end',
                'outcome',
                'outcome_date',
                'outcome_reason',
                'draft_reason',
            ]);
        });
    }
};
