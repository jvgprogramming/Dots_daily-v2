<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Medication;
use App\Models\MedicationLog;
use App\Models\Patient;
use App\Models\TreatmentPlanMedication;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The official registration record (notification, lab tests, diagnosis,
 * classification, starting treatment, close contacts) can be corrected after
 * submission when something was logged wrongly. Corrections are made in
 * place, need a reason, and are written to the audit trail.
 */
class RegistrationCorrectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_can_correct_the_registration_record_in_place(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $patient = $this->registerPatient();
        $plan = $patient->treatmentPlans()->first();

        // A dose already logged against the plan must survive the correction.
        $pivot = TreatmentPlanMedication::factory()->create([
            'treatment_plan_id' => $plan->id,
            'medication_id' => Medication::factory()->create()->id,
        ]);
        $log = MedicationLog::factory()->create([
            'patient_id' => $patient->id,
            'treatment_plan_medication_id' => $pivot->id,
        ]);

        $payload = $this->recordPayload($patient);
        $payload['diagnosis']['diagnosis_date'] = '2026-02-10';
        $payload['classification']['anatomical_site'] = 'extrapulmonary';
        $payload['classification']['extrapulmonary_site'] = 'Lymph nodes';
        $payload['treatment']['start_date'] = '2026-02-15';
        $payload['reason'] = 'Diagnosis date and site were entered wrongly.';

        $this->putJson("/api/v1/patients/{$patient->id}/registration", $payload)
            ->assertOk()
            ->assertJsonPath('message', 'Registration record updated.');

        $patient->refresh();
        $this->assertSame('2026-02-10', $patient->diagnoses()->first()->diagnosis_date->toDateString());
        $this->assertSame('Lymph nodes', $patient->tbClassification()->first()->extrapulmonary_site);
        $this->assertSame(1, $patient->diagnoses()->count(), 'corrected in place, not duplicated');

        $plan->refresh();
        $this->assertSame(1, $patient->treatmentPlans()->count());
        $this->assertSame('2026-02-15', $plan->start_date->toDateString());
        $this->assertTrue($plan->expected_end_date->gt($plan->start_date), 'expected end moves with the start date');
        $this->assertTrue(MedicationLog::whereKey($log->id)->exists());
        $this->assertSame($plan->id, $log->fresh()->treatmentPlanMedication->treatment_plan_id);

        $audit = ActivityLog::where('action', 'patient.registration_corrected')->sole();
        $this->assertSame('Diagnosis date and site were entered wrongly.', $audit->properties['reason']);
        $this->assertArrayHasKey('diagnosis', $audit->properties['changes']);
        $this->assertArrayHasKey('treatment', $audit->properties['changes']);
    }

    public function test_lab_tests_and_close_contacts_are_synced_by_id(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $patient = $this->registerPatient();
        [$xpert, $smear] = $patient->laboratoryTests()->orderBy('id')->get()->all();
        $contact = $patient->closeContacts()->first();

        $payload = $this->recordPayload($patient);
        // Fix the Xpert result, drop the smear, add a chest X-ray.
        $payload['laboratory_tests'] = [
            ['id' => $xpert->id, 'test_type' => 'xpert', 'result' => 'MTB Detected, RIF not detected', 'status' => 'done'],
            ['test_type' => 'cxr', 'result' => 'Infiltrates', 'status' => 'done'],
        ];
        // Remove the only close contact.
        $payload['close_contacts'] = [];
        $payload['reason'] = 'Smear was recorded for the wrong patient.';

        $this->putJson("/api/v1/patients/{$patient->id}/registration", $payload)->assertOk();

        $tests = $patient->laboratoryTests()->orderBy('id')->get();
        $this->assertSame(['xpert', 'cxr'], $tests->pluck('test_type')->all());
        $this->assertSame($xpert->id, $tests[0]->id);
        $this->assertSame('MTB Detected, RIF not detected', $tests[0]->result);
        $this->assertFalse($tests->contains('id', $smear->id));
        $this->assertSame(0, $patient->closeContacts()->count());
        $this->assertNotNull($contact);

        $changes = ActivityLog::where('action', 'patient.registration_corrected')->sole()->properties['changes'];
        $this->assertSame(['added' => 1, 'updated' => 1, 'removed' => 1], $changes['laboratory_tests']);
        $this->assertSame(['removed' => 1], $changes['close_contacts']);
    }

    public function test_an_id_from_another_patient_cannot_be_edited_through_this_record(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $patient = $this->registerPatient();
        $other = $this->registerPatient('other@example.com');
        $othersTest = $other->laboratoryTests()->first();

        $payload = $this->recordPayload($patient);
        $payload['laboratory_tests'] = [['id' => $othersTest->id, 'test_type' => 'smear', 'result' => 'tampered', 'status' => 'done']];
        $payload['reason'] = 'Trying to reach another record.';

        $this->putJson("/api/v1/patients/{$patient->id}/registration", $payload)->assertOk();

        $this->assertNotSame('tampered', $othersTest->fresh()->result);
        $this->assertSame(['smear'], $patient->laboratoryTests()->pluck('test_type')->all());
    }

    public function test_a_correction_needs_a_reason(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $patient = $this->registerPatient();

        $this->putJson("/api/v1/patients/{$patient->id}/registration", $this->recordPayload($patient))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');
    }

    public function test_saving_without_changes_writes_no_audit_entry(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $patient = $this->registerPatient();

        $payload = $this->recordPayload($patient);
        $payload['reason'] = 'Checking the record.';

        $this->putJson("/api/v1/patients/{$patient->id}/registration", $payload)
            ->assertOk()
            ->assertJsonPath('message', 'No changes to save.');

        $this->assertFalse(ActivityLog::where('action', 'patient.registration_corrected')->exists());
    }

    public function test_a_draft_cannot_be_corrected(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $draftId = $this->postJson('/api/v1/patients', [
            'status' => 'draft',
            'last_name' => 'Draft',
            'first_name' => 'Only',
            'email' => 'draft@example.com',
            'password' => 'secret-pass',
        ])->assertCreated()->json('data.patient.id');

        // A draft has no records yet, so borrow a valid payload from a registered patient.
        $payload = $this->recordPayload($this->registerPatient());
        $payload['reason'] = 'Should not be allowed.';

        $this->putJson("/api/v1/patients/{$draftId}/registration", $payload)->assertStatus(422);
    }

    /** Register a patient through the API, exactly as the portal wizard does. */
    private function registerPatient(string $email = 'juan@example.com'): Patient
    {
        $id = $this->postJson('/api/v1/patients', [
            'status' => 'registered',
            'name' => 'Juan Dela Cruz',
            'email' => $email,
            'last_name' => 'Dela Cruz',
            'first_name' => 'Juan',
            'date_of_birth' => '1990-05-01',
            'gender' => 'male',
            'address' => 'Manila',
            'notification' => ['reason' => 'new', 'facility_name' => 'Clinic A'],
            'laboratory_tests' => [
                ['test_type' => 'xpert', 'result' => 'MTB Detected', 'status' => 'done'],
                ['test_type' => 'smear', 'result' => 'Positive', 'status' => 'done'],
            ],
            'diagnosis' => ['diagnosis_type' => 'tb_disease', 'diagnosis_date' => '2026-01-10'],
            'classification' => [
                'bacteriological_status' => 'bacteriologically_confirmed',
                'anatomical_site' => 'pulmonary',
                'drug_resistance_status' => 'drug_susceptible',
                'registration_group' => 'new',
            ],
            'treatment' => ['start_date' => '2026-01-15', 'regimen_type' => '2HRZE/4HR'],
            'close_contacts' => [['full_name' => 'Maria Dela Cruz', 'relationship' => 'Spouse']],
        ])->assertCreated()->json('data.patient.id');

        return Patient::findOrFail($id);
    }

    /** The patient's current record, in the shape the correction form sends. */
    private function recordPayload(Patient $patient): array
    {
        $plan = $patient->treatmentPlans()->oldest('id')->first();
        $date = fn ($d) => $d?->toDateString();

        return [
            'notification' => collect($patient->tbNotifications()->first())->only(['reason', 'facility_name', 'ntp_facility_code', 'province_huc', 'region'])->all(),
            'laboratory_tests' => $patient->laboratoryTests()->orderBy('id')->get()
                ->map(fn ($t) => ['id' => $t->id, 'test_type' => $t->test_type, 'test_name' => $t->test_name, 'test_date' => $date($t->test_date), 'result' => $t->result, 'status' => $t->status, 'remarks' => $t->remarks])->all(),
            'diagnosis' => [
                'diagnosis_type' => $patient->diagnoses()->first()->diagnosis_type,
                'diagnosis_date' => $date($patient->diagnoses()->first()->diagnosis_date),
            ],
            'classification' => collect($patient->tbClassification()->first())->only(['bacteriological_status', 'anatomical_site', 'extrapulmonary_site', 'drug_resistance_status', 'registration_group'])->all(),
            'treatment' => ['start_date' => $date($plan->start_date), 'regimen_type' => $plan->regimen_type, 'notes' => $plan->notes],
            'close_contacts' => $patient->closeContacts()->orderBy('id')->get()
                ->map(fn ($c) => ['id' => $c->id, 'full_name' => $c->full_name, 'relationship' => $c->relationship])->all(),
        ];
    }
}
