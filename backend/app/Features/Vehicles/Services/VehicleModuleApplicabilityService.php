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

    /**
     * Single business matrix for every vehicle profile.
     *
     * Base services for Two Wheeler / Private Car:
     * Insurance, PUC, HSRP, RTO Process, Payment.
     *
     * LGV / Pickup adds Fitness.
     * Taxi adds Fitness, Permit, SLD, VLTD; Tax is optional per vehicle.
     * HGV / Bus / Ambulance / other heavy commercial gets the complete set,
     * including Tax by default.
     */
    public function modules(Vehicle $vehicle): array
    {
        $profile = $this->profile($vehicle);

        // Vehicle details is the profile itself. The remaining five are the
        // standard service workflows for every supported road vehicle.
        $enabled = array_fill_keys([
            'vehicle_details',
            'insurance',
            'puc',
            'hsrp',
            'rto_process',
            'payment',
        ], true);

        if (in_array($profile, ['lgv', 'taxi', 'hgv', 'bus', 'ambulance', 'commercial'], true)) {
            $enabled['fitness'] = true;
        }

        if (in_array($profile, ['taxi', 'hgv', 'bus', 'ambulance', 'commercial'], true)) {
            $enabled['permit'] = true;
            $enabled['sld'] = true;
            $enabled['vltd'] = true;
        }

        // Taxi tax is optional. A saved module override can switch it on.
        // Heavy commercial, buses and ambulances always start with Tax enabled.
        if (in_array($profile, ['hgv', 'bus', 'ambulance', 'commercial'], true)) {
            $enabled['tax'] = true;
        } elseif ($profile === 'taxi') {
            $enabled['tax'] = false;
        }

        if (Schema::hasTable('vehicle_module_overrides')) {
            $overrides = DB::table('vehicle_module_overrides')
                ->where('tenant_id', $vehicle->tenant_id)
                ->where('vehicle_id', $vehicle->id)
                ->whereNull('deleted_at')
                ->get();

            foreach ($overrides as $override) {
                $enabled[$override->module] = (bool) $override->enabled;
            }
        }

        $groups = [];
        foreach (self::GROUPS as $group => $modules) {
            $groups[$group] = array_values(array_filter(
                $modules,
                fn ($module) => $enabled[$module] ?? false,
            ));
        }

        return [
            'classification' => [
                'profile' => $profile,
                'twoWheeler' => $profile === 'two_wheeler',
                'privateCar' => $profile === 'private_car',
                'lgvPickup' => $profile === 'lgv',
                'taxi' => $profile === 'taxi',
                'hgv' => $profile === 'hgv',
                'bus' => $profile === 'bus',
                'ambulance' => $profile === 'ambulance',
                'fullCommercial' => in_array($profile, ['taxi', 'hgv', 'bus', 'ambulance', 'commercial'], true),
                'grossWeight' => is_numeric($vehicle->gross_weight) ? (float) $vehicle->gross_weight : 0.0,
            ],
            'groups' => $groups,
        ];
    }

    /** Resolve the canonical type from the Vehicle Type Directory first. */
    private function profile(Vehicle $vehicle): string
    {
        $masterName = '';
        $masterCode = '';

        if ($vehicle->vehicle_type_id && Schema::hasTable('vehicle_masters')) {
            $master = DB::table('vehicle_masters')
                ->where('tenant_id', $vehicle->tenant_id)
                ->where('id', $vehicle->vehicle_type_id)
                ->whereNull('deleted_at')
                ->first(['name', 'code']);
            $masterName = (string) ($master?->name ?? '');
            $masterCode = (string) ($master?->code ?? '');
        }

        $text = strtoupper(implode(' ', array_filter([
            $masterCode,
            $masterName,
            $vehicle->vehicle_type,
            $vehicle->vehicle_class,
            $vehicle->vehicle_category,
        ])));
        $normalized = strtolower(trim((string) $vehicle->vehicle_type));

        if ($normalized === 'two_wheeler' || preg_match('/\b(MCWG|MCWOG|MOTOR ?CYCLE|MOTORCYCLE|SCOOTER|MOPED|TWO ?WHEELER|2W)\b/', $text)) {
            return 'two_wheeler';
        }

        if ($normalized === 'private_car' || (preg_match('/\b(PRIVATE ?CAR|MOTOR ?CAR|LMV[- ]?NT|NON[- ]?TRANSPORT|SEDAN|HATCHBACK|SUV)\b/', $text)
            && ! preg_match('/\b(TAXI|CAB|LPV|PSV|PASSENGER)\b/', $text))) {
            return 'private_car';
        }

        if (in_array($normalized, ['lgv', 'lcv'], true) || preg_match('/\b(LGV|LGVT|LCV|PICK ?UP|PICKUP|LIGHT ?GOODS|LIGHT ?GOODS ?VEHICLE)\b/', $text)) {
            return 'lgv';
        }

        if ($normalized === 'taxi' || preg_match('/\b(TAXI|MOTOR ?CAB|MAXI ?CAB|LPV|PSV|CONTRACT ?CARRIAGE)\b/', $text)) {
            return 'taxi';
        }

        if ($normalized === 'bus' || preg_match('/\b(BUS|OMNI ?BUS|SCHOOL ?BUS|STAGE ?CARRIAGE)\b/', $text)) {
            return 'bus';
        }

        if ($normalized === 'ambulance' || preg_match('/\bAMBULANCE\b/', $text)) {
            return 'ambulance';
        }

        if (in_array($normalized, ['hgv', 'goods_vehicle', 'commercial', 'transport'], true)
            || preg_match('/\b(HGV|HGVT|HGMV|HMV|GT|HEAVY ?GOODS|TRUCK|LORRY|TIPPER|DUMPER|TRAILER|MULTI ?AXLE|GOODS ?VEHICLE)\b/', $text)) {
            return 'hgv';
        }

        // Unknown transport/commercial master entries get the complete
        // commercial workflow rather than silently losing compliance modules.
        if (preg_match('/\b(COMMERCIAL|TRANSPORT|GOODS|CARRIER|PASSENGER)\b/', $text)) {
            return 'commercial';
        }

        // Safe default for unknown non-commercial vehicles: private-style base.
        return 'private_car';
    }

    public static function status(?string $expiryDate, bool $exists = true, int $windowDays = 30): string
    {
        if (! $exists) return 'NOT_ADDED';
        if (! $expiryDate) return 'ACTIVE';
        $days = now()->startOfDay()->diffInDays(Carbon::parse($expiryDate)->startOfDay(), false);
        return $days < 0 ? 'EXPIRED' : ($days <= $windowDays ? 'EXPIRING_SOON' : 'ACTIVE');
    }
}
