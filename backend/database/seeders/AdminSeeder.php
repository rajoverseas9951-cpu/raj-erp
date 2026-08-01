<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = env('ADMIN_TENANT_ID', '00000000-0000-4000-8000-000000000001');
        $permissions = collect(['users.view','users.create','users.update','users.delete','roles.view','audit.view','customer.view','customer.create','customer.update','customer.delete','customer.bulk','customer.export','vehicle.view','vehicle.create','vehicle.update','vehicle.delete','vehicle.bulk','vehicle.export'])
            ->map(fn ($name) => Permission::firstOrCreate(['name' => $name], ['description' => ucfirst(str_replace('.', ' ', $name))]));
        $role = Role::firstOrCreate(['tenant_id' => $tenant, 'slug' => 'administrator'], ['name' => 'Administrator']);
        $role->permissions()->sync($permissions->pluck('id'));

        $admin = User::query()->where('tenant_id', $tenant)->where('email', 'admin@example.com')->first()
            ?? User::query()->where('tenant_id', $tenant)->where('is_admin', true)->first()
            ?? new User(['tenant_id' => $tenant]);
        if (! $admin->exists && ! env('ADMIN_PASSWORD')) {
            throw new RuntimeException('ADMIN_PASSWORD is required when creating the initial administrator.');
        }
        $admin->fill([
            'name' => env('ADMIN_NAME', $admin->name ?: 'Administrator'),
            'email' => strtolower(env('ADMIN_EMAIL', 'vimawallah9951@gmail.com')),
            'is_admin' => true,
            'is_active' => true,
            'email_verified_at' => $admin->email_verified_at ?: now(),
        ]);
        if (env('ADMIN_PASSWORD')) {
            $admin->password = env('ADMIN_PASSWORD');
        }
        $admin->save();
        $admin->roles()->syncWithoutDetaching([$role->id]);
    }
}
