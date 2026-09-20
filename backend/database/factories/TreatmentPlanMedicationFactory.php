<?php

namespace Database\Factories;

use App\Models\Medication;
use App\Models\TreatmentPlan;
use App\Models\TreatmentPlanMedication;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TreatmentPlanMedication>
 */
class TreatmentPlanMedicationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $medication = Medication::inRandomOrder()->first() ?? Medication::factory();

        return [
            'treatment_plan_id' => TreatmentPlan::factory(),
            'medication_id' => $medication,
            'dosage' => fake()->randomElement(['300mg', '150mg', '400mg', '500mg']),
            'frequency' => fake()->randomElement(['Once daily', 'Twice daily', 'Three times weekly']),
            'route' => fake()->randomElement(['oral', 'oral', 'oral', 'intravenous', 'intramuscular']),
            'duration_weeks' => fake()->randomElement([2, 4, 8, 12, 24]),
            'preferred_time' => fake()->optional()->time('H:i:s', '12:00:00'),
            'notes' => fake()->optional()->sentence(),
        ];
    }
}
