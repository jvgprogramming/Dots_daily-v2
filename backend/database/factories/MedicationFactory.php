<?php

namespace Database\Factories;

use App\Models\Medication;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Medication>
 */
class MedicationFactory extends Factory
{
    /**
     * Predefined realistic TB medications.
     */
    protected static array $medications = [
        [
            'name' => 'Rifampicin',
            'generic_name' => 'Rifampicin',
            'brand_name' => 'Rifadin',
            'dosage_form' => 'capsule',
            'strength' => '300mg',
            'unit' => 'capsules',
        ],
        [
            'name' => 'Isoniazid',
            'generic_name' => 'Isoniazid',
            'brand_name' => 'Nydrazid',
            'dosage_form' => 'tablet',
            'strength' => '300mg',
            'unit' => 'tablets',
        ],
        [
            'name' => 'Pyrazinamide',
            'generic_name' => 'Pyrazinamide',
            'brand_name' => null,
            'dosage_form' => 'tablet',
            'strength' => '500mg',
            'unit' => 'tablets',
        ],
        [
            'name' => 'Ethambutol',
            'generic_name' => 'Ethambutol',
            'brand_name' => 'Myambutol',
            'dosage_form' => 'tablet',
            'strength' => '400mg',
            'unit' => 'tablets',
        ],
        [
            'name' => 'Streptomycin',
            'generic_name' => 'Streptomycin',
            'brand_name' => null,
            'dosage_form' => 'injection',
            'strength' => '1g',
            'unit' => 'vials',
        ],
        [
            'name' => 'Rifapentine',
            'generic_name' => 'Rifapentine',
            'brand_name' => 'Priftin',
            'dosage_form' => 'tablet',
            'strength' => '150mg',
            'unit' => 'tablets',
        ],
        [
            'name' => 'Moxifloxacin',
            'generic_name' => 'Moxifloxacin',
            'brand_name' => 'Avelox',
            'dosage_form' => 'tablet',
            'strength' => '400mg',
            'unit' => 'tablets',
        ],
        [
            'name' => 'Bedaquiline',
            'generic_name' => 'Bedaquiline',
            'brand_name' => 'Sirturo',
            'dosage_form' => 'tablet',
            'strength' => '100mg',
            'unit' => 'tablets',
        ],
    ];

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $medication = fake()->randomElement(static::$medications);

        return [
            'name' => $medication['name'],
            'generic_name' => $medication['generic_name'],
            'brand_name' => $medication['brand_name'],
            'dosage_form' => $medication['dosage_form'],
            'strength' => $medication['strength'],
            'dosage' => $medication['strength'] . ' ' . rtrim($medication['unit'], 's'),
            'unit' => $medication['unit'],
            'quantity' => fake()->numberBetween(0, 600),
            'reorder_level' => 50,
            'storage_condition' => Medication::STORAGE_ROOM_TEMPERATURE,
            'expiry_date' => now()->addMonths(fake()->numberBetween(6, 24))->toDateString(),
            'description' => fake()->optional()->sentence(),
            'is_active' => true,
        ];
    }
}
