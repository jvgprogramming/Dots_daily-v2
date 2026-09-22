<?php

namespace Database\Seeders;

use App\Models\Medication;
use App\Models\MedicationLog;
use App\Models\Patient;
use App\Models\TreatmentPlan;
use App\Models\TreatmentPlanMedication;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * A ready-to-use patient account for the mobile → web dose-logging flow.
 *
 * AdminUserSeeder only creates admins plus five random factory patients, none of
 * which has a treatment plan — and a medication log needs both a patient and a
 * prescribed medicine, so signing in as any of them cannot log a dose. This
 * seeder supplies the missing half of the loop:
 *
 *   login + patient profile → active Category 1 regimen → ~45 days of history
 *
 * The history is deterministic (fixed mt_srand seed) so every fresh database
 * looks the same, and it deliberately stops yesterday: today is left open so the
 * dose you log from the app is the one you watch appear on the admin reports.
 */
class DemoPatientSeeder extends Seeder
{
    public const PATIENT_EMAIL = 'patient@dotsdaily.com';

    public const PATIENT_PASSWORD = 'password';

    /** Days of adherence history seeded before today. */
    private const HISTORY_DAYS = 45;

    /** The standard 2HRZE intensive-phase regimen, taken together before breakfast. */
    private const REGIMEN = [
        ['name' => 'Rifampicin', 'dosage' => '300mg'],
        ['name' => 'Isoniazid', 'dosage' => '300mg'],
        ['name' => 'Pyrazinamide', 'dosage' => '500mg'],
        ['name' => 'Ethambutol', 'dosage' => '400mg'],
    ];

    /** Shared intake time — mirrors the app's single daily reminder. */
    private const INTAKE_TIME = '07:00';

    public function run(): void
    {
        $admin = User::where('role', 'admin')->first();

        $user = User::firstOrCreate(
            ['email' => self::PATIENT_EMAIL],
            [
                'name' => 'Juan Dela Cruz',
                'phone' => '09181234567',
                'password' => Hash::make(self::PATIENT_PASSWORD),
                'role' => 'patient',
                'is_active' => true,
                'email_verified_at' => now(),
            ],
        );

        $patient = Patient::firstOrCreate(
            ['user_id' => $user->id],
            [
                'first_name' => 'Juan',
                'last_name' => 'Dela Cruz',
                'date_of_birth' => '1988-04-12',
                'gender' => 'male',
                'civil_status' => 'married',
                'address' => 'Purok 3, Barangay San Isidro, Cebu City',
                'nationality' => 'Filipino',
                'occupation' => 'Tricycle driver',
                'emergency_contact_name' => 'Maria Dela Cruz',
                'emergency_contact_phone' => '09187654321',
                'referred_by' => 'Cebu City Health Office',
                'status' => 'registered',
                'registered_by' => $admin?->id,
                'registered_at' => now(),
            ],
        );

        $plan = $this->ensureRegimen($patient, $admin?->id);

        if (! $plan) {
            $this->command->warn('Demo regimen skipped — no medicines in the catalog.');

            return;
        }

        $this->seedHistory($patient, $plan, $admin?->id);

        $this->command->info(
            'Demo patient ready: '.self::PATIENT_EMAIL.' / '.self::PATIENT_PASSWORD
            .' (active regimen + '.self::HISTORY_DAYS.' days of dose history).'
        );
    }

    /**
     * Gives the patient one active Category 1 plan containing the four
     * first-line drugs, all taken at the same time of day.
     */
    private function ensureRegimen(Patient $patient, ?int $assignedBy): ?TreatmentPlan
    {
        // Starts exactly when the seeded history starts, so the calendar has no
        // unexplained run of empty "missed" days before the first dose.
        $startDate = CarbonImmutable::today()->subDays(self::HISTORY_DAYS);

        // updateOrCreate, not firstOrCreate: re-running the seeder should correct
        // an existing demo plan rather than leave stale dates behind.
        $plan = TreatmentPlan::updateOrCreate(
            [
                'patient_id' => $patient->id,
                'plan_name' => 'Category 1 TB Regimen',
            ],
            [
                'assigned_by' => $assignedBy,
                'regimen_type' => '2HRZE/4HR',
                'phase' => 'intensive',
                'start_date' => $startDate->toDateString(),
                'expected_end_date' => $startDate->addMonths(6)->toDateString(),
                'status' => 'active',
                'notes' => 'Standard intensive-phase regimen: four drugs taken together daily.',
            ],
        );

        foreach (self::REGIMEN as $entry) {
            $medication = Medication::where('name', $entry['name'])->first();

            if (! $medication) {
                continue;
            }

            TreatmentPlanMedication::firstOrCreate(
                [
                    'treatment_plan_id' => $plan->id,
                    'medication_id' => $medication->id,
                ],
                [
                    'dosage' => $entry['dosage'],
                    'frequency' => 'Once daily',
                    'route' => 'oral',
                    'duration_weeks' => 8,
                    'preferred_time' => self::INTAKE_TIME.':00',
                    'notes' => 'Take on an empty stomach, one hour before breakfast.',
                ],
            );
        }

        return $plan->treatmentPlanMedications()->exists() ? $plan->fresh() : null;
    }

    /**
     * Backfills yesterday and the ~45 days before it, so the app's calendar and
     * the admin adherence chart both open with real rows instead of empty state.
     */
    private function seedHistory(Patient $patient, TreatmentPlan $plan, ?int $observerId): void
    {
        $primary = $plan->treatmentPlanMedications()->orderBy('id')->first();

        if (! $primary) {
            return;
        }

        // Fixed seed → identical demo data on every fresh database.
        mt_srand(20260922);

        $today = CarbonImmutable::today();
        $planStart = CarbonImmutable::parse($plan->start_date);

        for ($daysAgo = self::HISTORY_DAYS; $daysAgo >= 1; $daysAgo--) {
            $date = $today->subDays($daysAgo);

            if ($date->lt($planStart)) {
                continue;
            }

            $roll = mt_rand(1, 100);

            if ($roll <= 8) {
                // A missed day keeps the adherence rate believable.
                $status = 'missed';
                $takenAt = null;
                $notes = 'No dose recorded';
            } elseif ($roll <= 18) {
                $status = 'late';
                $takenAt = $date->setTime(9, mt_rand(0, 59));
                $notes = 'Taken later than scheduled';
            } else {
                $status = 'taken';
                $takenAt = $date->setTime(7, mt_rand(0, 25));
                $notes = null;
            }

            MedicationLog::updateOrCreate(
                [
                    'patient_id' => $patient->id,
                    'treatment_plan_medication_id' => $primary->id,
                    'scheduled_date' => $date->toDateString(),
                ],
                [
                    'scheduled_time' => self::INTAKE_TIME.':00',
                    'taken_at' => $takenAt,
                    'status' => $status,
                    'dose_quantity' => '4 tablets',
                    'notes' => $notes,
                    // ~85% of recorded doses carry a DOTS observer, which is what
                    // the app renders as a verified (green) day. The rest stay
                    // pending (amber), exactly like a self-reported dose.
                    'observed_by' => $status !== 'missed' && mt_rand(1, 100) <= 85
                        ? $observerId
                        : null,
                ],
            );
        }
    }
}
