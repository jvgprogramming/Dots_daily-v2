<?php

namespace Tests\Feature;

use App\Models\Medication;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * A registered patient's plan gets its regimen's medicines, so the patient can
 * log doses (and VOT videos) from the app straight away.
 */
class RegimenPrescriptionTest extends TestCase
{
    use RefreshDatabase;

    private const TB_DRUGS = ['Rifampicin', 'Isoniazid', 'Pyrazinamide', 'Ethambutol', 'Rifapentine'];

    protected function setUp(): void
    {
        parent::setUp();
        foreach (self::TB_DRUGS as $name) {
            Medication::factory()->create(['name' => $name, 'strength' => '300mg']);
        }
    }

    public function test_registration_prescribes_the_intensive_phase_drugs(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $patient = $this->register('2HRZE/4HR');

        $plan = $patient->treatmentPlans()->sole();
        $meds = $plan->treatmentPlanMedications()->orderBy('id')->with('medication')->get();

        $this->assertSame(['Isoniazid', 'Rifampicin', 'Pyrazinamide', 'Ethambutol'], $meds->pluck('medication.name')->all());
        $this->assertSame('Once daily', $meds[0]->frequency);
        $this->assertSame(9, $meds[0]->duration_weeks, '60-day intensive phase');
        $this->assertSame('300mg', $meds[0]->dosage);
    }

    public function test_a_single_phase_regimen_uses_its_only_phase(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $plan = $this->register('3HP')->treatmentPlans()->sole();

        $this->assertSame('continuation', $plan->phase);
        $meds = $plan->treatmentPlanMedications()->with('medication')->get();
        $this->assertSame(['Isoniazid', 'Rifapentine'], $meds->pluck('medication.name')->all());
        $this->assertSame('Once weekly', $meds[0]->frequency);
    }

    public function test_an_individualized_regimen_is_left_for_staff_to_prescribe(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $plan = $this->register('individualized')->treatmentPlans()->sole();

        $this->assertSame(0, $plan->treatmentPlanMedications()->count());
    }

    public function test_backfill_fills_only_empty_active_plans(): void
    {
        // Plans (and their patients) through the API: the factories' admin()
        // state has a fixed email, so two of them collide.
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $empty = $this->register('2HRZE/4HR')->treatmentPlans()->sole();
        $empty->treatmentPlanMedications()->delete();
        $done = $this->register('2HRZE/4HR', 'other@example.com')->treatmentPlans()->sole();
        $done->treatmentPlanMedications()->delete();
        $done->treatmentPlanMedications()->create([
            'medication_id' => Medication::where('name', 'Rifampicin')->value('id'),
            'dosage' => '600mg', 'frequency' => 'Once daily', 'route' => 'oral', 'duration_weeks' => 8,
        ]);

        $this->artisan('treatment-plans:backfill-medications', ['--dry-run' => true])->assertSuccessful();
        $this->assertSame(0, $empty->treatmentPlanMedications()->count(), 'dry run changes nothing');

        $this->artisan('treatment-plans:backfill-medications')->assertSuccessful();

        $this->assertSame(4, $empty->treatmentPlanMedications()->count());
        $this->assertSame(['600mg'], $done->treatmentPlanMedications()->pluck('dosage')->all(), 'existing prescriptions untouched');
    }

    private function register(string $regimen, string $email = 'juan@example.com'): Patient
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
            'diagnosis' => ['diagnosis_type' => 'tb_disease', 'diagnosis_date' => '2026-01-10'],
            'classification' => [
                'bacteriological_status' => 'bacteriologically_confirmed',
                'anatomical_site' => 'pulmonary',
                'drug_resistance_status' => 'drug_susceptible',
                'registration_group' => 'new',
            ],
            'treatment' => ['start_date' => '2026-01-15', 'regimen_type' => $regimen],
        ])->assertCreated()->json('data.patient.id');

        return Patient::findOrFail($id);
    }
}
