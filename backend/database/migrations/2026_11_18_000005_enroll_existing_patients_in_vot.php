<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * VOT is now the default for every patient: give each existing patient with no
 * enrollment record an active one. Patients staff already suspended or revoked
 * keep their record untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        DB::table('patients')
            ->whereNull('deleted_at')
            ->whereNotExists(fn ($q) => $q->select(DB::raw(1))
                ->from('vot_enrollments')
                ->whereColumn('vot_enrollments.patient_id', 'patients.id'))
            ->orderBy('id')
            ->chunkById(500, function ($patients) use ($now) {
                DB::table('vot_enrollments')->insert($patients->map(fn ($p) => [
                    'patient_id' => $p->id,
                    'status' => 'active',
                    'eligible_since' => $now->toDateString(),
                    'status_changed_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->all());
            });
    }

    public function down(): void
    {
        // Not reversible: staff may have edited these enrollments since.
    }
};
