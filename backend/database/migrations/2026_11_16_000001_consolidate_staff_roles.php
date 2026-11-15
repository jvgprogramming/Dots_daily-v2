<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Collapse the staff role vocabulary to the two portal roles we actually
 * support: `admin` (everything) and `staff` (clinical workflow, no system
 * settings). The old `clinician` and `nurse` roles are folded into `staff`,
 * and module access is rewritten from each account's role preset.
 *
 * `patient` is untouched — those accounts are mobile-only.
 */
return new class extends Migration
{
    /** Modules an admin may use. */
    private const ADMIN_PERMISSIONS = ['patients', 'treatments', 'monitoring', 'medications', 'reports', 'settings'];

    /** Modules a staff account may use; `settings` stays admin-only. */
    private const STAFF_PERMISSIONS = ['patients', 'treatments', 'monitoring', 'medications', 'reports'];

    public function up(): void
    {
        DB::table('users')
            ->whereIn('role', ['clinician', 'nurse'])
            ->update(['role' => 'staff']);

        DB::table('users')
            ->where('role', 'admin')
            ->update(['permissions' => json_encode(self::ADMIN_PERMISSIONS)]);

        DB::table('users')
            ->where('role', 'staff')
            ->update(['permissions' => json_encode(self::STAFF_PERMISSIONS)]);
    }

    public function down(): void
    {
        // The original role of each converted account cannot be recovered, so
        // rolling back only re-opens the permissions column.
        DB::table('users')
            ->whereIn('role', ['admin', 'staff'])
            ->update(['permissions' => null]);
    }
};
