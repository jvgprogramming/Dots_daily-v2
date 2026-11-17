<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\Patient;
use App\Models\SymptomLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The mobile Symptom Monitor: a patient self-reports TB symptoms and medication
 * side effects, the rows land where the admin patient profile reads them, and a
 * dangerous ("red-flag") report also alerts clinic staff.
 */
class MobileSymptomTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_patient_reports_symptoms(): void
    {
        [$user, $patient] = $this->patient();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/mobile/symptoms', [
            'notes' => 'Felt tired through the day',
            'symptoms' => [
                ['type' => 'cough', 'severity' => 'mild'],
                ['type' => 'fatigue', 'severity' => 'moderate'],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.red_flag', false)
            ->assertJsonCount(2, 'data.symptoms');

        // One row per reported symptom, attributed to the patient.
        $this->assertDatabaseCount('symptom_logs', 2);
        $this->assertDatabaseHas('symptom_logs', [
            'patient_id' => $patient->id,
            'symptom_type' => 'cough',
            'severity' => 'mild',
            'recorded_by' => 'patient',
            'notes' => 'Felt tired through the day',
        ]);
        // A routine report does not alert staff.
        $this->assertDatabaseMissing('notifications', ['type' => 'symptom_alert']);
    }

    public function test_a_dangerous_symptom_alerts_clinic_staff(): void
    {
        [$user, $patient, $admin] = $this->patient();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/mobile/symptoms', [
            // Jaundice is a danger symptom even when rated mild.
            'symptoms' => [['type' => 'jaundice', 'severity' => 'mild']],
        ])->assertCreated()->assertJsonPath('data.red_flag', true);

        $notification = Notification::where('type', 'symptom_alert')->firstOrFail();
        $this->assertDatabaseHas('notification_recipients', [
            'notification_id' => $notification->id,
            'user_id' => $admin->id,
        ]);
    }

    public function test_a_severe_rating_is_a_red_flag(): void
    {
        [$user] = $this->patient();
        Sanctum::actingAs($user);

        // Cough is ordinarily routine, but "severe" makes any report a red flag.
        $this->postJson('/api/v1/mobile/symptoms', [
            'symptoms' => [['type' => 'cough', 'severity' => 'severe']],
        ])->assertCreated()->assertJsonPath('data.red_flag', true);

        $this->assertDatabaseHas('notifications', ['type' => 'symptom_alert']);
    }

    public function test_it_rejects_an_unknown_symptom_or_severity(): void
    {
        [$user] = $this->patient();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/mobile/symptoms', [
            'symptoms' => [['type' => 'not_a_symptom', 'severity' => 'mild']],
        ])->assertStatus(422)->assertJsonValidationErrors('symptoms.0.type');

        $this->postJson('/api/v1/mobile/symptoms', [
            'symptoms' => [['type' => 'cough', 'severity' => 'extreme']],
        ])->assertStatus(422)->assertJsonValidationErrors('symptoms.0.severity');
    }

    public function test_index_returns_the_patients_own_reports(): void
    {
        [$user, $patient] = $this->patient();
        SymptomLog::create([
            'patient_id' => $patient->id,
            'recorded_date' => now()->toDateString(),
            'symptom_type' => 'fever',
            'severity' => 'moderate',
            'recorded_by' => 'patient',
        ]);
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/mobile/symptoms')
            ->assertOk()
            ->assertJsonPath('data.count', 1)
            ->assertJsonPath('data.symptoms.0.symptom_type', 'fever')
            ->assertJsonPath('data.symptoms.0.label', 'Fever')
            ->assertJsonPath('data.symptoms.0.red_flag', false);
    }

    /** @return array{0: User, 1: Patient, 2: User} patient user, patient, an active admin */
    private function patient(): array
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $user = User::factory()->create(['role' => 'patient']);
        $patient = Patient::factory()->forUser($user)->create([
            'registered_by' => $admin->id,
        ]);

        return [$user, $patient, $admin];
    }
}
