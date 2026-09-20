<?php

namespace Database\Factories;

use App\Models\AiRecommendation;
use App\Models\DailyMonitoring;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AiRecommendation>
 */
class AiRecommendationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $type = fake()->randomElement(['medication', 'appointment', 'referral', 'alert']);

        return [
            'patient_id' => Patient::factory(),
            'daily_monitoring_id' => DailyMonitoring::factory(),
            'type' => $type,
            'title' => fake()->randomElement([
                'Schedule follow-up appointment',
                'Monitor weight closely',
                'Consider medication adjustment',
                'Refer to specialist',
            ]),
            'description' => fake()->sentence(10),
            'severity' => fake()->randomElement(['info', 'warning', 'critical']),
            'status' => 'pending',
            'reviewed_by' => null,
            'reviewed_at' => null,
            'source' => fake()->randomElement(['DOTS-AI v1.0', 'Clinical Rules Engine']),
            'metadata' => null,
        ];
    }

    /**
     * Indicate a critical recommendation.
     */
    public function critical(): static
    {
        return $this->state(fn (array $attributes) => [
            'severity' => 'critical',
        ]);
    }

    /**
     * Indicate an accepted recommendation.
     */
    public function accepted(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'accepted',
            'reviewed_by' => User::factory()->admin(),
            'reviewed_at' => fake()->dateTimeThisMonth(),
        ]);
    }
}
