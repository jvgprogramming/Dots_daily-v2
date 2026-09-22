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
 * Adherence means one thing on every surface: the share of the days a patient
 * was *expected* to take a dose that they actually took one.
 *
 * The regression these lock down is a patient who stops logging. Dividing by
 * recorded rows let them score 100% by going quiet — the admin dashboard, the
 * reports and the mobile app all inherited that bug. A day with no log at all
 * now counts against the patient, exactly like a day recorded as `missed`.
 */
class AdherenceConsistencyTest extends TestCase
{
    use RefreshDatabase;

    private const PLAN_DAYS = 10;

    public function test_days_never_logged_count_against_adherence(): void
    {
        // Ten expected days, only the first five ever logged.
        [$patient] = $this->patientWithHistory(takenDays: 5);
        Sanctum::actingAs($this->admin());

        $summary = $this->getJson($this->monitoringUrl($patient))->assertOk()->json('data.summary');

        // assertEquals, not assertSame: PHP's JSON encoder drops the fraction on a
        // whole number (50.0 serialises as 50), which is fine for display.
        $this->assertEquals(self::PLAN_DAYS, $summary['scheduled_days']);
        $this->assertEquals(5, $summary['days_taken']);
        $this->assertEquals(5, $summary['not_recorded_days']);
        $this->assertEquals(50.0, $summary['adherence_rate']);
    }

    public function test_a_patient_who_never_logs_reads_zero_not_one_hundred(): void
    {
        [$patient] = $this->patientWithHistory(takenDays: 0);
        Sanctum::actingAs($this->admin());

        $this->assertEquals(
            0.0,
            $this->getJson($this->monitoringUrl($patient))->assertOk()->json('data.summary.adherence_rate'),
        );
    }

    public function test_the_monitoring_calendar_and_the_reports_agree(): void
    {
        [$patient] = $this->patientWithHistory(takenDays: 6);
        Sanctum::actingAs($this->admin());

        $monitoring = $this->getJson($this->monitoringUrl($patient))->json('data.summary');
        $reports = $this->getJson($this->reportsUrl($patient))->json('data.overview');

        $this->assertEquals(60.0, $monitoring['adherence_rate']);
        $this->assertEquals(
            $monitoring['adherence_rate'],
            $reports['adherence_rate'],
            'the monitoring calendar and the reports must not disagree about the same patient',
        );
        $this->assertEquals($monitoring['scheduled_days'], $reports['scheduled_days']);
        $this->assertEquals($monitoring['days_taken'], $reports['days_taken']);
    }

    public function test_a_day_recorded_as_missed_counts_against_adherence(): void
    {
        // Five taken, five explicitly missed → still 50%, whether the remaining
        // days are silent or marked missed.
        [$patient] = $this->patientWithHistory(takenDays: 5, missedDays: 5);
        Sanctum::actingAs($this->admin());

        $summary = $this->getJson($this->monitoringUrl($patient))->assertOk()->json('data.summary');

        $this->assertEquals(50.0, $summary['adherence_rate']);
        $this->assertEquals(5, $summary['days_taken']);
    }

    /**
     * A patient on an active plan that began {@see PLAN_DAYS} days ago.
     *
     * @return array{0: Patient, 1: TreatmentPlanMedication}
     */
    private function patientWithHistory(int $takenDays, int $missedDays = 0): array
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
            'start_date' => now()->subDays(self::PLAN_DAYS - 1)->toDateString(),
            'expected_end_date' => now()->addMonths(5)->toDateString(),
        ]);

        $pivot = TreatmentPlanMedication::factory()->create([
            'treatment_plan_id' => $plan->id,
            'medication_id' => Medication::factory()->create(['name' => 'Rifampicin'])->id,
            'dosage' => '300mg',
            'frequency' => 'Once daily',
            'preferred_time' => '07:00:00',
        ]);

        // Day 0 is the plan start, so day N is start + N.
        for ($i = 0; $i < $takenDays + $missedDays; $i++) {
            MedicationLog::factory()->create([
                'patient_id' => $patient->id,
                'treatment_plan_medication_id' => $pivot->id,
                'scheduled_date' => now()->subDays(self::PLAN_DAYS - 1)->addDays($i)->toDateString(),
                'scheduled_time' => '07:00:00',
                'status' => $i < $takenDays ? 'taken' : 'missed',
                'taken_at' => $i < $takenDays ? now()->subDays(self::PLAN_DAYS - 1)->addDays($i) : null,
                'observed_by' => null,
            ]);
        }

        return [$patient, $pivot];
    }

    private function monitoringUrl(Patient $patient): string
    {
        return '/api/v1/patients/monitoring?'.http_build_query([
            'patient_id' => $patient->id,
            'from' => now()->subDays(self::PLAN_DAYS - 1)->toDateString(),
            'to' => now()->toDateString(),
        ]);
    }

    private function reportsUrl(Patient $patient): string
    {
        return '/api/v1/reports/medication-adherence?'.http_build_query([
            'patient_id' => $patient->id,
            'from' => now()->subDays(self::PLAN_DAYS - 1)->toDateString(),
            'to' => now()->toDateString(),
        ]);
    }

    private ?User $admin = null;

    private function admin(): User
    {
        return $this->admin ??= User::factory()->create([
            'name' => 'Admin',
            'email' => 'admin@dotsdaily.com',
            'role' => 'admin',
        ]);
    }
}
