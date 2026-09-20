<?php

namespace Database\Factories;

use App\Models\MedicationLog;
use App\Models\Patient;
use App\Models\TreatmentPlanMedication;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MedicationLog>
 */
class MedicationLogFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $status = fake()->randomElement(['taken', 'taken', 'taken', 'missed', 'late']);

        return [
            'treatment_plan_medication_id' => TreatmentPlanMedication::factory(),
            'patient_id' => Patient::factory(),
            'scheduled_date' => fake()->dateTimeBetween('-1 month', 'now')->format('Y-m-d'),
            'scheduled_time' => fake()->randomElement(['08:00:00', '08:30:00', '09:00:00']),
            'taken_at' => $status === 'taken' ? fake()->dateTimeThisMonth() : null,
            'status' => $status,
            'dose_quantity' => fake()->randomElement(['1 capsule', '1 tablet', '2 tablets']),
            'proof_photo' => null,
            'daily_monitoring_id' => null,
            'notes' => $status === 'missed' ? fake()->optional()->sentence() : null,
            'observed_by' => $status === 'taken' ? User::factory()->admin() : null,
        ];
    }

    /**
     * Indicate a successfully taken dose.
     */
    public function taken(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'taken',
            'taken_at' => fake()->dateTimeThisMonth(),
        ]);
    }

    /**
     * Indicate a missed dose.
     */
    public function missed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'missed',
            'taken_at' => null,
            'notes' => fake()->sentence(),
        ]);
    }
}
