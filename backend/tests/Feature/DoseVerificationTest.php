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
 * The admin half of the verification loop: a patient's self-logged dose stays
 * pending until a DOTS observer confirms it. Verifying writes `observed_by`,
 * the same column the calendars already read for their green/pending split —
 * so a verification made here turns the day green everywhere at once.
 *
 * Proof photos stay optional: the patient is never asked for evidence as a
 * condition of having a dose verified.
 */
class DoseVerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_admin_can_verify_a_pending_dose(): void
    {
        [$patient, $log] = $this->pendingLog();
        Sanctum::actingAs($this->admin());

        $response = $this->postJson("/api/v1/medication-logs/{$log->id}/verify", [
            'notes' => 'Confirmed with the patient by phone.',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.verified', true)
            ->assertJsonPath('data.observed_by_name', 'Admin');

        $this->assertDatabaseHas('medication_logs', [
            'id' => $log->id,
            'observed_by' => $this->admin()->id,
        ]);

        // The verification must be visible through the reports feed the admin
        // was looking at — otherwise the button appears to do nothing.
        $reports = $this->getJson('/api/v1/reports/medication-adherence?'.http_build_query([
            'patient_id' => $patient->id,
        ]))->assertOk();

        $this->assertTrue(
            collect($reports->json('data.recent_logs'))
                ->firstWhere('id', $log->id)['verified'],
        );
    }

    public function test_verifying_again_updates_the_observer_without_failing(): void
    {
        [, $log] = $this->pendingLog();
        Sanctum::actingAs($this->admin());

        $this->postJson("/api/v1/medication-logs/{$log->id}/verify")->assertOk();

        $second = User::factory()->create(['name' => 'Second Observer', 'role' => 'admin']);
        Sanctum::actingAs($second);

        $this->postJson("/api/v1/medication-logs/{$log->id}/verify")
            ->assertOk()
            ->assertJsonPath('data.observed_by_name', 'Second Observer');
    }

    public function test_an_admin_can_remove_a_verification(): void
    {
        [$patient, $log] = $this->pendingLog();
        $log->forceFill(['observed_by' => $this->admin()->id])->save();
        Sanctum::actingAs($this->admin());

        $this->postJson("/api/v1/medication-logs/{$log->id}/unverify")
            ->assertOk()
            ->assertJsonPath('data.verified', false)
            ->assertJsonPath('data.observed_by_name', null);

        $this->assertDatabaseHas('medication_logs', [
            'id' => $log->id,
            'observed_by' => null,
        ]);

        // Removing the verification drops the day's verified count on the
        // monitoring calendar too.
        $monitoring = $this->getJson('/api/v1/patients/monitoring?'.http_build_query([
            'patient_id' => $patient->id,
            'from' => $log->scheduled_date->toDateString(),
            'to' => $log->scheduled_date->toDateString(),
        ]))->assertOk()->json('data');

        $this->assertSame(0, $monitoring['summary']['verified']);
        $this->assertSame(1, $monitoring['summary']['pending']);
    }

    public function test_unverifying_an_unverified_dose_is_rejected(): void
    {
        [, $log] = $this->pendingLog();
        Sanctum::actingAs($this->admin());

        $this->postJson("/api/v1/medication-logs/{$log->id}/unverify")->assertStatus(422);
    }

    public function test_a_missed_dose_cannot_be_verified(): void
    {
        [, $log] = $this->pendingLog(['status' => 'missed']);
        Sanctum::actingAs($this->admin());

        $this->postJson("/api/v1/medication-logs/{$log->id}/verify")->assertStatus(422);

        $this->assertDatabaseHas('medication_logs', [
            'id' => $log->id,
            'observed_by' => null,
        ]);
    }

    public function test_a_patient_cannot_verify_doses(): void
    {
        [, $log] = $this->pendingLog();
        Sanctum::actingAs($this->patientUser($log->patient));

        $this->postJson("/api/v1/medication-logs/{$log->id}/verify")->assertStatus(403);
        $this->postJson("/api/v1/medication-logs/{$log->id}/unverify")->assertStatus(403);
    }

    public function test_verification_requires_authentication(): void
    {
        [, $log] = $this->pendingLog();

        $this->postJson("/api/v1/medication-logs/{$log->id}/verify")->assertStatus(401);
        $this->postJson("/api/v1/medication-logs/{$log->id}/unverify")->assertStatus(401);
    }

    // ─────────────────────────────────────────────────────────────────

    private ?User $adminUser = null;

    private function admin(): User
    {
        return $this->adminUser ??= User::factory()->create([
            'name' => 'Admin',
            'email' => 'admin@dotsdaily.com',
            'role' => 'admin',
        ]);
    }

    private function patientUser(Patient $patient): User
    {
        return $patient->user ?? User::factory()->create(['role' => 'patient']);
    }

    /**
     * A pending (self-logged, never observed) dose for a patient on an active plan.
     *
     * @return array{0: Patient, 1: MedicationLog}
     */
    private function pendingLog(array $overrides = []): array
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
            'start_date' => now()->subDays(10)->toDateString(),
            'expected_end_date' => now()->addMonths(5)->toDateString(),
        ]);

        $pivot = TreatmentPlanMedication::factory()->create([
            'treatment_plan_id' => $plan->id,
            'medication_id' => Medication::factory()->create(['name' => 'Rifampicin'])->id,
            'dosage' => '300mg',
            'frequency' => 'Once daily',
            'preferred_time' => '07:00:00',
        ]);

        $log = MedicationLog::factory()->create(array_merge([
            'patient_id' => $patient->id,
            'treatment_plan_medication_id' => $pivot->id,
            'scheduled_date' => now()->subDay()->toDateString(),
            'scheduled_time' => '07:00:00',
            'status' => 'taken',
            'taken_at' => now()->subDay()->setTime(7, 5),
            'observed_by' => null,
        ], $overrides));

        return [$patient, $log];
    }
}
