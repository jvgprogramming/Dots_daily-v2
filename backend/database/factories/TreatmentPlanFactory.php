<?php

namespace Database\Factories;

use App\Models\Patient;
use App\Models\TreatmentPlan;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TreatmentPlan>
 */
class TreatmentPlanFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $startDate = fake()->dateTimeBetween('-6 months', 'now')->format('Y-m-d');

        return [
            'patient_id' => Patient::factory(),
            'assigned_by' => User::factory()->admin(),
            'plan_name' => fake()->randomElement([
                'Category 1 TB Regimen',
                'Category 2 TB Regimen',
                'MDR-TB Treatment Regimen',
            ]),
            'phase' => fake()->randomElement(['intensive', 'continuation']),
            'start_date' => $startDate,
            'expected_end_date' => fake()->dateTimeBetween($startDate, '+8 months')->format('Y-m-d'),
            'actual_end_date' => null,
            'status' => fake()->randomElement(['active', 'active', 'active', 'completed']),
            'discontinuation_reason' => null,
            'notes' => fake()->optional()->sentence(),
        ];
    }

    /**
     * Indicate an intensive phase treatment.
     */
    public function intensive(): static
    {
        $startDate = fake()->dateTimeBetween('-2 months', 'now')->format('Y-m-d');

        return $this->state(fn (array $attributes) => [
            'phase' => 'intensive',
            'start_date' => $startDate,
            'expected_end_date' => fake()->dateTimeBetween($startDate, '+2 months')->format('Y-m-d'),
            'status' => 'active',
        ]);
    }

    /**
     * Indicate a continuation phase treatment.
     */
    public function continuation(): static
    {
        $startDate = fake()->dateTimeBetween('-6 months', '-2 months')->format('Y-m-d');

        return $this->state(fn (array $attributes) => [
            'phase' => 'continuation',
            'start_date' => $startDate,
            'expected_end_date' => fake()->dateTimeBetween($startDate, '+6 months')->format('Y-m-d'),
            'status' => 'active',
        ]);
    }

    /**
     * Indicate a completed treatment.
     */
    public function completed(): static
    {
        $startDate = fake()->dateTimeBetween('-12 months', '-6 months')->format('Y-m-d');

        return $this->state(fn (array $attributes) => [
            'phase' => 'completed',
            'start_date' => $startDate,
            'expected_end_date' => fake()->dateTimeBetween($startDate, '+6 months')->format('Y-m-d'),
            'actual_end_date' => fake()->dateTimeBetween($startDate, '+8 months')->format('Y-m-d'),
            'status' => 'completed',
        ]);
    }
}
