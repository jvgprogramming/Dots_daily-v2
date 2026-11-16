<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The VOT review state of a dose, denormalised from its latest submission so
 * adherence, the calendar and reports can read it without a join.
 *
 * NULL means "not a VOT dose" — every existing row and every non-VOT patient's
 * dose keeps working exactly as before. For VOT doses:
 *   awaiting_proof         logged without proof yet        (held out of adherence)
 *   pending                proof submitted, not reviewed   (counts)
 *   verified               a nurse confirmed the proof     (counts)
 *   rejected               a nurse rejected the proof      (held out)
 *   resubmission_required  a nurse asked for new proof     (held out)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medication_logs', function (Blueprint $table) {
            $table->string('verification_status', 30)->nullable()->after('status');
            $table->index('verification_status');
        });
    }

    public function down(): void
    {
        Schema::table('medication_logs', function (Blueprint $table) {
            $table->dropIndex(['verification_status']);
            $table->dropColumn('verification_status');
        });
    }
};
