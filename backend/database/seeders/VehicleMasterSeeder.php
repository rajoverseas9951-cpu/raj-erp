<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class VehicleMasterSeeder extends Seeder
{
    private const DEFAULTS = [
        'fuel_types' => ['Petrol', 'Diesel', 'CNG', 'LPG', 'Electric', 'Hybrid', 'Petrol+CNG', 'Petrol+LPG', 'Hydrogen', 'Flex Fuel'],
        'vehicle_classes' => ['LMV', 'MMV', 'HMV', 'MCWG', 'MCWOG', 'Transport', 'Non Transport'],
        'body_types' => ['Hatchback', 'Sedan', 'SUV', 'MUV', 'Coupe', 'Convertible', 'Pickup', 'Truck', 'Bus', 'Van', 'Auto Rickshaw', 'Tempo', 'Tractor', 'Tanker', 'Tipper', 'Trailer', 'Scooter', 'Motorcycle', 'Moped'],
    ];

    public function run(): void
    {
        $tenants = DB::table('users')->whereNotNull('tenant_id')->distinct()->pluck('tenant_id');
        foreach ($tenants as $tenant) {
            $this->backfillVehicleValues((string) $tenant);
            foreach (self::DEFAULTS as $type => $names) {
                foreach ($names as $name) $this->insert((string) $tenant, $type, $name);
            }
        }
    }

    private function backfillVehicleValues(string $tenant): void
    {
        $vehicles = DB::table('vehicles')->where('tenant_id', $tenant)->whereNull('deleted_at')
            ->get(['manufacturer', 'model', 'colour']);
        foreach ($vehicles->pluck('manufacturer')->filter()->unique(fn ($v) => strtoupper(trim($v))) as $name) {
            $this->insert($tenant, 'manufacturers', $name);
        }
        foreach ($vehicles as $vehicle) {
            if (! $vehicle->model) continue;
            $parent = $vehicle->manufacturer
                ? DB::table('vehicle_masters')->where('tenant_id', $tenant)->where('type', 'manufacturers')
                    ->whereRaw('UPPER(name) = ?', [strtoupper(trim($vehicle->manufacturer))])->value('id')
                : null;
            if ($parent) $this->insert($tenant, 'models', $vehicle->model, $parent);
        }
        foreach ($vehicles->pluck('colour')->filter()->unique(fn ($v) => strtoupper(trim($v))) as $name) {
            $this->insert($tenant, 'colours', $name);
        }
    }

    private function insert(string $tenant, string $type, string $name, ?string $parent = null): void
    {
        $name = strtoupper(trim($name));
        if (DB::table('vehicle_masters')->where('tenant_id', $tenant)->where('type', $type)
            ->whereRaw('UPPER(name) = ?', [$name])->whereNull('deleted_at')->exists()) return;
        DB::table('vehicle_masters')->insert([
            'id' => (string) Str::uuid(), 'tenant_id' => $tenant, 'type' => $type,
            'name' => $name, 'parent_id' => $parent, 'status' => 'active',
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }
}
