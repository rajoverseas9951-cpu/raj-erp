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
        'compliance' => ['fitness', 'permit', 'tax', 'counter_tax', 'hsrp', 'sld'],
        'operations' => ['rto_process', 'transfer'],
        'finance' => ['payment', 'agent_payment', 'other_payment'],
    ];

    public function modules(Vehicle $vehicle): array
    {
        $text = strtoupper(implode(' ', array_filter([
            $vehicle->vehicle_type, $vehicle->vehicle_class, $vehicle->vehicle_category,
        ])));

        $twoWheeler = (bool) preg_match('/TWO.?WHEEL|M.?CYCLE|MOTOR.?CYCLE|SCOOTER|BIKE/', $text);
        $nonTransport = (bool) preg_match('/NON[- ]?TRANSPORT|LMV.?NT/', $text);
        $privateCar = ((bool) preg_match('/PRIVATE|MOTOR CAR/', $text) || $nonTransport) && ! preg_match('/TAXI|CAB|PASSENGER/', $text);
        $agriTractor = str_contains($text, 'TRACTOR') && (bool) preg_match('/AGRI|AGRICULT|NON.?TRANSPORT/', $text);
        $passenger = (bool) preg_match('/TAXI|CAB|MAXI|PASSENGER|BUS/', $text);
        $goods = (bool) preg_match('/GOODS|TRUCK|PICK.?UP|PICKUP|CARRIER|HGV|LGV|TRAILER/', $text);
        $transport = ! $agriTractor && ! $nonTransport && ($passenger || $goods || (bool) preg_match('/COMMERCIAL|TRANSPORT/', $text));

        $enabled = array_fill_keys(['vehicle_details', 'insurance', 'puc', 'hsrp', 'rto_process', 'payment', 'transfer'], true);
        $enabled['other_payment'] = true;
        if ($transport) {
            $enabled += ['fitness' => true, 'permit' => true, 'tax' => true, 'agent_payment' => true];
            $enabled['counter_tax'] = $goods || $passenger;
            $enabled['sld'] = $goods || $passenger;
        }
        if ($twoWheeler || $privateCar || $agriTractor) {
            foreach (['fitness', 'permit', 'tax', 'counter_tax', 'sld', 'agent_payment'] as $module) {
                $enabled[$module] = false;
            }
        }

        if (Schema::hasTable('vehicle_module_overrides')) {
            $overrides = DB::table('vehicle_module_overrides')->where('tenant_id', $vehicle->tenant_id)
                ->where('vehicle_id', $vehicle->id)->whereNull('deleted_at')->get()
                ->all();
            foreach ($overrides as $override) {
                $enabled[$override->module] = (bool) $override->enabled;
            }
        }

        $groups = [];
        foreach (self::GROUPS as $group => $modules) {
            $groups[$group] = array_values(array_filter($modules, fn ($module) => $enabled[$module] ?? false));
        }

        return ['classification' => compact('twoWheeler', 'privateCar', 'agriTractor', 'passenger', 'goods', 'transport'), 'groups' => $groups];
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
