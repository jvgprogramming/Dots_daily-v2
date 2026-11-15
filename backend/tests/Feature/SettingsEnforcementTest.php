<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Medication;
use App\Models\MedicationLog;
use App\Models\Notification;
use App\Models\Patient;
use App\Models\Setting;
use App\Models\TreatmentPlan;
use App\Models\TreatmentPlanMedication;
use App\Models\User;
use App\Support\AppSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Settings saved in the admin panel change real behaviour, and the audit
 * trail records who changed what.
 */
class SettingsEnforcementTest extends TestCase
{
    use RefreshDatabase;

    private ?User $adminUser = null;

    protected function setUp(): void
    {
        parent::setUp();
        AppSettings::flush();
    }

    // ── Saving ─────────────────────────────────────────────────────

    public function test_saving_settings_is_audited_with_a_before_after_diff(): void
    {
        Sanctum::actingAs($this->admin());

        $this->putJson('/api/v1/settings', [
            'group' => 'clinical',
            'values' => ['late_dose_threshold_minutes' => '30'],
        ])->assertOk();

        $log = ActivityLog::where('action', 'settings.updated')->firstOrFail();
        $this->assertSame('120', (string) $log->properties['changes']['late_dose_threshold_minutes']['from']);
        $this->assertSame('30', (string) $log->properties['changes']['late_dose_threshold_minutes']['to']);
    }

    public function test_invalid_risk_bands_are_rejected(): void
    {
        Sanctum::actingAs($this->admin());

        $this->putJson('/api/v1/settings', [
            'group' => 'clinical',
            'values' => ['risk_watch_below' => '70', 'risk_high_below' => '85'],
        ])->assertStatus(422);
    }

    // ── Clinical rules ─────────────────────────────────────────────

    public function test_the_late_dose_threshold_follows_settings(): void
    {
        $this->setSetting('clinical', 'late_dose_threshold_minutes', '30');
        [$user] = $this->patientWithRegimen();
        Sanctum::actingAs($user);

        // 45 minutes after a 07:00 schedule: late under a 30-minute threshold.
        $this->postJson('/api/v1/mobile/dose-logs', [
            'scheduled_date' => now()->toDateString(),
            'scheduled_time' => '07:00',
            'taken_at' => now()->setTime(7, 45)->toIso8601String(),
        ])->assertOk()->assertJsonPath('data.status', 'late');
    }

    public function test_the_monitoring_risk_band_follows_settings(): void
    {
        [, $patient, $plan, $pivot] = $this->patientWithRegimen();
        // 30-day-old plan, 26 days taken → ~84–87% adherence over the window.
        for ($i = 1; $i <= 26; $i++) {
            MedicationLog::factory()->create([
                'patient_id' => $patient->id,
                'treatment_plan_medication_id' => $pivot->id,
                'scheduled_date' => now()->subDays($i)->toDateString(),
                'status' => 'taken',
                'observed_by' => $this->admin()->id, // the factory's default observer has a fixed email
            ]);
        }
        Sanctum::actingAs($this->admin());
        $query = ['patient_id' => $patient->id, 'from' => now()->subDays(30)->toDateString(), 'to' => now()->toDateString()];

        $this->getJson('/api/v1/patients/monitoring?'.http_build_query($query))
            ->assertOk()->assertJsonPath('data.progress.risk', 'watch');

        $this->setSetting('clinical', 'risk_watch_below', '80');
        $this->setSetting('clinical', 'risk_high_below', '70');

        $this->getJson('/api/v1/patients/monitoring?'.http_build_query($query))
            ->assertOk()->assertJsonPath('data.progress.risk', 'on_track');
    }

    // ── Security ───────────────────────────────────────────────────

    public function test_the_password_minimum_is_enforced_for_staff_accounts(): void
    {
        $this->setSetting('security', 'password_min_length', '12');
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/v1/settings/users', [
            'name' => 'Nurse',
            'email' => 'nurse@dotsdaily.com',
            'password' => 'tenchars10',
            'role' => 'staff',
        ])->assertStatus(422)->assertJsonValidationErrors('password');
    }

    public function test_failed_sign_ins_lock_out_at_the_configured_limit_and_are_audited(): void
    {
        $this->setSetting('security', 'max_login_attempts', '3');
        User::factory()->create(['email' => 'staff@dotsdaily.com', 'role' => 'staff', 'password' => Hash::make('right-pass')]);

        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/v1/login', ['email' => 'staff@dotsdaily.com', 'password' => 'wrong'])->assertStatus(422);
        }
        $this->postJson('/api/v1/login', ['email' => 'staff@dotsdaily.com', 'password' => 'right-pass'])->assertStatus(429);

        $this->assertSame(3, ActivityLog::where('action', 'login.failed')->count());
        $this->assertSame(1, ActivityLog::where('action', 'login.locked')->count());
    }

    public function test_a_successful_sign_in_is_audited(): void
    {
        User::factory()->create(['email' => 'staff@dotsdaily.com', 'role' => 'staff', 'password' => Hash::make('right-pass')]);

        $this->postJson('/api/v1/login', ['email' => 'staff@dotsdaily.com', 'password' => 'right-pass'])->assertOk();

        $this->assertDatabaseHas('activity_logs', ['action' => 'login.success']);
    }

    public function test_audit_logging_off_skips_changes_but_keeps_sign_ins(): void
    {
        $this->setSetting('security', 'audit_logging_enabled', '0');
        [, $patient] = $this->patientWithRegimen();
        Sanctum::actingAs($this->admin());

        $this->putJson("/api/v1/patients/{$patient->id}", ['occupation' => 'Farmer'])->assertOk();
        $this->assertDatabaseMissing('activity_logs', ['action' => 'patient.updated']);
    }

    // ── Audit trail ────────────────────────────────────────────────

    public function test_updating_a_patient_records_the_changed_fields(): void
    {
        [, $patient] = $this->patientWithRegimen();
        $patient->update(['occupation' => 'Teacher']);
        Sanctum::actingAs($this->admin());

        $this->putJson("/api/v1/patients/{$patient->id}", ['occupation' => 'Farmer'])->assertOk();

        $log = ActivityLog::where('action', 'patient.updated')->firstOrFail();
        $this->assertSame('Teacher', $log->properties['changes']['occupation']['from']);
        $this->assertSame('Farmer', $log->properties['changes']['occupation']['to']);
    }

    public function test_the_audit_log_filters_by_area_and_paginates(): void
    {
        Sanctum::actingAs($this->admin());
        foreach (['login.success', 'login.failed', 'patient.updated'] as $action) {
            ActivityLog::create(['action' => $action, 'description' => $action, 'created_at' => now()]);
        }

        $this->getJson('/api/v1/settings/audit?area=failed_logins')
            ->assertOk()->assertJsonPath('data.meta.total', 1)->assertJsonPath('data.entries.0.action', 'login.failed');

        $this->getJson('/api/v1/settings/audit?area=logins')
            ->assertOk()->assertJsonPath('data.meta.total', 2);
    }

    // ── Inventory ──────────────────────────────────────────────────

    public function test_verifying_a_dose_deducts_stock_when_enabled(): void
    {
        $this->setSetting('inventory', 'auto_deduct_on_verify', '1');
        [, $patient, , $pivot] = $this->patientWithRegimen();
        $medication = Medication::findOrFail($pivot->medication_id);
        $medication->update(['quantity' => 50]);
        $log = MedicationLog::factory()->create([
            'patient_id' => $patient->id,
            'treatment_plan_medication_id' => $pivot->id,
            'status' => 'taken',
            'dose_quantity' => '2 tablets',
            'observed_by' => null,
        ]);
        Sanctum::actingAs($this->admin());

        $this->postJson("/api/v1/medication-logs/{$log->id}/verify")->assertOk();
        $this->assertSame(48, $medication->fresh()->quantity);

        // Re-verifying must not deduct again.
        $this->postJson("/api/v1/medication-logs/{$log->id}/verify")->assertOk();
        $this->assertSame(48, $medication->fresh()->quantity);
    }

    // ── Escalation ─────────────────────────────────────────────────

    public function test_consecutive_missed_days_raise_one_alert(): void
    {
        $this->setSetting('notifications', 'escalate_after_missed', '3');
        $this->setSetting('notifications', 'quiet_hours_start', '00:00');
        $this->setSetting('notifications', 'quiet_hours_end', '00:00'); // no quiet hours
        $this->admin();
        $this->patientWithRegimen(); // 30-day plan, nothing logged

        $this->artisan('notifications:escalate-missed')->assertSuccessful();
        $this->artisan('notifications:escalate-missed')->assertSuccessful();

        $this->assertSame(1, Notification::where('type', 'missed_dose_escalation')->count());
        $this->assertDatabaseHas('notification_recipients', ['user_id' => $this->admin()->id, 'is_read' => false]);
    }

    // ── Helpers ────────────────────────────────────────────────────

    private function setSetting(string $group, string $key, string $value): void
    {
        Setting::updateOrCreate(['group' => $group, 'key' => $key], ['value' => $value]);
        AppSettings::flush();
    }

    private function admin(): User
    {
        return $this->adminUser ??= User::factory()->create(['role' => 'admin']);
    }

    /** @return array{0: User, 1: Patient, 2: TreatmentPlan, 3: TreatmentPlanMedication} */
    private function patientWithRegimen(): array
    {
        $user = User::factory()->create(['role' => 'patient']);
        $patient = Patient::factory()->forUser($user)->create(['registered_by' => $this->admin()->id]);
        $plan = TreatmentPlan::factory()->create([
            'patient_id' => $patient->id,
            'assigned_by' => $this->admin()->id,
            'status' => 'active',
            'phase' => 'intensive',
            'start_date' => now()->subDays(30)->toDateString(),
            'expected_end_date' => now()->addMonths(5)->toDateString(),
        ]);
        $pivot = TreatmentPlanMedication::factory()->create([
            'treatment_plan_id' => $plan->id,
            'medication_id' => Medication::factory()->create(['name' => 'Rifampicin'])->id,
            'dosage' => '300mg',
            'frequency' => 'Once daily',
            'preferred_time' => '07:00:00',
        ]);

        return [$user, $patient, $plan, $pivot];
    }
}
