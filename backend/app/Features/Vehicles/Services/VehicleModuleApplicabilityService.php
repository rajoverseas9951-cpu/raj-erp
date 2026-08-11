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
        'compliance' => ['fitness', 'permit', 'tax', 'hsrp', 'sld', 'vltd'],
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
        $type = strtolower((string) $vehicle->vehicle_type);
        $grossWeight = is_numeric($vehicle->gross_weight) ? (float) $vehicle->gross_weight : 0.0;

        $twoWheeler = $type === 'two_wheeler' || (bool) preg_match('/TWO.?WHEEL|2W|2WN|M.?CYCLE|MOTOR.?CYCLE|MOTORCYCLE|SCOOTER|SCOOTY|BIKE|MOPED/', $text);
        $privateCar = $type === 'private_car' || ((bool) preg_match('/PRIVATE|MOTOR.?CAR|LMV.?NT|NON[- ]?TRANSPORT|HATCHBACK|SEDAN|SUV/', $text) && ! preg_match('/TAXI|CAB|PASSENGER|LPV|PSV/', $text));
        $lgvPickup = in_array($type, ['lgv', 'lcv'], true) || ((bool) preg_match('/\bLGV\b|\bLCV\b|PICK.?UP|PICKUP|BOLERO.?PICKUP|GOODS.?CARRIER.?LGV|LIGHT.?GOODS/', $text) && ! preg_match('/\bHGV\b|\bHGVT\b|\bGT\b|HEAVY/', $text));
        $taxi = $type === 'taxi' || (bool) preg_match('/\bLPV\b|TAXI|CAB|PASSENGER|PSV|MAXI|CONTRACT.?CARRIAGE/', $text);
        $bus = $type === 'bus' || (bool) preg_match('/BUS|OMNI.?BUS|SCHOOL.?BUS|STAGE.?CARRIAGE/', $text);
        $ambulance = $type === 'ambulance' || (bool) preg_match('/AMBULANCE/', $text);
        $heavyByClass = in_array($type, ['hgv', 'goods_vehicle', 'commercial', 'transport'], true) || (bool) preg_match('/\bHGV\b|\bHGVT\b|\bGT\b|HEAVY|TRUCK|LORRY|TIPPER|DUMPER|TRAILER|ARTICULATED|MULTI.?AXLE/', $text);
        $commercialSignal = (bool) preg_match('/COMMERCIAL|TRANSPORT|GOODS|CARRIER|PASSENGER|PSV|LPV|TAXI|CAB|BUS|AMBULANCE|TRUCK|LORRY|TIPPER|DUMPER|TRAILER|HGV|HGVT|\bGT\b/', $text);
        $heavyByWeight = ! $twoWheeler && ! $privateCar && ! $lgvPickup && $commercialSignal && $grossWeight > 3500;
        $heavyCommercial = $heavyByClass || $heavyByWeight;
        $fullCommercial = ! $twoWheeler && ! $privateCar && ! $lgvPickup && ($taxi || $bus || $ambulance || $heavyCommercial);

        // Every supported road vehicle gets exactly these five base workflows.
        $enabled = array_fill_keys(['vehicle_details', 'insurance', 'puc', 'hsrp', 'rto_process', 'payment'], true);

        // Pickup/LGV adds Fitness only to the base workflow.
        if ($lgvPickup || $fullCommercial) {
            $enabled['fitness'] = true;
        }

        // Taxi, HGV, bus, ambulance and other full commercial vehicles.
        if ($fullCommercial) {
            $enabled['permit'] = true;
            $enabled['sld'] = true;
            $enabled['vltd'] = true;
        }

        // HGV/bus/ambulance/full heavy commercial: Tax defaults ON.
        // Taxi: Tax defaults OFF and can be enabled per vehicle through override.
        if ($heavyCommercial || $bus || $ambulance) {
            $enabled['tax'] = true;
        } elseif ($taxi) {
            $enabled['tax'] = false;
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
            'classification' => compact('twoWheeler', 'privateCar', 'lgvPickup', 'taxi', 'bus', 'ambulance', 'heavyByClass', 'heavyByWeight', 'heavyCommercial', 'fullCommercial', 'grossWeight'),
            'groups' => $groups,
        ];
    }

    public static function status(?string $expiryDate, bool $exists = true, int $windowDays = 30): string
    {
        if (! $exists) return 'NOT_ADDED';
        if (! $expiryDate) return 'ACTIVE';
        $days = now()->startOfDay()->diffInDays(Carbon::parse($expiryDate)->startOfDay(), false);
        return $days < 0 ? 'EXPIRED' : ($days <= $windowDays ? 'EXPIRING_SOON' : 'ACTIVE');
    }
}
