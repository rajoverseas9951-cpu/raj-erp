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
        $enabled = ['vehicle_details' => true];
        $class = $this->classMaster($vehicle);
        $rules = $class ? $this->decodeRules($class->module_rules ?? null) : [];

        if ($rules !== []) {
            foreach ($rules as $module => $mode) {
                if (! in_array($module, ['insurance','puc','hsrp','fitness','permit','tax','sld','vltd','rto_process','payment'], true)) continue;
                // required + optional both mean the module is applicable. Only na means unavailable.
                $enabled[$module] = in_array($mode, ['required', 'optional'], true);
            }
        } else {
            // Legacy fallback only for older records that have not yet been mapped to a class master.
            $profile = $this->legacyProfile($vehicle);
            foreach (['insurance','puc','hsrp','rto_process','payment'] as $m) $enabled[$m] = true;
            if (in_array($profile, ['lgv','taxi','hgv','bus','ambulance','commercial'], true)) $enabled['fitness'] = true;
            if (in_array($profile, ['taxi','hgv','bus','ambulance','commercial'], true)) foreach (['permit','sld','vltd'] as $m) $enabled[$m] = true;
            if (in_array($profile, ['hgv','bus','ambulance','commercial'], true)) $enabled['tax'] = true;
        }

        if (Schema::hasTable('vehicle_module_overrides')) {
            $overrides = DB::table('vehicle_module_overrides')
                ->where('tenant_id', $vehicle->tenant_id)->where('vehicle_id', $vehicle->id)
                ->whereNull('deleted_at')->get();
            foreach ($overrides as $override) $enabled[$override->module] = (bool) $override->enabled;
        }

        // Hard business invariant: RTO work is an operational service for every vehicle class.
        // Transfer, NOC, hypothecation, duplicate RC, renewal and other RTO work must never be
        // blocked just because a vehicle-class master has stale/missing module_rules.
        $enabled['rto_process'] = true;

        // Hard business invariant: LGV / pickup / light-goods vehicles always have Fitness.
        // This protects older/bad class-master mappings (e.g. GOODS CARRIER with fitness=na)
        // and prevents the UI from opening Fitness while the API rejects it.
        $identity = strtoupper(implode(' ', array_filter([
            $vehicle->vehicle_type,
            $vehicle->vehicle_class,
            $vehicle->vehicle_category,
            $vehicle->model,
        ])));
        $lgvFitnessRequired = (bool) preg_match('/\bLGV\b|\bLCV\b|PICK ?UP|PICKUP|LIGHT ?GOODS|GOODS ?CARRIER ?LGV/', $identity);
        if ($lgvFitnessRequired) $enabled['fitness'] = true;

        $groups = [];
        foreach (self::GROUPS as $group => $modules) {
            $groups[$group] = array_values(array_filter($modules, fn ($module) => $enabled[$module] ?? false));
        }

        $type = $class?->parent_id ? DB::table('vehicle_masters')->where('id',$class->parent_id)->first(['name','code']) : null;
        return [
            'classification' => [
                'profile' => strtolower((string) ($type?->code ?? $vehicle->vehicle_type ?? '')),
                'vehicleClassId' => $class?->id,
                'vehicleClass' => $class?->name ?? $vehicle->vehicle_class,
                'vehicleTypeId' => $class?->parent_id ?? $vehicle->vehicle_type_id,
                'vehicleType' => $type?->name ?? $vehicle->vehicle_type,
                'transportKind' => $class?->transport_kind ?? null,
                'moduleRules' => $rules,
                'twoWheeler' => strtolower((string) ($type?->code ?? $vehicle->vehicle_type)) === 'two_wheeler',
                'privateCar' => strtolower((string) ($type?->code ?? $vehicle->vehicle_type)) === 'private_car',
                'lgvPickup' => $lgvFitnessRequired || strtolower((string) ($type?->code ?? $vehicle->vehicle_type)) === 'lgv',
                'taxi' => strtolower((string) ($type?->code ?? $vehicle->vehicle_type)) === 'taxi',
                'hgv' => strtolower((string) ($type?->code ?? $vehicle->vehicle_type)) === 'hgv',
                'bus' => strtolower((string) ($type?->code ?? $vehicle->vehicle_type)) === 'bus',
                'ambulance' => strtolower((string) ($type?->code ?? $vehicle->vehicle_type)) === 'ambulance',
                'grossWeight' => is_numeric($vehicle->gross_weight) ? (float) $vehicle->gross_weight : 0.0,
            ],
            'groups' => $groups,
        ];
    }

    private function classMaster(Vehicle $vehicle): ?object
    {
        if (! $vehicle->vehicle_class_id || ! Schema::hasTable('vehicle_masters') || ! Schema::hasColumn('vehicle_masters','module_rules')) return null;
        return DB::table('vehicle_masters')->where('tenant_id',$vehicle->tenant_id)->where('id',$vehicle->vehicle_class_id)
            ->where('type','vehicle_classes')->where('status','active')->whereNull('deleted_at')->first();
    }

    private function decodeRules(mixed $rules): array
    {
        if (is_array($rules)) return $rules;
        if (! is_string($rules) || trim($rules) === '') return [];
        $decoded = json_decode($rules, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function legacyProfile(Vehicle $vehicle): string
    {
        $text = strtoupper(implode(' ', array_filter([$vehicle->vehicle_type,$vehicle->vehicle_class,$vehicle->vehicle_category])));
        $type = strtolower((string) $vehicle->vehicle_type);
        if ($type === 'two_wheeler' || preg_match('/MCWG|MCWOG|MOTOR ?CYCLE|SCOOTER|MOPED/', $text)) return 'two_wheeler';
        if ($type === 'private_car' || preg_match('/MOTOR ?CAR|LMV[- ]?NT/', $text)) return 'private_car';
        if (in_array($type,['lgv','lcv'],true) || preg_match('/LGV|LCV|PICK ?UP|LIGHT ?GOODS/', $text)) return 'lgv';
        if ($type === 'taxi' || preg_match('/MOTOR ?CAB|MAXI ?CAB|LPV|TAXI/', $text)) return 'taxi';
        if ($type === 'bus' || preg_match('/BUS|OMNIBUS/', $text)) return 'bus';
        if ($type === 'ambulance' || preg_match('/AMBULANCE/', $text)) return 'ambulance';
        if (in_array($type,['hgv','goods_vehicle','commercial','transport'],true) || preg_match('/HGV|HGVT|\\bGT\\b|TRUCK|TIPPER|DUMPER/', $text)) return 'hgv';
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
