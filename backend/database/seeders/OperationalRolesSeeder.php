<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class OperationalRolesSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = env('ADMIN_TENANT_ID', '00000000-0000-4000-8000-000000000001');

        $permissionNames = [
            'users.view', 'users.create', 'users.update', 'users.delete',
            'roles.view', 'audit.view',
            'customer.view', 'customer.create', 'customer.update', 'customer.delete', 'customer.bulk', 'customer.export',
            'vehicle.view', 'vehicle.create', 'vehicle.update', 'vehicle.delete', 'vehicle.bulk', 'vehicle.export',
            'vehicle.financial.view', 'vehicle.financial.edit', 'vehicle.documents',
        ];

        $permissions = collect($permissionNames)->mapWithKeys(function (string $name) {
            $permission = Permission::updateOrCreate(
                ['name' => $name],
                ['description' => ucfirst(str_replace('.', ' ', $name))],
            );
            return [$name => $permission->id];
        });

        $roles = [
            'administrator' => [
                'name' => 'Administrator',
                'permissions' => $permissionNames,
            ],
            'branch-manager' => [
                'name' => 'Branch Manager',
                'permissions' => [
                    'users.view', 'users.create', 'users.update', 'roles.view',
                    'customer.view', 'customer.create', 'customer.update', 'customer.bulk', 'customer.export',
                    'vehicle.view', 'vehicle.create', 'vehicle.update', 'vehicle.bulk', 'vehicle.export',
                    'vehicle.financial.view', 'vehicle.financial.edit', 'vehicle.documents',
                ],
            ],
            'insurance-executive' => [
                'name' => 'Insurance Executive',
                'permissions' => [
                    'customer.view', 'customer.create', 'customer.update',
                    'vehicle.view', 'vehicle.create', 'vehicle.update', 'vehicle.documents',
                    'vehicle.financial.view', 'vehicle.financial.edit',
                ],
            ],
            'claims-executive' => [
                'name' => 'Claims Executive',
                'permissions' => [
                    'customer.view', 'customer.update',
                    'vehicle.view', 'vehicle.update', 'vehicle.documents',
                    'vehicle.financial.view',
                ],
            ],
            'accounts-executive' => [
                'name' => 'Accounts Executive',
                'permissions' => [
                    'customer.view', 'vehicle.view',
                    'vehicle.financial.view', 'vehicle.financial.edit',
                ],
            ],
            'rto-executive' => [
                'name' => 'RTO Executive',
                'permissions' => [
                    'customer.view', 'customer.update',
                    'vehicle.view', 'vehicle.create', 'vehicle.update', 'vehicle.documents',
                    'vehicle.financial.view', 'vehicle.financial.edit',
                ],
            ],
            'read-only' => [
                'name' => 'Read Only',
                'permissions' => [
                    'customer.view', 'customer.export',
                    'vehicle.view', 'vehicle.export', 'vehicle.financial.view',
                ],
            ],
        ];

        foreach ($roles as $slug => $config) {
            $role = Role::updateOrCreate(
                ['tenant_id' => $tenant, 'slug' => $slug],
                ['name' => $config['name']],
            );
            $role->permissions()->sync(
                collect($config['permissions'])
                    ->map(fn (string $name) => $permissions[$name])
                    ->values()
                    ->all(),
            );
        }
    }
}
