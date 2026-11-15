<?php

namespace Tests\Feature;

use App\Models\Medication;
use App\Models\MedicationLog;
use App\Models\Patient;
use App\Models\TreatmentPlan;
use App\Models\TreatmentPlanMedication;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Nurses use the staff portal to track the patients they registered, and
 * nothing more: no other nurse's patients, no admin modules, and no way to
 * give themselves more access than an administrator grants.
 */
class NurseAccessTest extends TestCase
{
    use RefreshDatabase;

    // ── Signing in ──────────────────────────────────────────────────

    public function test_a_nurse_can_sign_in_to_the_portal_with_an_expiring_token(): void
    {
        $this->nurse(['email' => 'nurse@dotsdaily.com', 'password' => Hash::make('secret-pass')]);

        $this->postJson('/api/v1/login', [
            'email' => 'nurse@dotsdaily.com',
            'password' => 'secret-pass',
        ])->assertOk()->assertJsonPath('data.user.role', 'nurse');

        $this->assertDatabaseCount('personal_access_tokens', 1);
        $this->assertNotNull(\DB::table('personal_access_tokens')->value('expires_at'));
    }

    public function test_a_patient_account_cannot_sign_in_to_the_portal(): void
    {
        User::factory()->create([
            'email' => 'patient@example.com',
            'password' => Hash::make('secret-pass'),
            'role' => 'patient',
        ]);

        $this->postJson('/api/v1/login', [
            'email' => 'patient@example.com',
            'password' => 'secret-pass',
        ])->assertStatus(403);

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_a_deactivated_nurse_cannot_sign_in(): void
    {
        $this->nurse([
            'email' => 'off@dotsdaily.com',
            'password' => Hash::make('secret-pass'),
            'is_active' => false,
        ]);

        $this->postJson('/api/v1/login', [
            'email' => 'off@dotsdaily.com',
            'password' => 'secret-pass',
        ])->assertStatus(403);
    }

    public function test_repeated_failed_sign_ins_are_throttled(): void
    {
        $this->nurse(['email' => 'nurse@dotsdaily.com']);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/login', [
                'email' => 'nurse@dotsdaily.com',
                'password' => 'wrong-password',
            ])->assertStatus(422);
        }

        $this->postJson('/api/v1/login', [
            'email' => 'nurse@dotsdaily.com',
            'password' => 'wrong-password',
        ])->assertStatus(429);
    }

    // ── Seeing only their own patients ─────────────────────────────

    public function test_a_nurse_lists_only_the_patients_they_registered(): void
    {
        $nurse = $this->nurse();
        $mine = $this->patientRegisteredBy($nurse);
        $theirs = $this->patientRegisteredBy($this->nurse());
        $adminOwned = $this->patientRegisteredBy($this->admin());

        Sanctum::actingAs($nurse);

        $ids = collect($this->getJson('/api/v1/patients')->assertOk()->json('data'))->pluck('id');
        $this->assertEquals([$mine->id], $ids->all());

        $listIds = collect($this->getJson('/api/v1/patients/list')->assertOk()->json('data'))->pluck('id');
        $this->assertEquals([$mine->id], $listIds->all());

        $this->assertNotContains($theirs->id, $ids);
        $this->assertNotContains($adminOwned->id, $ids);
    }

    public function test_an_admin_still_sees_every_patient(): void
    {
        $this->patientRegisteredBy($this->nurse());
        $this->patientRegisteredBy($this->admin());

        Sanctum::actingAs($this->admin());

        $this->assertCount(2, $this->getJson('/api/v1/patients')->assertOk()->json('data'));
    }

    public function test_a_nurse_can_open_their_own_patient_and_monitoring_calendar(): void
    {
        $nurse = $this->nurse();
        $patient = $this->patientRegisteredBy($nurse);
        Sanctum::actingAs($nurse);

        $this->getJson("/api/v1/patients/{$patient->id}")->assertOk();
        $this->getJson('/api/v1/patients/monitoring?patient_id='.$patient->id)->assertOk();
    }

    public function test_another_patients_record_reads_as_not_found(): void
    {
        $other = $this->patientRegisteredBy($this->admin());
        Sanctum::actingAs($this->nurse());

        $this->getJson("/api/v1/patients/{$other->id}")->assertNotFound();
        $this->getJson('/api/v1/patients/monitoring?patient_id='.$other->id)->assertNotFound();
        $this->putJson("/api/v1/patients/{$other->id}", ['occupation' => 'Changed'])->assertNotFound();

        // An id that does not exist answers the same way, so nothing leaks.
        $this->getJson('/api/v1/patients/monitoring?patient_id=999999')->assertNotFound();

        $this->assertDatabaseMissing('patients', ['id' => $other->id, 'occupation' => 'Changed']);
    }

    public function test_a_patient_registered_by_a_nurse_belongs_to_that_nurse(): void
    {
        $nurse = $this->nurse();
        Sanctum::actingAs($nurse);

        $id = $this->postJson('/api/v1/patients', [
            'status' => 'draft',
            'last_name' => 'Dela Cruz',
            'first_name' => 'Juan',
            // An account is included because the in-memory SQLite test schema
            // keeps patients.user_id NOT NULL (the nullable migration is MySQL-only).
            'email' => 'juan@example.com',
            'password' => 'patient-pass-1',
        ])->assertCreated()->json('data.patient.id');

        $this->assertDatabaseHas('patients', ['id' => $id, 'registered_by' => $nurse->id]);
        $this->getJson("/api/v1/patients/{$id}")->assertOk();
    }

    // ── Editing ─────────────────────────────────────────────────────

    public function test_a_nurse_can_update_their_patients_details(): void
    {
        $nurse = $this->nurse();
        $patient = $this->patientRegisteredBy($nurse);
        Sanctum::actingAs($nurse);

        $this->putJson("/api/v1/patients/{$patient->id}", ['occupation' => 'Farmer'])->assertOk();

        $this->assertDatabaseHas('patients', ['id' => $patient->id, 'occupation' => 'Farmer']);
    }

    public function test_a_nurse_cannot_change_a_patients_sign_in_credentials(): void
    {
        $nurse = $this->nurse();
        $patient = $this->patientRegisteredBy($nurse);
        $originalHash = $patient->user->password;
        Sanctum::actingAs($nurse);

        $this->putJson("/api/v1/patients/{$patient->id}", ['password' => 'new-password-123'])
            ->assertForbidden();
        $this->putJson("/api/v1/patients/{$patient->id}", ['email' => 'takeover@example.com'])
            ->assertForbidden();

        $this->assertSame($originalHash, $patient->user->fresh()->password);
        $this->assertDatabaseMissing('users', ['email' => 'takeover@example.com']);
    }

    public function test_a_nurse_cannot_delete_a_patient(): void
    {
        $nurse = $this->nurse();
        $patient = $this->patientRegisteredBy($nurse);
        Sanctum::actingAs($nurse);

        $this->deleteJson("/api/v1/patients/{$patient->id}")->assertForbidden();

        $this->assertNotSoftDeleted('patients', ['id' => $patient->id]);
    }

    // ── Admin-only modules ──────────────────────────────────────────

    public function test_a_nurse_is_refused_every_admin_module(): void
    {
        Sanctum::actingAs($this->nurse());

        foreach ([
            ['GET', '/api/v1/dashboard/stats'],
            ['GET', '/api/v1/search?q=a'],
            ['GET', '/api/v1/settings'],
            ['PUT', '/api/v1/settings'],
            ['GET', '/api/v1/settings/users'],
            ['GET', '/api/v1/settings/audit'],
            ['GET', '/api/v1/reports/medication-adherence'],
            ['GET', '/api/v1/treatments'],
            ['GET', '/api/v1/medications-inventory'],
        ] as [$method, $uri]) {
            $this->json($method, $uri)->assertForbidden();
        }
    }

    public function test_a_nurse_cannot_create_or_promote_staff_accounts(): void
    {
        $nurse = $this->nurse();
        Sanctum::actingAs($nurse);

        $this->postJson('/api/v1/settings/users', [
            'name' => 'Sneaky Admin',
            'email' => 'sneaky@example.com',
            'password' => 'password-123',
            'role' => 'admin',
        ])->assertForbidden();

        $this->putJson("/api/v1/settings/users/{$nurse->id}", ['role' => 'admin'])->assertForbidden();

        $this->assertDatabaseMissing('users', ['email' => 'sneaky@example.com']);
        $this->assertSame('nurse', $nurse->fresh()->role);
    }

    // ── Dose verification ───────────────────────────────────────────

    public function test_a_nurse_can_verify_their_patients_dose_and_it_is_audited(): void
    {
        $nurse = $this->nurse();
        $log = $this->pendingLogFor($this->patientRegisteredBy($nurse));
        Sanctum::actingAs($nurse);

        $this->postJson("/api/v1/medication-logs/{$log->id}/verify")->assertOk();
        $this->assertDatabaseHas('medication_logs', ['id' => $log->id, 'observed_by' => $nurse->id]);
        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $nurse->id,
            'action' => 'dose.verified',
            'subject_id' => $log->id,
        ]);

        $this->postJson("/api/v1/medication-logs/{$log->id}/unverify")->assertOk();
        $this->assertDatabaseHas('activity_logs', ['user_id' => $nurse->id, 'action' => 'dose.unverified']);
    }

    public function test_a_nurse_cannot_verify_another_patients_dose(): void
    {
        $log = $this->pendingLogFor($this->patientRegisteredBy($this->admin()));
        Sanctum::actingAs($this->nurse());

        $this->postJson("/api/v1/medication-logs/{$log->id}/verify")->assertNotFound();

        $this->assertDatabaseHas('medication_logs', ['id' => $log->id, 'observed_by' => null]);
    }

    // ── Losing access ───────────────────────────────────────────────

    public function test_deactivating_a_nurse_ends_their_sessions(): void
    {
        $nurse = $this->nurse();
        $nurse->createToken('auth-token');
        Sanctum::actingAs($this->admin());

        $this->putJson("/api/v1/settings/users/{$nurse->id}", ['is_active' => false])->assertOk();

        $this->assertSame(0, $nurse->tokens()->count());
    }

    public function test_a_deactivated_account_is_refused_even_with_a_live_session(): void
    {
        $nurse = $this->nurse();
        $this->patientRegisteredBy($nurse);
        $nurse->forceFill(['is_active' => false])->save();

        Sanctum::actingAs($nurse->fresh());

        $this->getJson('/api/v1/patients')->assertForbidden();
    }

    // ─────────────────────────────────────────────────────────────────

    private ?User $adminUser = null;

    private function admin(): User
    {
        return $this->adminUser ??= User::factory()->create(['role' => 'admin']);
    }

    private function nurse(array $attributes = []): User
    {
        return User::factory()->create(array_merge(['role' => 'nurse'], $attributes));
    }

    private function patientRegisteredBy(User $staff): Patient
    {
        $user = User::factory()->create(['role' => 'patient']);

        return Patient::factory()->forUser($user)->create(['registered_by' => $staff->id]);
    }

    private function pendingLogFor(Patient $patient): MedicationLog
    {
        $plan = TreatmentPlan::factory()->create([
            'patient_id' => $patient->id,
            'assigned_by' => $patient->registered_by,
            'status' => 'active',
            'phase' => 'intensive',
            'start_date' => now()->subDays(10)->toDateString(),
            'expected_end_date' => now()->addMonths(5)->toDateString(),
        ]);

        $pivot = TreatmentPlanMedication::factory()->create([
            'treatment_plan_id' => $plan->id,
            'medication_id' => Medication::factory()->create()->id,
            'dosage' => '300mg',
            'frequency' => 'Once daily',
            'preferred_time' => '07:00:00',
        ]);

        return MedicationLog::factory()->create([
            'patient_id' => $patient->id,
            'treatment_plan_medication_id' => $pivot->id,
            'scheduled_date' => now()->subDay()->toDateString(),
            'scheduled_time' => '07:00:00',
            'status' => 'taken',
            'taken_at' => now()->subDay()->setTime(7, 5),
            'observed_by' => null,
        ]);
    }
}
