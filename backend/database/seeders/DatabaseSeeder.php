<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => env('ADMIN_EMAIL', 'admin@example.com')],
            ['tenant_id' => env('ADMIN_TENANT_ID', '00000000-0000-4000-8000-000000000001'), 'name' => env('ADMIN_NAME', 'Development Admin'), 'password' => env('ADMIN_PASSWORD', 'password'), 'is_admin' => true, 'email_verified_at' => now()]
        );
    }
}
