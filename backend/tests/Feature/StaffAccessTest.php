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
 * Staff run the clinical workflow in the portal — every patient, treatments,
 * monitoring, inventory, and reports — but never System settings or user
 * management. Patients only use the mobile app.
 */
class StaffAccessTest extends TestCase
{
    use RefreshDatabase;

    // ── Signing in ──────────────────────────────────────────────────

    public function test_a_staff_member_can_sign_in_to_the_portal_with_an_expiring_token(): void
    {
        $this->staff(['email' => 'staff@dotsdaily.com', 'password' => Hash::make('secret-pass')]);

        $this->postJson('/api/v1/login', [
            'email' => 'staff@dotsdaily.com',
            'password' => 'secret-pass',
        ])->assertOk()->assertJsonPath('data.user.role', 'staff');

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

    public function test_a_staff_member_cannot_sign_in_to_the_mobile_app(): void
    {
        $this->staff([
            'email' => 'staff@dotsdaily.com',
            'password' => Hash::make('secret-pass'),
        ]);

        $this->postJson('/api/v1/mobile/login', [
            'email' => 'staff@dotsdaily.com',
            'password' => 'secret-pass',
        ])->assertStatus(403);

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_a_deactivated_staff_member_cannot_sign_in(): void
    {
        $this->staff([
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
        $this->staff(['email' => 'staff@dotsdaily.com']);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/login', [
                'email' => 'staff@dotsdaily.com',
                'password' => 'wrong-password',
            ])->assertStatus(422);
        }

        $this->postJson('/api/v1/login', [
            'email' => 'staff@dotsdaily.com',
            'password' => 'wrong-password',
        ])->assertStatus(429);
    }

    // ── Every patient is visible ────────────────────────────────────

    public function test_staff_see_every_patient_regardless_of_who_registered_them(): void
    {
        $staff = $this->staff();
        $mine = $this->patientRegisteredBy($staff);
        $theirs = $this->patientRegisteredBy($this->staff());
        $adminOwned = $this->patientRegisteredBy($this->admin());

        Sanctum::actingAs($staff);

        $ids = collect($this->getJson('/api/v1/patients')->assertOk()->json('data'))->pluck('id');
        $this->assertEqualsCanonicalizing([$mine->id, $theirs->id, $adminOwned->id], $ids->all());

        $listIds = collect($this->getJson('/api/v1/patients/list')->assertOk()->json('data'))->pluck('id');
        $this->assertEqualsCanonicalizing([$mine->id, $theirs->id, $adminOwned->id], $listIds->all());
    }

    public function test_an_admin_still_sees_every_patient(): void
    {
        $this->patientRegisteredBy($this->staff());
        $this->patientRegisteredBy($this->admin());

        Sanctum::actingAs($this->admin());

        $this->assertCount(2, $this->getJson('/api/v1/patients')->assertOk()->json('data'));
    }

    public function test_a_staff_member_can_open_any_patient_and_monitoring_calendar(): void
    {
        $patient = $this->patientRegisteredBy($this->admin());
        Sanctum::actingAs($this->staff());

        $this->getJson("/api/v1/patients/{$patient->id}")->assertOk();
        $this->getJson('/api/v1/patients/monitoring?patient_id='.$patient->id)->assertOk();
    }

    // ── Editing ─────────────────────────────────────────────────────

    public function test_a_staff_member_can_register_and_update_patients(): void
    {
        $staff = $this->staff();
        Sanctum::actingAs($staff);

        $id = $this->postJson('/api/v1/patients', [
            'status' => 'draft',
            'last_name' => 'Dela Cruz',
            'first_name' => 'Juan',
            // An account is included because the in-memory SQLite test schema
            // keeps patients.user_id NOT NULL (the nullable migration is MySQL-only).
            'email' => 'juan@example.com',
            'password' => 'patient-pass-1',
        ])->assertCreated()->json('data.patient.id');

        $this->assertDatabaseHas('patients', ['id' => $id, 'registered_by' => $staff->id]);

        $this->putJson("/api/v1/patients/{$id}", ['occupation' => 'Farmer'])->assertOk();
        $this->assertDatabaseHas('patients', ['id' => $id, 'occupation' => 'Farmer']);
    }

    public function test_a_staff_member_cannot_change_a_patients_sign_in_credentials(): void
    {
        $patient = $this->patientRegisteredBy($this->staff());
        $originalHash = $patient->user->password;
        Sanctum::actingAs($this->staff());

        $this->putJson("/api/v1/patients/{$patient->id}", ['password' => 'new-password-123'])
            ->assertForbidden();
        $this->putJson("/api/v1/patients/{$patient->id}", ['email' => 'takeover@example.com'])
            ->assertForbidden();

        $this->assertSame($originalHash, $patient->user->fresh()->password);
        $this->assertDatabaseMissing('users', ['email' => 'takeover@example.com']);
    }

    public function test_a_staff_member_cannot_delete_a_patient(): void
    {
        $patient = $this->patientRegisteredBy($this->staff());
        Sanctum::actingAs($this->staff());

        $this->deleteJson("/api/v1/patients/{$patient->id}")->assertForbidden();

        $this->assertNotSoftDeleted('patients', ['id' => $patient->id]);
    }

    // ── Module access ───────────────────────────────────────────────

    public function test_staff_can_open_the_clinical_modules(): void
    {
        Sanctum::actingAs($this->staff());

        foreach ([
            ['GET', '/api/v1/reports/medication-adherence'],
            ['GET', '/api/v1/treatments'],
            ['GET', '/api/v1/medications-inventory'],
            ['GET', '/api/v1/medications-inventory/summary'],
        ] as [$method, $uri]) {
            $this->json($method, $uri)->assertOk();
        }
    }

    public function test_staff_are_refused_the_admin_only_modules(): void
    {
        Sanctum::actingAs($this->staff());

        foreach ([
            ['GET', '/api/v1/dashboard/stats'],
            ['GET', '/api/v1/search?q=a'],
            ['GET', '/api/v1/settings'],
            ['PUT', '/api/v1/settings'],
            ['GET', '/api/v1/settings/users'],
            ['GET', '/api/v1/settings/audit'],
        ] as [$method, $uri]) {
            $this->json($method, $uri)->assertForbidden();
        }
    }

    public function test_a_staff_member_cannot_create_or_promote_staff_accounts(): void
    {
        $staff = $this->staff();
        Sanctum::actingAs($staff);

        $this->postJson('/api/v1/settings/users', [
            'name' => 'Sneaky Admin',
            'email' => 'sneaky@example.com',
            'password' => 'password-123',
            'role' => 'admin',
        ])->assertForbidden();

        $this->putJson("/api/v1/settings/users/{$staff->id}", ['role' => 'admin'])->assertForbidden();

        $this->assertDatabaseMissing('users', ['email' => 'sneaky@example.com']);
        $this->assertSame('staff', $staff->fresh()->role);
    }

    // ── Dose verification ───────────────────────────────────────────

    public function test_a_staff_member_can_verify_a_dose_and_it_is_audited(): void
    {
        $staff = $this->staff();
        $log = $this->pendingLogFor($this->patientRegisteredBy($this->admin()));
        Sanctum::actingAs($staff);

        $this->postJson("/api/v1/medication-logs/{$log->id}/verify")->assertOk();
        $this->assertDatabaseHas('medication_logs', ['id' => $log->id, 'observed_by' => $staff->id]);
        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $staff->id,
            'action' => 'dose.verified',
            'subject_id' => $log->id,
        ]);

        $this->postJson("/api/v1/medication-logs/{$log->id}/unverify")->assertOk();
        $this->assertDatabaseHas('activity_logs', ['user_id' => $staff->id, 'action' => 'dose.unverified']);
    }

    // ── Losing access ───────────────────────────────────────────────

    public function test_deactivating_a_staff_member_ends_their_sessions(): void
    {
        $staff = $this->staff();
        $staff->createToken('auth-token');
        Sanctum::actingAs($this->admin());

        $this->putJson("/api/v1/settings/users/{$staff->id}", ['is_active' => false])->assertOk();

        $this->assertSame(0, $staff->tokens()->count());
    }

    public function test_a_deactivated_account_is_refused_even_with_a_live_session(): void
    {
        $staff = $this->staff();
        $this->patientRegisteredBy($staff);
        $staff->forceFill(['is_active' => false])->save();

        Sanctum::actingAs($staff->fresh());

        $this->getJson('/api/v1/patients')->assertForbidden();
    }

    // ─────────────────────────────────────────────────────────────────

    private ?User $adminUser = null;

    private function admin(): User
    {
        return $this->adminUser ??= User::factory()->create(['role' => 'admin']);
    }

    private function staff(array $attributes = []): User
    {
        return User::factory()->create(array_merge(['role' => 'staff'], $attributes));
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
