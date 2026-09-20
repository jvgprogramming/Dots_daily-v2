<?php

namespace Database\Factories;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ActivityLog>
 */
class ActivityLogFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'action' => fake()->randomElement([
                'user.created',
                'user.updated',
                'patient.registered',
                'treatment.assigned',
                'medication.logged',
                'monitoring.recorded',
                'ai.recommendation.generated',
                'ai.recommendation.reviewed',
            ]),
            'description' => fake()->sentence(),
            'subject_type' => fake()->randomElement([
                'App\\Models\\User',
                'App\\Models\\Patient',
                'App\\Models\\TreatmentPlan',
            ]),
            'subject_id' => fake()->numberBetween(1, 100),
            'properties' => null,
            'ip_address' => fake()->ipv4(),
            'user_agent' => fake()->userAgent(),
            'created_at' => fake()->dateTimeThisMonth(),
        ];
    }
}
