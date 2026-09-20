<?php

namespace Database\Factories;

use App\Models\Patient;
use App\Models\SymptomLog;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SymptomLog>
 */
class SymptomLogFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'patient_id' => Patient::factory(),
            'recorded_date' => fake()->dateTimeBetween('-1 month', 'now')->format('Y-m-d'),
            'symptom_type' => fake()->randomElement([
                'cough',
                'fever',
                'chest_pain',
                'fatigue',
                'night_sweats',
                'weight_loss',
                'loss_of_appetite',
                'shortness_of_breath',
            ]),
            'severity' => fake()->randomElement(['none', 'mild', 'moderate', 'severe']),
            'duration_hours' => fake()->optional()->numberBetween(1, 48),
            'notes' => fake()->optional()->sentence(),
            'recorded_by' => fake()->randomElement(['patient', 'patient', 'healthcare_worker']),
            'daily_monitoring_id' => null,
        ];
    }

    /**
     * Indicate a severe symptom.
     */
    public function severe(): static
    {
        return $this->state(fn (array $attributes) => [
            'severity' => 'severe',
        ]);
    }

    /**
     * Indicate symptoms recorded by a healthcare worker.
     */
    public function recordedByWorker(): static
    {
        return $this->state(fn (array $attributes) => [
            'recorded_by' => 'healthcare_worker',
        ]);
    }
}
