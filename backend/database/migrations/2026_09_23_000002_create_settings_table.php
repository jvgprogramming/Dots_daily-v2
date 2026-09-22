<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * System settings storage — a grouped key/value store for the Settings
 * control panel (facility profile, clinical rules, notification channels,
 * report defaults, security policies). One row per setting key.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('group', 50);        // facility | clinical | notifications | reports | security
            $table->string('key', 100);         // e.g. facility_name, late_dose_threshold_minutes
            $table->text('value')->nullable();  // stored as string; typed by the consumer
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['group', 'key']);
            $table->index('group');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
