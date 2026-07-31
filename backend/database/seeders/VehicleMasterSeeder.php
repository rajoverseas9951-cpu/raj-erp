<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class VehicleMasterSeeder extends Seeder
{
    private const DEFAULTS = [
        'manufacturers' => ['Maruti Suzuki', 'Hyundai', 'Tata Motors', 'Mahindra', 'Toyota', 'Honda Cars', 'Kia', 'MG Motor', 'Skoda', 'Volkswagen', 'Renault', 'Nissan', 'Jeep', 'BMW', 'Mercedes-Benz', 'Audi', 'Hero MotoCorp', 'Honda Motorcycle', 'TVS', 'Bajaj', 'Royal Enfield', 'Yamaha', 'Suzuki Motorcycle', 'KTM', 'Jawa', 'Yezdi', 'Ather', 'Ola Electric'],
        'colours' => ['White', 'Pearl White', 'Black', 'Silver', 'Grey', 'Metallic Grey', 'Red', 'Blue', 'Dark Blue', 'Brown', 'Green', 'Yellow', 'Orange', 'Golden', 'Beige', 'Purple', 'Maroon'],
        'fuel_types' => ['Petrol', 'Diesel', 'CNG', 'LPG', 'Electric', 'Hybrid', 'Petrol+CNG', 'Petrol+LPG', 'Hydrogen', 'Flex Fuel'],
        'vehicle_classes' => ['LMV', 'MMV', 'HMV', 'MCWG', 'MCWOG', 'Transport', 'Non Transport'],
        'body_types' => ['Hatchback', 'Sedan', 'SUV', 'MUV', 'Coupe', 'Convertible', 'Pickup', 'Truck', 'Bus', 'Van', 'Auto Rickshaw', 'Tempo', 'Tractor', 'Tanker', 'Tipper', 'Trailer', 'Scooter', 'Motorcycle', 'Moped'],
    ];
    private const MODELS = [
        'Maruti Suzuki' => ['Alto', 'Alto K10', 'Baleno', 'Brezza', 'Celerio', 'Dzire', 'Eeco', 'Ertiga', 'Fronx', 'Grand Vitara', 'Ignis', 'Jimny', 'S-Presso', 'Swift', 'WagonR', 'XL6'],
        'Hyundai' => ['Santro', 'i10', 'Grand i10', 'Grand i10 Nios', 'i20', 'Elite i20', 'Aura', 'Verna', 'Venue', 'Creta', 'Alcazar', 'Exter', 'Tucson'],
        'Tata Motors' => ['Indica', 'Indigo', 'Tiago', 'Tigor', 'Altroz', 'Punch', 'Nexon', 'Harrier', 'Safari', 'Nano', 'Curvv'],
        'Mahindra' => ['Bolero', 'Scorpio', 'Scorpio N', 'Thar', 'XUV300', 'XUV 3XO', 'XUV500', 'XUV700', 'KUV100', 'Marazzo'],
        'Toyota' => ['Etios', 'Glanza', 'Urban Cruiser', 'Hyryder', 'Innova', 'Innova Crysta', 'Innova Hycross', 'Fortuner', 'Camry'],
        'Honda Cars' => ['Brio', 'Amaze', 'Jazz', 'City', 'WR-V', 'Elevate', 'Civic', 'CR-V'],
        'Kia' => ['Sonet', 'Seltos', 'Carens', 'Carnival', 'EV6'],
        'MG Motor' => ['Hector', 'Astor', 'Gloster', 'Comet EV', 'ZS EV'],
        'Skoda' => ['Fabia', 'Rapid', 'Slavia', 'Kushaq', 'Octavia', 'Superb', 'Kodiaq'],
        'Volkswagen' => ['Polo', 'Vento', 'Ameo', 'Virtus', 'Taigun', 'Tiguan'],
        'Renault' => ['Kwid', 'Triber', 'Kiger', 'Duster', 'Lodgy'],
        'Nissan' => ['Micra', 'Sunny', 'Magnite', 'Kicks', 'Terrano'],
        'Jeep' => ['Compass', 'Meridian', 'Wrangler', 'Grand Cherokee'],
        'Hero MotoCorp' => ['Splendor', 'Splendor Plus', 'HF Deluxe', 'Passion', 'Glamour', 'Super Splendor', 'Xpulse', 'Karizma', 'Pleasure', 'Destini'],
        'Honda Motorcycle' => ['Activa', 'Dio', 'Shine', 'SP 125', 'Unicorn', 'Hornet', 'CB350', 'Dream Yuga', 'Livo'],
        'TVS' => ['Jupiter', 'Ntorq', 'Apache RTR 160', 'Apache RTR 200', 'Raider', 'Radeon', 'Sport', 'iQube'],
        'Bajaj' => ['Pulsar 125', 'Pulsar 150', 'Pulsar NS200', 'Pulsar N160', 'Platina', 'CT 100', 'Avenger', 'Chetak'],
        'Royal Enfield' => ['Bullet 350', 'Classic 350', 'Hunter 350', 'Meteor 350', 'Himalayan', 'Scram 411', 'Interceptor 650', 'Continental GT 650'],
        'Yamaha' => ['FZ', 'FZ-S', 'R15', 'MT-15', 'Fascino', 'RayZR', 'Aerox'],
        'Suzuki Motorcycle' => ['Access 125', 'Burgman Street', 'Gixxer', 'Gixxer SF', 'V-Strom SX', 'Avenis'],
        'KTM' => ['Duke 125', 'Duke 200', 'Duke 250', 'Duke 390', 'RC 200', 'RC 390', 'Adventure 390'],
        'Ather' => ['450S', '450X', 'Rizta'],
        'Ola Electric' => ['S1 X', 'S1 Air', 'S1 Pro'],
    ];

    public function run(): void
    {
        $tenants = DB::table('users')->whereNotNull('tenant_id')->distinct()->pluck('tenant_id');
        foreach ($tenants as $tenant) {
            $this->backfillVehicleValues((string) $tenant);
            foreach (self::DEFAULTS as $type => $names) {
                foreach ($names as $name) $this->insert((string) $tenant, $type, $name);
            }
            foreach (self::MODELS as $manufacturer => $models) {
                $parent = DB::table('vehicle_masters')->where('tenant_id', $tenant)->where('type', 'manufacturers')
                    ->whereRaw('UPPER(name) = ?', [strtoupper($manufacturer)])->value('id');
                foreach ($models as $model) $this->insert((string) $tenant, 'models', $model, $parent);
            }
            $this->assignVehicleMasterIds((string) $tenant);
        }
    }

    private function assignVehicleMasterIds(string $tenant): void
    {
        $map = [
            'manufacturer' => ['manufacturers', 'manufacturer_id'],
            'model' => ['models', 'model_id'],
            'colour' => ['colours', 'colour_id'],
            'vehicle_class' => ['vehicle_classes', 'vehicle_class_id'],
            'vehicle_category' => ['body_types', 'vehicle_category_id'],
            'fuel_type' => ['fuel_types', 'fuel_type_id'],
        ];
        foreach (DB::table('vehicles')->where('tenant_id', $tenant)->get() as $vehicle) {
            $updates = [];
            foreach ($map as $nameField => [$type, $idField]) {
                if (! $vehicle->{$nameField} || $vehicle->{$idField}) continue;
                $id = DB::table('vehicle_masters')->where('tenant_id', $tenant)->where('type', $type)
                    ->whereRaw('UPPER(name) = ?', [strtoupper(trim($vehicle->{$nameField}))])->whereNull('deleted_at')->value('id');
                if ($id) $updates[$idField] = $id;
            }
            if ($updates) DB::table('vehicles')->where('id', $vehicle->id)->update($updates);
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
