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
        'operations' => ['renewal_registration', 'rto_process'],
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

        $grossWeight = is_numeric($vehicle->gross_weight) ? (float) $vehicle->gross_weight : 0.0;

        $twoWheeler = (bool) preg_match(
            '/TWO.?WHEEL|2W|2WN|M.?CYCLE|MOTOR.?CYCLE|MOTORCYCLE|SCOOTER|SCOOTY|BIKE|MOPED/',
            $text
        );

        $passengerCommercial = (bool) preg_match(
            '/\bLPV\b|TAXI|CAB|PASSENGER|PSV|MAXI|BUS|OMNI.?BUS|SCHOOL.?BUS|STAGE.?CARRIAGE|CONTRACT.?CARRIAGE/',
            $text
        );

        $privateCar = (bool) preg_match(
            '/PRIVATE|MOTOR.?CAR|LMV.?NT|NON[- ]?TRANSPORT|HATCHBACK|SEDAN|SUV/',
            $text
        ) && ! $passengerCommercial;

        $lgvPickup = (bool) preg_match(
            '/\bLGV\b|\bLCV\b|PICK.?UP|PICKUP|BOLERO.?PICKUP|GOODS.?CARRIER.?LGV|LIGHT.?GOODS/',
            $text
        ) && ! preg_match('/\bHGV\b|\bHGVT\b|\bGT\b|HEAVY/', $text);

        $heavyByClass = (bool) preg_match(
            '/\bHGV\b|\bHGVT\b|\bGT\b|HEAVY|TRUCK|LORRY|TIPPER|DUMPER|TRAILER|ARTICULATED|MULTI.?AXLE/',
            $text
        );

        $commercialSignal = (bool) preg_match(
            '/COMMERCIAL|TRANSPORT|GOODS|CARRIER|PASSENGER|PSV|LPV|TAXI|CAB|BUS|TRUCK|LORRY|TIPPER|DUMPER|TRAILER|HGV|HGVT|\bGT\b/',
            $text
        );
        $heavyByWeight = ! $twoWheeler
            && ! $privateCar
            && ! $lgvPickup
            && $commercialSignal
            && $grossWeight > 3500;

        $heavyCommercial = $heavyByClass || $heavyByWeight;
        $fullCommercial = ! $twoWheeler
            && ! $privateCar
            && ! $lgvPickup
            && ($passengerCommercial || $heavyCommercial);

        $enabled = array_fill_keys([
            'vehicle_details',
            'insurance',
            'puc',
            'hsrp',
            'rto_process',
            'payment',
        ], true);

        // Renewal Registration is a dedicated shortcut into the RTO workflow,
        // shown only for private cars and two wheelers.
        if ($privateCar || $twoWheeler) {
            $enabled['renewal_registration'] = true;
        }

        if ($lgvPickup || $fullCommercial) {
            $enabled['fitness'] = true;
        }

        if ($fullCommercial) {
            $enabled['sld'] = true;
            $enabled['vltd'] = true;
        }

        $permitApplicable = $fullCommercial;
        if ($permitApplicable) {
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
                'heavyByClass',
                'heavyByWeight',
                'heavyCommercial',
                'fullCommercial',
                'permitApplicable',
                'grossWeight'
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
