<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DataIntegrityInspector
{
    public function inspect(): array
    {
        return [
            'policies_with_missing_vehicles' => $this->orphans('vehicle_insurances', 'vehicle_id', 'vehicles'),
            'accounting_entries_with_missing_policies' => $this->firstOrphans(['accounting_vouchers', 'accounting_voucher_entries'], 'policy_id', 'vehicle_insurances'),
            'policies_linked_to_deleted_vehicles' => $this->policiesLinkedToDeletedVehicles(),
            'orphan_commissions' => $this->orphans('insurance_commissions', 'policy_id', 'vehicle_insurances'),
            'orphan_payments' => $this->firstOrphans(['payments', 'policy_payments'], 'policy_id', 'vehicle_insurances'),
            'orphan_claims' => $this->firstOrphans(['claims', 'vehicle_claims'], 'policy_id', 'vehicle_insurances'),
        ];
    }

    private function policiesLinkedToDeletedVehicles(): array
    {
        if (! Schema::hasTable('vehicle_insurances') || ! Schema::hasTable('vehicles') || ! Schema::hasColumn('vehicles', 'deleted_at')) return [];
        return DB::table('vehicle_insurances')->join('vehicles', 'vehicles.id', '=', 'vehicle_insurances.vehicle_id')
            ->whereNotNull('vehicles.deleted_at')->whereNull('vehicle_insurances.deleted_at')->pluck('vehicle_insurances.id')->all();
    }

    private function firstOrphans(array $tables, string $foreignKey, string $parent): array
    {
        foreach ($tables as $table) if (Schema::hasTable($table) && Schema::hasColumn($table, $foreignKey)) return $this->orphans($table, $foreignKey, $parent);
        return [];
    }

    private function orphans(string $table, string $foreignKey, string $parent): array
    {
        if (! Schema::hasTable($table) || ! Schema::hasTable($parent) || ! Schema::hasColumn($table, $foreignKey)) return [];
        return DB::table($table)->leftJoin($parent, "{$parent}.id", '=', "{$table}.{$foreignKey}")
            ->whereNotNull("{$table}.{$foreignKey}")->whereNull("{$parent}.id")
            ->when(Schema::hasColumn($table, 'deleted_at'), fn ($q) => $q->whereNull("{$table}.deleted_at"))
            ->pluck("{$table}.id")->all();
    }
}
