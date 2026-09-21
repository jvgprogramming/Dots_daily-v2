<?php

namespace Database\Seeders;

use App\Models\Medication;
use Illuminate\Database\Seeder;

class MedicationCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $medications = [
            [
                'name' => 'Rifampicin',
                'generic_name' => 'Rifampicin',
                'brand_name' => 'Rifadin',
                'dosage_form' => 'capsule',
                'strength' => '300mg',
                'dosage' => '300mg capsule',
                'unit' => 'capsules',
                'quantity' => 500,
                'reorder_level' => 100,
                'storage_condition' => 'room_temperature',
                'expiry_date' => now()->addYear()->toDateString(),
                'stock_status' => 'in_stock',
                'description' => 'First-line anti-TB agent. Bactericidal - inhibits DNA-dependent RNA polymerase.',
            ],
            [
                'name' => 'Isoniazid',
                'generic_name' => 'Isoniazid',
                'brand_name' => 'Nydrazid',
                'dosage_form' => 'tablet',
                'strength' => '300mg',
                'dosage' => '300mg tablet',
                'unit' => 'tablets',
                'quantity' => 800,
                'reorder_level' => 150,
                'storage_condition' => 'room_temperature',
                'expiry_date' => now()->addYear()->toDateString(),
                'stock_status' => 'in_stock',
                'description' => 'First-line anti-TB agent. Bactericidal - inhibits mycolic acid synthesis.',
            ],
            [
                'name' => 'Pyrazinamide',
                'generic_name' => 'Pyrazinamide',
                'brand_name' => null,
                'dosage_form' => 'tablet',
                'strength' => '500mg',
                'dosage' => '500mg tablet',
                'unit' => 'tablets',
                'quantity' => 600,
                'reorder_level' => 100,
                'storage_condition' => 'room_temperature',
                'expiry_date' => now()->addYear()->toDateString(),
 'stock_status' => 'in_stock',
                'description' => 'First-line anti-TB agent. Bactericidal in acidic environment (intracellular).',
            ],
            [
                'name' => 'Ethambutol',
                'generic_name' => 'Ethambutol',
                'brand_name' => 'Myambutol',
                'dosage_form' => 'tablet',
                'strength' => '400mg',
                'dosage' => '400mg tablet',
                'unit' => 'tablets',
                'quantity' => 450,
                'reorder_level' => 100,
                'storage_condition' => 'room_temperature', 'expiry_date' => now()->addYear()->toDateString(),
                'stock_status' => 'in_stock',
                'description' => 'First-line anti-TB agent. Bacteriostatic - inhibits arabinosyl transferase.',
            ],
            [
                'name' => 'Streptomycin',
                'generic_name' => 'Streptomycin',
                'brand_name' => null,
                'dosage_form' => 'injection',
                'strength' => '1g',
                'dosage' => '1g injection',
                'unit' => 'vials',
                'quantity' => 60,
                'reorder_level' => 20,
                'storage_condition' => 'room_temperature',
                'expiry_date' => now()->addYear()->toDateString(),
                'stock_status' => 'in_stock',
                'description' => 'First-line injectable anti-TB agent. Bactericidal - inhibits protein synthesis.',
            ],
            [
                'name' => 'Rifapentine',
                'generic_name' => 'Rifapentine',
                'brand_name' => 'Priftin',
                'dosage_form' => 'tablet',
                'strength' => '150mg',
                'dosage' => '150mg tablet',
                'unit' => 'tablets',
                'quantity' => 350,
                'reorder_level' => 75,
                'storage_condition' => 'room_temperature',
                'expiry_date' => now()->addYear()->toDateString(),
                'stock_status' => 'in_stock',
                'description' => 'Long-acting rifamycin used in intermittent DOTS therapy.',
            ],
            [
                'name' => 'Moxifloxacin',
                'generic_name' => 'Moxifloxacin',
                'brand_name' => 'Avelox',
                'dosage_form' => 'tablet',
                'strength' => '400mg',
                'dosage' => '400mg tablet',
                'unit' => 'tablets',
                'quantity' => 450,
                'reorder_level' => 100,
                'storage_condition' => 'room_temperature', 'expiry_date' => now()->addYear()->toDateString(),
                'stock_status' => 'in_stock',
                'description' => 'Second-line fluoroquinolone for MDR-TB treatment.',
            ],
            [
                'name' => 'Bedaquiline',
                'generic_name' => 'Bedaquiline',
                'brand_name' => 'Sirturo',
                'dosage_form' => 'tablet',
                'strength' => '100mg',
                'dosage' => '100mg tablet',
                'unit' => 'tablets',
                'quantity' => 300,
                'reorder_level' => 75,
                'storage_condition' => 'room_temperature',
                'expiry_date' => now()->addYear()->toDateString(),
                'stock_status' => 'in_stock',
                'description' => 'Novel anti-TB agent for MDR-TB. Inhibits mycobacterial ATP synthase.',
            ],
        ];

        foreach ($medications as $medication) {
            Medication::create($medication);
        }

        $this->command->info(count($medications) . ' TB medications seeded.');
    }
}
