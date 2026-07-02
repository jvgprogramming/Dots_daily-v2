<?php

namespace Database\Factories;

use App\Models\DailyMonitoring;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DailyMonitoring>
 */
class DailyMonitoringFactory extends Factory
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
            'weight_kg' => fake()->randomFloat(2, 40, 80),
            'temperature_c' => fake()->randomFloat(2, 36.0, 38.5),
            'blood_pressure_systolic' => fake()->randomElement([110, 115, 120, 125, 130, 135, 140]),
            'blood_pressure_diastolic' => fake()->randomElement([70, 75, 80, 85, 90]),
            'heart_rate_bpm' => fake()->numberBetween(60, 100),
            'respiratory_rate' => fake()->numberBetween(12, 20),
            'oxygen_saturation' => fake()->randomElement([95, 96, 97, 98, 99, 100]),
            'notes' => fake()->optional()->sentence(),
            'recorded_by' => User::factory()->admin(),
        ];
    }
}
