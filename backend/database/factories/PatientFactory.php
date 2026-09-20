<?php

namespace Database\Factories;

use App\Models\Patient;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Patient>
 */
class PatientFactory extends Factory
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
            'date_of_birth' => fake()->dateTimeBetween('-80 years', '-18 years')->format('Y-m-d'),
            'gender' => fake()->randomElement(['male', 'female']),
            'address' => fake()->address(),
            'emergency_contact_name' => fake()->name(),
            'emergency_contact_phone' => fake()->phoneNumber(),
            'occupation' => fake()->optional()->jobTitle(),
            'nationality' => 'Filipino',
            'health_id_number' => fake()->unique()->regexify('[A-Z]{3}-\d{6}'),
            'referred_by' => fake()->optional()->name(),
            'registered_by' => User::factory()->admin(),
            'registered_at' => fake()->dateTimeThisYear(),
        ];
    }

    /**
     * Indicate a specific user as the patient.
     */
    public function forUser(User $user): static
    {
        return $this->state(fn (array $attributes) => [
            'user_id' => $user->id,
        ]);
    }
}
