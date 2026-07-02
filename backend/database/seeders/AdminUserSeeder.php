<?php

namespace Database\Seeders;

use App\Models\Patient;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $admin = User::firstOrCreate(
            ['email' => 'admin@dotsdaily.com'],
            [
                'name' => 'Admin',
                'phone' => '09171234567',
                'password' => Hash::make('password'),
                'role' => 'admin',
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );

        if ($admin->wasRecentlyCreated) {
            $this->command->info('Admin user created: admin@dotsdaily.com / password');
        } else {
            $this->command->warn('Admin user already exists, skipped.');
        }

        $patients = User::factory(5)->create();

        foreach ($patients as $user) {
            Patient::factory()->forUser($user)->create([
                'registered_by' => $admin->id,
            ]);
        }

        $this->command->info('5 test patients created.');
    }
}
