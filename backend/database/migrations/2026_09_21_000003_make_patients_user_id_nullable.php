<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Draft registrations have no login account yet, so user_id must be nullable.
     *
     * Raw SQL on purpose: Laravel's ->change() re-creates the column's indexes and
     * fails with "Duplicate key name 'patients_user_id_unique'" on MySQL, while a
     * plain MODIFY leaves the existing unique index and FK constraint untouched.
     */
    public function up(): void
    {
        // SQLite (the test suite's in-memory database) has no MODIFY COLUMN and
        // no need for this: every patient it creates is created with a user.
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('ALTER TABLE `patients` MODIFY `user_id` BIGINT UNSIGNED NULL');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('ALTER TABLE `patients` MODIFY `user_id` BIGINT UNSIGNED NOT NULL');
    }
};
