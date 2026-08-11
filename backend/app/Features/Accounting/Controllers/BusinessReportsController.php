<?php

namespace App\Features\Accounting\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class BusinessReportsController
{
    private function tenant(Request $request): string
    {
        return (string) ($request->user()?->tenant_id ?? $request->header('X-Tenant-Id'));
    }

    private function dates(Request $request): array
    {
        return [$request->input('from'), $request->input('to')];
    }

    private function applyDates($query, string $column, ?string $from, ?string $to)
    {
        if ($from) $query->whereDate($column, '>=', $from);
        if ($to) $query->whereDate($column, '<=', $to);
        return $query;
    }

    private function vehicleBase(string $table, string $tenant)
    {
        return DB::table($table.' as x')
            ->leftJoin('vehicles as v', 'v.id', '=', 'x.vehicle_id')
            ->leftJoin('customers as c', 'c.id', '=', 'v.customer_id')
            ->where('x.tenant_id', $tenant)
            ->whereNull('x.deleted_at')
            ->select([
                'x.*', 'v.vehicle_number', 'v.vehicle_type', 'v.vehicle_class',
                'c.first_name', 'c.middle_name', 'c.last_name', 'c.mobile',
            ]);
    }

    private function customerName($row): string
    {
        return trim(implode(' ', array_filter([$row->first_name ?? null, $row->middle_name ?? null, $row->last_name ?? null]))) ?: '—';
    }

    public function overview(Request $request)
    {
        $tenant = $this->tenant($request);
        [$from, $to] = $this->dates($request);

        $policies = DB::table('vehicle_insurances')->where('tenant_id', $tenant)->whereNull('deleted_at');
        $this->applyDates($policies, 'issue_date', $from, $to);
        $policyCount = (clone $policies)->count();
        $premium = (float) (clone $policies)->sum('gross_premium');
        $insuranceCommission = (float) (clone $policies)->sum('gross_commission');
        $agentCommission = (float) (clone $policies)->sum('agent_commission');
        $discount = (float) (clone $policies)->sum('customer_discount');
        $insuranceProfit = $insuranceCommission - $agentCommission - $discount;

        $rto = $this->rtoRows($tenant, $from, $to);
        $rtoBilling = $rto->sum('billed');
        $rtoCost = $rto->sum('cost');
        $rtoProfit = $rto->sum('profit');

        $payments = DB::table('vehicle_payments')->where('tenant_id', $tenant)->whereNull('deleted_at');
        $this->applyDates($payments, 'created_at', $from, $to);
        $received = (float) $payments->sum('paid_amount');

        return response()->json(['success' => true, 'data' => [
            'policy_count' => $policyCount,
            'insurance_premium' => round($premium, 2),
            'insurance_commission' => round($insuranceCommission, 2),
            'insurance_profit' => round($insuranceProfit, 2),
            'rto_work_count' => $rto->count(),
            'rto_billing' => round($rtoBilling, 2),
            'rto_cost' => round($rtoCost, 2),
            'rto_profit' => round($rtoProfit, 2),
            'rto_payment_received' => round($received, 2),
            'total_business_profit' => round($insuranceProfit + $rtoProfit, 2),
        ]]);
    }

    public function insurance(Request $request)
    {
        $tenant = $this->tenant($request);
        [$from, $to] = $this->dates($request);
        $query = DB::table('vehicle_insurances as i')
            ->leftJoin('vehicles as v', 'v.id', '=', 'i.vehicle_id')
            ->leftJoin('customers as c', 'c.id', '=', 'v.customer_id')
            ->where('i.tenant_id', $tenant)->whereNull('i.deleted_at')
            ->select('i.*', 'v.vehicle_number', 'v.vehicle_type', 'c.first_name', 'c.middle_name', 'c.last_name', 'c.mobile');
        $this->applyDates($query, 'i.issue_date', $from, $to);
        if ($request->filled('company')) $query->where('i.company_name', $request->input('company'));
        if ($request->filled('type')) $query->where('i.insurance_type', $request->input('type'));
        if ($request->filled('search')) {
            $s = '%'.$request->input('search').'%';
            $query->where(fn($q) => $q->where('i.policy_number', 'ilike', $s)->orWhere('v.vehicle_number', 'ilike', $s)->orWhere('c.mobile', 'ilike', $s));
        }
        $rows = $query->orderByDesc('i.issue_date')->get()->map(function ($r) {
            $gross = (float) $r->gross_commission;
            $agent = (float) $r->agent_commission;
            $discount = (float) $r->customer_discount;
            return [
                'id' => $r->id, 'date' => $r->issue_date, 'policy_number' => $r->policy_number,
                'vehicle_number' => $r->vehicle_number, 'vehicle_type' => $r->vehicle_type,
                'customer_name' => $this->customerName($r), 'mobile' => $r->mobile,
                'company_name' => $r->company_name, 'purchase_from' => $r->purchase_from,
                'insurance_type' => $r->insurance_type, 'gross_premium' => (float) $r->gross_premium,
                'customer_pay' => (float) $r->customer_pay, 'gross_commission' => $gross,
                'agent_commission' => $agent, 'customer_discount' => $discount,
                'net_commission' => round($gross - $agent - $discount, 2), 'status' => $r->status,
            ];
        });
        return response()->json(['success' => true, 'data' => [
            'rows' => $rows,
            'summary' => [
                'count' => $rows->count(), 'gross_premium' => round($rows->sum('gross_premium'), 2),
                'customer_pay' => round($rows->sum('customer_pay'), 2),
                'gross_commission' => round($rows->sum('gross_commission'), 2),
                'agent_commission' => round($rows->sum('agent_commission'), 2),
                'discount' => round($rows->sum('customer_discount'), 2),
                'net_commission' => round($rows->sum('net_commission'), 2),
            ],
        ]]);
    }

    public function insuranceCommission(Request $request)
    {
        $payload = $this->insurance($request)->getData(true)['data'];
        $rows = collect($payload['rows']);
        $groups = $rows->groupBy(fn($r) => ($r['company_name'] ?: 'Unknown').' | '.($r['purchase_from'] ?: 'Direct'))
            ->map(function ($items, $key) {
                [$company, $source] = array_pad(explode(' | ', $key, 2), 2, '');
                return [
                    'company_name' => $company, 'purchase_from' => $source, 'policy_count' => $items->count(),
                    'gross_premium' => round($items->sum('gross_premium'), 2),
                    'gross_commission' => round($items->sum('gross_commission'), 2),
                    'agent_commission' => round($items->sum('agent_commission'), 2),
                    'discount' => round($items->sum('customer_discount'), 2),
                    'net_commission' => round($items->sum('net_commission'), 2),
                ];
            })->values()->sortByDesc('net_commission')->values();
        return response()->json(['success' => true, 'data' => ['rows' => $groups, 'summary' => $payload['summary']]]);
    }

    public function rtoWork(Request $request)
    {
        $tenant = $this->tenant($request);
        [$from, $to] = $this->dates($request);
        $rows = $this->rtoRows($tenant, $from, $to);
        if ($request->filled('module')) $rows = $rows->where('module', $request->input('module'))->values();
        if ($request->filled('work_type')) $rows = $rows->where('work_type', $request->input('work_type'))->values();
        if ($request->filled('search')) {
            $s = mb_strtolower($request->input('search'));
            $rows = $rows->filter(fn($r) => str_contains(mb_strtolower(($r['vehicle_number'] ?? '').' '.($r['customer_name'] ?? '').' '.($r['work_type'] ?? '')), $s))->values();
        }
        $category = $rows->groupBy('module')->map(fn($items, $module) => [
            'module' => $module, 'work_count' => $items->count(), 'billing' => round($items->sum('billed'),2),
            'cost' => round($items->sum('cost'),2), 'profit' => round($items->sum('profit'),2),
        ])->values()->sortByDesc('billing')->values();

        $payments = DB::table('vehicle_payments')->where('tenant_id', $tenant)->whereNull('deleted_at');
        $this->applyDates($payments, 'created_at', $from, $to);
        return response()->json(['success' => true, 'data' => [
            'rows' => $rows, 'categories' => $category,
            'summary' => ['work_count' => $rows->count(), 'billing' => round($rows->sum('billed'),2), 'cost' => round($rows->sum('cost'),2), 'profit' => round($rows->sum('profit'),2), 'payment_received' => round((float)$payments->sum('paid_amount'),2), 'payment_billed' => round((float)$payments->sum('billed_amount'),2)],
        ]]);
    }

    public function rtoProfit(Request $request)
    {
        $payload = $this->rtoWork($request)->getData(true)['data'];
        return response()->json(['success' => true, 'data' => ['rows' => $payload['categories'], 'summary' => $payload['summary']]]);
    }

    private function rtoRows(string $tenant, ?string $from, ?string $to): Collection
    {
        $out = collect();
        $configs = [
            ['vehicle_rto_processes','RTO Process','process_date'],
            ['vehicle_pucs','PUC','issue_date'],
            ['vehicle_fitnesses','Fitness','issue_date'],
            ['vehicle_permits','Permit','issue_date'],
            ['vehicle_taxes','Tax','issue_date'],
            ['vehicle_counter_taxes','Counter Tax','issue_date'],
            ['vehicle_hsrp_records','HSRP','order_date'],
            ['vehicle_sld_records','SLD','fitment_date'],
            ['vehicle_transfer_processes','Transfer Process','application_date'],
        ];
        foreach ($configs as [$table,$module,$dateColumn]) {
            if (!DB::getSchemaBuilder()->hasTable($table)) continue;
            $q = $this->vehicleBase($table, $tenant);
            $this->applyDates($q, 'x.'.$dateColumn, $from, $to);
            foreach ($q->get() as $r) {
                $amount = (float) ($r->amount ?? 0);
                $party = (float) ($r->party_amount ?? 0);
                $billed = $party > 0 ? $party : $amount;
                $cost = $party > 0 ? $amount : 0;
                if ($module === 'RTO Process') { $billed = $amount; $cost = (float) ($r->agent_amount ?? 0); }
                if ($module === 'HSRP') { $billed = $party > 0 ? $party : $amount; $cost = (float) ($r->dealer_amount ?? 0); }
                if ($module === 'PUC' && $party > 0) $cost = $amount;
                $workType = $r->work_type ?? $r->permit_type ?? $r->period ?? $module;
                $out->push([
                    'id' => $r->id, 'module' => $module, 'work_type' => $workType ?: $module,
                    'date' => $r->{$dateColumn} ?? $r->created_at, 'vehicle_number' => $r->vehicle_number,
                    'vehicle_type' => $r->vehicle_type, 'vehicle_class' => $r->vehicle_class,
                    'customer_name' => $this->customerName($r), 'mobile' => $r->mobile,
                    'reference_number' => $r->reference_number ?? null, 'status' => $r->status ?? null,
                    'billed' => round($billed,2), 'cost' => round($cost,2), 'profit' => round($billed-$cost,2),
                ]);
            }
        }
        return $out->sortByDesc('date')->values();
    }
}
