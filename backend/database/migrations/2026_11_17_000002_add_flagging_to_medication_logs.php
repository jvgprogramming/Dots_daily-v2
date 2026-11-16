<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Shifts the DOTS review model from "verify every dose" to "logged by default,
 * flag by exception". A recorded dose counts immediately; a nurse flags one
 * whose proof video looks suspicious. A flagged dose is excluded from adherence
 * until it is resolved (unflagged).
 *
 * `observed_by` is left in place for backward compatibility; the new workflow
 * uses these columns instead.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medication_logs', function (Blueprint $table) {
            $table->timestamp('flagged_at')->nullable()->after('observed_by');
            $table->foreignId('flagged_by')->nullable()->after('flagged_at')
                ->constrained('users')->nullOnDelete();
            $table->string('flag_reason', 500)->nullable()->after('flagged_by');
        });
    }

    public function down(): void
    {
        Schema::table('medication_logs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('flagged_by');
            $table->dropColumn(['flagged_at', 'flag_reason']);
        });
    }
};
