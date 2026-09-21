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
        DB::statement('ALTER TABLE `patients` MODIFY `user_id` BIGINT UNSIGNED NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE `patients` MODIFY `user_id` BIGINT UNSIGNED NOT NULL');
    }
};
