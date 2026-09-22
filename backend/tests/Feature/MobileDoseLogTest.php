<?php

namespace Tests\Feature;

use App\Models\Medication;
use App\Models\MedicationLog;
use App\Models\Patient;
use App\Models\TreatmentPlan;
use App\Models\TreatmentPlanMedication;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The mobile dose-logging loop: a patient confirms an intake and the very same
 * row is what the admin web app reads back for its adherence reports.
 */
class MobileDoseLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_patient_receives_their_active_regimen(): void
    {
        [$user, , , $pivot] = $this->patientWithRegimen();
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/mobile/regimen');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.can_log_doses', true)
            ->assertJsonPath('data.primary_treatment_plan_medication_id', $pivot->id)
            ->assertJsonPath('data.reminder_time', '07:00')
            ->assertJsonPath('data.medications.0.medication_id', $pivot->medication_id)
            ->assertJsonPath('data.treatment_plan.status', 'active');
    }

    public function test_logging_a_dose_writes_a_medication_log(): void
    {
        [$user, $patient, , $pivot] = $this->patientWithRegimen();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/mobile/dose-logs', [
            'scheduled_date' => now()->toDateString(),
            'scheduled_time' => '07:00',
            'taken_at' => now()->setTime(7, 10)->toIso8601String(),
            'dose_quantity' => '4 tablets',
            'notes' => 'Logged from alarm',
        ]);

        $response->assertOk()->assertJsonPath('data.status', 'taken');

        $this->assertDatabaseHas('medication_logs', [
            'patient_id' => $patient->id,
            'treatment_plan_medication_id' => $pivot->id,
            'status' => 'taken',
            'dose_quantity' => '4 tablets',
        ]);

        // Compared through the model's date cast, not as raw SQL, because the
        // stored representation of a DATE column differs by engine
        // ('Y-m-d' on MySQL, 'Y-m-d H:i:s' on SQLite).
        $this->assertSame(
            now()->toDateString(),
            MedicationLog::where('patient_id', $patient->id)->sole()->scheduled_date->toDateString(),
        );
    }

    public function test_a_dose_taken_long_after_the_scheduled_time_is_recorded_as_late(): void
    {
        [$user] = $this->patientWithRegimen();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/mobile/dose-logs', [
            'scheduled_date' => now()->toDateString(),
            'scheduled_time' => '07:00',
            'taken_at' => now()->setTime(11, 0)->toIso8601String(),
        ])->assertOk()->assertJsonPath('data.status', 'late');
    }

    public function test_logging_the_same_day_twice_updates_instead_of_duplicating(): void
    {
        [$user, $patient] = $this->patientWithRegimen();
        Sanctum::actingAs($user);

        $payload = [
            'scheduled_date' => now()->toDateString(),
            'scheduled_time' => '07:00',
            'taken_at' => now()->setTime(7, 5)->toIso8601String(),
        ];

        $this->postJson('/api/v1/mobile/dose-logs', $payload)->assertOk();
        $this->postJson('/api/v1/mobile/dose-logs', $payload)->assertOk();

        $this->assertSame(
            1,
            MedicationLog::where('patient_id', $patient->id)->count(),
            'A repeated confirmation must not create a second dose row.',
        );
    }

    public function test_the_logged_dose_reaches_the_admin_adherence_report(): void
    {
        [$user, $patient] = $this->patientWithRegimen();
        Sanctum::actingAs($user);

        // Dated a few days back, inside the report's default 30-day window.
        // Deliberately not today: the report filters with whereBetween on a DATE
        // column, and the datetime string the `date` cast writes sorts *after*
        // the plain upper-bound date it is compared against — on SQLite only,
        // where the column keeps the time part that MySQL truncates. The dose
        // path itself is covered for today by the tests above.
        $scheduledDate = now()->subDays(3);

        $this->postJson('/api/v1/mobile/dose-logs', [
            'scheduled_date' => $scheduledDate->toDateString(),
            'scheduled_time' => '07:00',
            'taken_at' => $scheduledDate->copy()->setTime(7, 5)->toIso8601String(),
        ])->assertOk();

        // Now look at the exact endpoint the web reports page calls.
        Sanctum::actingAs($this->admin());

        $this->getJson('/api/v1/reports/medication-adherence')
            ->assertOk()
            ->assertJsonPath('data.overview.total_doses', 1)
            ->assertJsonPath('data.overview.taken', 1)
            ->assertJsonPath('data.recent_logs.0.patient_id', $patient->id)
            ->assertJsonPath('data.recent_logs.0.status', 'taken');
    }

    public function test_the_logged_dose_is_readable_back_by_the_app(): void
    {
        [$user] = $this->patientWithRegimen();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/mobile/dose-logs', [
            'scheduled_date' => now()->toDateString(),
            'scheduled_time' => '07:00',
            'taken_at' => now()->setTime(7, 5)->toIso8601String(),
            'notes' => 'Logged from alarm',
        ])->assertOk();

        $this->getJson('/api/v1/mobile/dose-logs')
            ->assertOk()
            ->assertJsonPath('data.count', 1)
            ->assertJsonPath('data.logs.0.scheduled_date', now()->toDateString())
            ->assertJsonPath('data.logs.0.scheduled_time', '07:00')
            ->assertJsonPath('data.logs.0.notes', 'Logged from alarm')
            ->assertJsonPath('data.logs.0.verified', false);
    }

    public function test_a_dose_cannot_be_logged_against_another_patients_medicine(): void
    {
        [$user, $patient] = $this->patientWithRegimen();
        [, , , $foreignPivot] = $this->patientWithRegimen();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/mobile/dose-logs', [
            'scheduled_date' => now()->toDateString(),
            'scheduled_time' => '07:00',
            'treatment_plan_medication_id' => $foreignPivot->id,
        ])->assertStatus(409);

        $this->assertSame(0, MedicationLog::where('patient_id', $patient->id)->count());
    }

    public function test_a_patient_without_an_active_regimen_is_told_so(): void
    {
        $user = User::factory()->create(['role' => 'patient']);
        Patient::factory()->forUser($user)->create([
            'registered_by' => $this->admin()->id,
        ]);
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/mobile/regimen')
            ->assertOk()
            ->assertJsonPath('data.can_log_doses', false)
            ->assertJsonPath('data.treatment_plan', null);

        $this->postJson('/api/v1/mobile/dose-logs', [
            'scheduled_date' => now()->toDateString(),
            'scheduled_time' => '07:00',
        ])->assertStatus(409);
    }

    public function test_an_account_without_a_patient_profile_is_rejected(): void
    {
        Sanctum::actingAs($this->admin());

        $this->getJson('/api/v1/mobile/regimen')->assertStatus(403);
        $this->postJson('/api/v1/mobile/dose-logs', [
            'scheduled_date' => now()->toDateString(),
            'scheduled_time' => '07:00',
        ])->assertStatus(403);
    }

    public function test_dose_logging_requires_authentication(): void
    {
        $this->getJson('/api/v1/mobile/regimen')->assertStatus(401);
        $this->getJson('/api/v1/mobile/dose-logs')->assertStatus(401);
        $this->postJson('/api/v1/mobile/dose-logs', [])->assertStatus(401);
    }

    private ?User $admin = null;

    /**
     * The single admin for this test.
     *
     * The `admin()` factory state always uses admin@dotsdaily.com, so building
     * one per relation would collide on the unique email — every factory-created
     * patient and plan points back at this one instead.
     */
    private function admin(): User
    {
        return $this->admin ??= User::factory()->create([
            'name' => 'Admin',
            'email' => 'admin@dotsdaily.com',
            'role' => 'admin',
        ]);
    }

    /**
     * A patient on an active Category 1 regimen with one prescribed medicine.
     *
     * @return array{0: User, 1: Patient, 2: TreatmentPlan, 3: TreatmentPlanMedication}
     */
    private function patientWithRegimen(): array
    {
        $user = User::factory()->create(['role' => 'patient']);
        $patient = Patient::factory()->forUser($user)->create([
            'registered_by' => $this->admin()->id,
        ]);

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
