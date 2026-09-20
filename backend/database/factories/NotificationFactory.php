<?php

namespace Database\Factories;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Notification>
 */
class NotificationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'type' => fake()->randomElement([
                'missed_dose',
                'symptom_alert',
                'appointment_reminder',
                'treatment_update',
                'ai_recommendation',
            ]),
            'title' => fake()->randomElement([
                'Missed dose detected',
                'New symptom reported',
                'Treatment progress update',
                'AI recommendation available',
                'Appointment reminder',
            ]),
            'body' => fake()->sentence(8),
            'data' => null,
            'sender_id' => User::factory()->admin(),
        ];
    }
}
