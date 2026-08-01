<?php

namespace Database\Seeders;

use App\Models\Tenant;
use Illuminate\Database\Seeder;

class OrganizationSeeder extends Seeder
{
    public function run(): void
    {
        Tenant::updateOrCreate(['id' => env('ADMIN_TENANT_ID', '00000000-0000-4000-8000-000000000001')], ['name' => 'Raj Insurance Consultancy', 'brand_name' => 'Vimawallah', 'tagline' => 'Your Safety, Our Responsibility', 'email' => 'vimawallah9951@gmail.com']);
    }
}
