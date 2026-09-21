<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Extend patients: registration status + draft payload + extra demographics ──
        Schema::table('patients', function (Blueprint $table) {
            $table->string('status', 20)->default('registered')->after('referred_by'); // draft | registered
            $table->json('draft_data')->nullable()->after('status'); // full wizard payload while draft
            $table->string('last_name')->nullable()->after('status');
            $table->string('first_name')->nullable()->after('last_name');
            $table->string('middle_name')->nullable()->after('first_name');
            $table->string('name_extension', 20)->nullable()->after('middle_name');
            $table->string('philhealth_number', 30)->nullable()->after('health_id_number');
            $table->string('civil_status', 20)->nullable()->after('gender');

            $table->index('status');
        });

        // ── TB notifications (Step 1: notification & facility) ──
        Schema::create('tb_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->string('reason', 50)->default('new'); // new | update | final_outcome
            $table->string('facility_name')->nullable();
            $table->string('ntp_facility_code', 50)->nullable();
            $table->string('province_huc')->nullable();
            $table->string('region')->nullable();
            $table->timestamps();

            $table->index('reason');
            $table->index(['patient_id', 'reason']);
        });

        // ── Laboratory tests (Step 3) ──
        Schema::create('laboratory_tests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->string('test_type', 50); // xpert | xpert_ultra | smear | tb_lamp | cxr | tst | other
            $table->string('test_name')->nullable(); // label for 'other'
            $table->date('test_date')->nullable();
            $table->string('result')->nullable(); // result/reading, free text or controlled value
            $table->string('status', 20)->default('done'); // done | not_available | not_yet_done
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->index(['patient_id', 'test_type']);
        });

        // ── Diagnoses (Step 4) ──
        Schema::create('diagnoses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->string('diagnosis_type', 20); // tb_disease | tb_infection
            $table->date('diagnosis_date')->nullable();
            $table->date('notification_date')->nullable();
            $table->string('case_number', 50)->nullable();
            $table->string('attending_physician')->nullable();
            // Referral info
            $table->string('referral_name')->nullable();
            $table->text('referral_address')->nullable();
            $table->string('referral_facility_code', 50)->nullable();
            $table->string('referral_province_huc')->nullable();
            $table->string('referral_region')->nullable();
            $table->timestamps();

            $table->index(['patient_id', 'diagnosis_type']);
        });

        // ── TB classifications (Step 5) ──
        Schema::create('tb_classifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->string('bacteriological_status', 50)->nullable(); // bacteriologically_confirmed | clinically_diagnosed
            $table->string('anatomical_site', 30)->nullable(); // pulmonary | extrapulmonary
            $table->string('extrapulmonary_site')->nullable();
            $table->string('drug_resistance_status', 50)->nullable(); // drug_susceptible | bc_rr_tb | bc_mdr_tb | bc_xdr_tb | cd_mdr_tb | other_dr_resistant
            $table->string('registration_group', 30)->nullable(); // new | relapse | taf | tpt | talf | unknown_history
            $table->timestamps();

            $table->index(['patient_id', 'registration_group']);
        });

        // ── Close contacts (Step 8) ──
        Schema::create('close_contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->string('full_name');
            $table->unsignedTinyInteger('age')->nullable();
            $table->string('sex', 10)->nullable();
            $table->string('relationship')->nullable();
            $table->date('screening_date')->nullable();
            $table->date('followup_date')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->index('patient_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('close_contacts');
        Schema::dropIfExists('tb_classifications');
        Schema::dropIfExists('diagnoses');
        Schema::dropIfExists('laboratory_tests');
        Schema::dropIfExists('tb_notifications');

        Schema::table('patients', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropColumn([
                'status',
                'draft_data',
                'last_name',
                'first_name',
                'middle_name',
                'name_extension',
                'philhealth_number',
                'civil_status',
            ]);
        });
    }
};
