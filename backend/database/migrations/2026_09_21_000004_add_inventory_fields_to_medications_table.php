<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add medicine inventory fields to the existing medications table:
     * dosage, stock quantity, storage condition, expiry tracking and
     * computed stock status — powering the Medication module.
     *
     * Idempotent: each column/index is only added when missing, so a
     * previously partial run can be re-run safely.
     */
    public function up(): void
    {
        Schema::table('medications', function (Blueprint $table) {
            $add = fn (string $col) => ! Schema::hasColumn('medications', $col);

            // Dosage presentation, e.g. "300mg capsule", "75mg FDC tablet"
            if ($add('dosage')) {
                $table->string('dosage', 100)->nullable()->after('generic_name');
            }

            // Inventory — `unit` already exists on the base table, reuse it
            if ($add('quantity')) {
                $table->unsignedInteger('quantity')->default(0)->after('dosage');
            }
            if ($add('reorder_level')) {
                $table->unsignedInteger('reorder_level')->default(10)->after('quantity');
            }

            // Storage: room_temperature | refrigerator | cold_storage | special
            if ($add('storage_condition')) {
                $table->string('storage_condition', 30)->default('room_temperature')->after('unit');
            }

            // Expiry + computed stock status: in_stock | low_stock | out_of_stock | expired
            if ($add('expiry_date')) {
                $table->date('expiry_date')->nullable()->after('storage_condition');
            }
            if ($add('stock_status')) {
                $table->string('stock_status', 20)->default('in_stock')->after('expiry_date');
            }
            if ($add('last_restocked_at')) {
                $table->timestamp('last_restocked_at')->nullable()->after('stock_status');
            }
            if ($add('notes')) {
                $table->text('notes')->nullable()->after('last_restocked_at');
            }
        });

        // Indexes (added separately so they are skipped cleanly on re-run)
        $indexes = [
            'medications_expiry_date_index' => fn () => Schema::table('medications', fn (Blueprint $t) => $t->index('expiry_date')),
            'medications_stock_status_index' => fn () => Schema::table('medications', fn (Blueprint $t) => $t->index('stock_status')),
            'medications_storage_condition_index' => fn () => Schema::table('medications', fn (Blueprint $t) => $t->index('storage_condition')),
        ];
        foreach ($indexes as $name => $create) {
            if (! collect(Schema::getIndexes('medications'))->pluck('name')->contains($name)) {
                $create();
            }
        }
    }

    public function down(): void
    {
        Schema::table('medications', function (Blueprint $table) {
            $drop = fn (string $col) => Schema::hasColumn('medications', $col);

            $cols = ['dosage', 'quantity', 'reorder_level', 'storage_condition', 'expiry_date', 'stock_status', 'last_restocked_at', 'notes'];
            foreach ($cols as $col) {
                if ($drop($col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
