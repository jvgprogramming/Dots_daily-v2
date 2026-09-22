<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add baseline weight to the patients record.
 *
 * Weight at treatment start is the anchor for weight-based TB dosing and is
 * tracked over time in daily_monitoring.weight_kg. This column stores the
 * intake value captured during registration.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->decimal('weight_kg', 5, 2)->nullable()->after('civil_status');
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumn('weight_kg');
        });
    }
};
