<?php

namespace Database\Factories;

use App\Models\AiConversation;
use App\Models\Patient;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AiConversation>
 */
class AiConversationFactory extends Factory
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
            'title' => fake()->optional()->randomElement([
                'Medication questions',
                'Side effects concern',
                'Symptom check',
                'Treatment progress inquiry',
            ]),
            'context' => fake()->optional()->text(200),
            'is_active' => fake()->boolean(80),
        ];
    }

    /**
     * Indicate an active conversation.
     */
    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => true,
        ]);
    }

    /**
     * Indicate a closed conversation.
     */
    public function closed(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }
}
