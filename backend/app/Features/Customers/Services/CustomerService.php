<?php

namespace App\Features\Customers\Services;

use App\Features\Accounting\Models\Ledger;
use App\Features\Customers\Models\Customer;
use App\Features\Customers\Repositories\CustomerRepository;
use App\Features\Customers\Repositories\CustomerTimelineRepository;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class CustomerService
{
    public function __construct(
        private CustomerRepository $customers,
        private CustomerTimelineRepository $timeline
    ) {}

    public function create(array $data, string $tenantId, ?string $actorId): Customer
    {
        return DB::transaction(function () use ($data, $tenantId, $actorId) {
            $accounting = Arr::only($data, [
                'create_ledger','ledger_group','opening_balance','balance_type',
                'credit_limit','credit_days','gst_applicable',
            ]);

            $customerData = Arr::except($data, array_keys($accounting));
            $customerData += [
                'tenant_id' => $tenantId,
                'created_by' => $actorId,
                'updated_by' => $actorId,
                'customer_code' => $this->nextCode($tenantId),
            ];

            $customer = $this->customers->create($customerData);

            if (($accounting['create_ledger'] ?? true) === true) {
                Ledger::create([
                    'tenant_id' => $tenantId,
                    'customer_id' => $customer->id,
                    'ledger_name' => trim(implode(' ', array_filter([
                        $customer->first_name,
                        $customer->middle_name,
                        $customer->last_name,
                    ]))),
                    'ledger_group' => $accounting['ledger_group'] ?? 'sundry_debtors',
                    'opening_balance' => $accounting['opening_balance'] ?? 0,
                    'balance_type' => $accounting['balance_type'] ?? 'debit',
                    'credit_limit' => $accounting['credit_limit'] ?? null,
                    'credit_days' => $accounting['credit_days'] ?? null,
                    'gst_applicable' => $accounting['gst_applicable'] ?? !empty($customer->gst_number),
                    'status' => 'active',
                    'created_by' => $actorId,
                    'updated_by' => $actorId,
                ]);
            }

            $this->record(
                $customer,
                $actorId,
                'customer.created',
                'Created Customer',
                'Customer profile and accounting ledger were created.'
            );

            return $customer;
        });
    }

    public function update(Customer $customer, array $data, ?string $actorId): Customer
    {
        return DB::transaction(function () use ($customer, $data, $actorId) {
            $accounting = Arr::only($data, [
                'create_ledger','ledger_group','opening_balance','balance_type',
                'credit_limit','credit_days','gst_applicable',
            ]);
            $customerData = Arr::except($data, array_keys($accounting));

            $before = $customer->toArray();
            $customerData['updated_by'] = $actorId;
            $updated = $this->customers->update($customer, $customerData);

            $ledger = Ledger::where('tenant_id', $customer->tenant_id)
                ->where('customer_id', $customer->id)
                ->first();

            if ($ledger) {
                $ledger->update([
                    'ledger_name' => trim(implode(' ', array_filter([
                        $updated->first_name,
                        $updated->middle_name,
                        $updated->last_name,
                    ]))),
                    'ledger_group' => $accounting['ledger_group'] ?? $ledger->ledger_group,
                    'opening_balance' => $accounting['opening_balance'] ?? $ledger->opening_balance,
                    'balance_type' => $accounting['balance_type'] ?? $ledger->balance_type,
                    'credit_limit' => array_key_exists('credit_limit', $accounting) ? $accounting['credit_limit'] : $ledger->credit_limit,
                    'credit_days' => array_key_exists('credit_days', $accounting) ? $accounting['credit_days'] : $ledger->credit_days,
                    'gst_applicable' => $accounting['gst_applicable'] ?? $ledger->gst_applicable,
                    'updated_by' => $actorId,
                ]);
            }

            $this->record($updated, $actorId, 'customer.edited', 'Edited Customer', 'Customer profile was updated.', [
                'before' => $before,
                'after' => $updated->toArray(),
            ]);

            return $updated;
        });
    }

    public function bulkDelete(array $ids, string $tenantId): int
    {
        Ledger::where('tenant_id', $tenantId)->whereIn('customer_id', $ids)->delete();
        return $this->customers->bulkDelete($ids, $tenantId);
    }

    public function bulkAssign(array $ids, string $tenantId, string $assigneeId): int
    {
        return $this->customers->bulkAssign($ids, $tenantId, $assigneeId);
    }

    public function record(Customer $customer, ?string $actorId, string $type, string $title, string $description, array $metadata = []): void
    {
        $this->timeline->record([
            'tenant_id' => $customer->tenant_id,
            'customer_id' => $customer->id,
            'actor_id' => $actorId,
            'event_type' => $type,
            'title' => $title,
            'description' => $description,
            'metadata' => $metadata,
        ]);
    }

    private function nextCode(string $tenantId): string
    {
        return 'CUST-'.now()->format('Ymd').'-'.str_pad((string) random_int(1, 999999), 6, '0', STR_PAD_LEFT);
    }
}
