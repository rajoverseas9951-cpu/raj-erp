<?php

namespace App\Features\Vehicles\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class RecordDependencyService
{
    public function vehicle(string $tenant, string $vehicle): array
    {
        $counts = [
            'policies' => $this->count('vehicle_insurances', $tenant, 'vehicle_id', $vehicle),
            'documents' => $this->count('vehicle_documents', $tenant, 'vehicle_id', $vehicle),
            'rto_work' => $this->firstCount(['vehicle_rto_files', 'rto_files', 'rto_works'], $tenant, 'vehicle_id', $vehicle),
            'claims' => $this->firstCount(['claims', 'vehicle_claims'], $tenant, 'vehicle_id', $vehicle),
            'payments' => $this->firstCount(['payments', 'vehicle_payments'], $tenant, 'vehicle_id', $vehicle),
            'ledger_entries' => $this->firstCount(['ledger_entries', 'accounting_voucher_entries'], $tenant, 'vehicle_id', $vehicle),
        ];
        return array_filter($counts, fn (int $count) => $count > 0);
    }

    public function policy(string $tenant, string $policy): array
    {
        $commission = 0;
        if (Schema::hasTable('insurance_commissions')) {
            $commission = DB::table('insurance_commissions')->where('tenant_id', $tenant)->where('policy_id', $policy)
                ->whereNull('deleted_at')->where(fn ($q) => $q->where('received_amount', '>', 0)->orWhereIn('status', ['partial', 'received', 'posted']))->count();
        }
        $document = 0;
        if (Schema::hasTable('vehicle_insurances') && Schema::hasTable('vehicle_documents')) {
            $documentId = DB::table('vehicle_insurances')->where('tenant_id', $tenant)->where('id', $policy)->value('policy_document_file_id');
            if ($documentId) $document = DB::table('vehicle_documents')->where('tenant_id', $tenant)->where('id', $documentId)->whereNull('deleted_at')->count();
        }
        $counts = [
            'financial_entries' => $commission + $this->firstCount(['accounting_vouchers', 'accounting_voucher_entries'], $tenant, 'policy_id', $policy),
            'claims' => $this->firstCount(['claims', 'vehicle_claims'], $tenant, 'policy_id', $policy),
            'payments' => $this->firstCount(['payments', 'policy_payments'], $tenant, 'policy_id', $policy),
            'documents' => $document + $this->firstCount(['policy_documents'], $tenant, 'policy_id', $policy),
        ];
        return array_filter($counts, fn (int $count) => $count > 0);
    }

    private function firstCount(array $tables, string $tenant, string $column, string $id): int
    {
        foreach ($tables as $table) if (Schema::hasTable($table) && Schema::hasColumn($table, $column)) return $this->count($table, $tenant, $column, $id);
        return 0;
    }

    private function count(string $table, string $tenant, string $column, string $id): int
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) return 0;
        return DB::table($table)->where('tenant_id', $tenant)->where($column, $id)
            ->when(Schema::hasColumn($table, 'deleted_at'), fn ($q) => $q->whereNull('deleted_at'))->count();
    }
}
