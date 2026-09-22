<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One adherence row per patient, per prescribed medicine, per day.
     *
     * The mobile app logs a single combined daily intake, so this index is what
     * makes that write idempotent: a repeated tap (or a retried offline sync)
     * updates the existing row instead of adding a second one and inflating the
     * dose counts the admin reports read.
     *
     * Scoped to the medicine (not just patient + day) so a future twice-daily
     * regimen can still record two doses on the same date.
     */
    public function up(): void
    {
        // Collapse any duplicates from factory/demo data so the index can be
        // created; the oldest row wins. Resolved in PHP rather than as a
        // subquery because MySQL forbids selecting from the table it is deleting.
        $keepIds = DB::table('medication_logs')
            ->selectRaw('MIN(id) as keep_id')
            ->groupBy('patient_id', 'treatment_plan_medication_id', 'scheduled_date')
            ->pluck('keep_id');

        // Guarded because whereNotIn() with an empty list is `1 = 1` — i.e. it
        // would match every row instead of none.
        if ($keepIds->isNotEmpty()) {
            DB::table('medication_logs')->whereNotIn('id', $keepIds)->delete();
        }

        Schema::table('medication_logs', function (Blueprint $table) {
            $table->unique(
                ['patient_id', 'treatment_plan_medication_id', 'scheduled_date'],
                'medication_logs_patient_medicine_day_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::table('medication_logs', function (Blueprint $table) {
            $table->dropUnique('medication_logs_patient_medicine_day_unique');
        });
    }
};
