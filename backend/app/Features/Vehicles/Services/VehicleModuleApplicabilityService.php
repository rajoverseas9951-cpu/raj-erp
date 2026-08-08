<?php

namespace App\Features\Vehicles\Services;

use App\Features\Vehicles\Models\Vehicle;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class VehicleModuleApplicabilityService
{
    public const GROUPS = [
        'core' => ['vehicle_details', 'insurance', 'puc'],
        'compliance' => ['fitness', 'permit', 'hsrp', 'sld', 'vltd'],
        'operations' => ['rto_process'],
        'finance' => ['payment'],
    ];

    public function modules(Vehicle $vehicle): array
    {
        $text = strtoupper(implode(' ', array_filter([
            $vehicle->vehicle_type,
            $vehicle->vehicle_class,
            $vehicle->vehicle_category,
            $vehicle->manufacturer,
            $vehicle->model,
        ])));

        $twoWheeler = (bool) preg_match('/TWO.?WHEEL|2W|2WN|M.?CYCLE|MOTOR.?CYCLE|SCOOTER|SCOOTY|BIKE/', $text);
        $privateCar = (bool) preg_match('/PRIVATE|MOTOR.?CAR|LMV.?NT|NON[- ]?TRANSPORT|HATCHBACK|SEDAN|SUV/', $text)
            && ! preg_match('/TAXI|CAB|PASSENGER|LPV|PSV/', $text);

        // LGV / pickup gets the basic private-vehicle workflow plus Fitness.
        $lgvPickup = (bool) preg_match('/\bLGV\b|\bLCV\b|PICK.?UP|PICKUP|BOLERO.?PICKUP|GOODS.?CARRIER.?LGV/', $text)
            && ! preg_match('/\bHGV\b|\bHGVT\b|HEAVY/', $text);

        // Passenger commercial and heavy vehicles use the full commercial workflow.
        $passengerCommercial = (bool) preg_match('/\bLPV\b|TAXI|CAB|PASSENGER|PSV|MAXI|BUS/', $text);
        $heavyCommercial = (bool) preg_match('/\bHGV\b|\bHGVT\b|HEAVY|TRUCK|LORRY|TIPPER|DUMPER|TRAILER/', $text);
        $fullCommercial = $passengerCommercial || $heavyCommercial;

        // Every supported road vehicle starts with the same five operational services.
        $enabled = array_fill_keys([
            'vehicle_details',
            'insurance',
            'puc',
            'hsrp',
            'rto_process',
            'payment',
        ], true);

        if ($lgvPickup || $fullCommercial) {
            $enabled['fitness'] = true;
        }

        if ($fullCommercial) {
            $enabled['sld'] = true;
            $enabled['vltd'] = true;
            $enabled['permit'] = true;
        }

        if (Schema::hasTable('vehicle_module_overrides')) {
            $overrides = DB::table('vehicle_module_overrides')
                ->where('tenant_id', $vehicle->tenant_id)
                ->where('vehicle_id', $vehicle->id)
                ->whereNull('deleted_at')
                ->get()
                ->all();

            foreach ($overrides as $override) {
                $enabled[$override->module] = (bool) $override->enabled;
            }
        }

        $groups = [];
        foreach (self::GROUPS as $group => $modules) {
            $groups[$group] = array_values(array_filter($modules, fn ($module) => $enabled[$module] ?? false));
        }

        return [
            'classification' => compact(
                'twoWheeler',
                'privateCar',
                'lgvPickup',
                'passengerCommercial',
                'heavyCommercial',
                'fullCommercial'
            ),
            'groups' => $groups,
        ];
    }

    public static function status(?string $expiryDate, bool $exists = true, int $windowDays = 30): string
    {
        if (! $exists) {
            return 'NOT_ADDED';
        }
        if (! $expiryDate) {
            return 'ACTIVE';
        }
        $days = now()->startOfDay()->diffInDays(Carbon::parse($expiryDate)->startOfDay(), false);

        return $days < 0 ? 'EXPIRED' : ($days <= $windowDays ? 'EXPIRING_SOON' : 'ACTIVE');
    }
}
