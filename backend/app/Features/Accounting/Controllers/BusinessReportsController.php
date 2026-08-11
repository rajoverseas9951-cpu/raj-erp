<?php

namespace App\Features\Accounting\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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
                'agent' => $r->agent, 'agent_commission' => $agent, 'customer_discount' => $discount,
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

    public function insuranceDue(Request $request)
    {
        $payload = $this->insurance($request)->getData(true)['data'];
        $tenant = $this->tenant($request);
        $raw = DB::table('vehicle_insurances')->where('tenant_id', $tenant)->whereNull('deleted_at')->pluck('payment_details', 'id');
        $rows = collect($payload['rows'])->map(function ($row) use ($raw) {
            $details = $raw->get($row['id']);
            if (is_string($details)) $details = json_decode($details, true) ?: [];
            if (is_object($details)) $details = (array) $details;
            $details = is_array($details) ? $details : [];
            $paid = (float) ($details['paid_amount'] ?? $details['received_amount'] ?? $details['amount_paid'] ?? $details['received'] ?? 0);
            $due = max(0, (float) $row['customer_pay'] - $paid);
            return array_merge($row, ['paid_amount' => round($paid, 2), 'due_amount' => round($due, 2)]);
        })->filter(fn($row) => $row['due_amount'] > 0)->values();
        return response()->json(['success' => true, 'data' => ['rows' => $rows, 'summary' => [
            'policy_count' => $rows->count(), 'total_payable' => round($rows->sum('customer_pay'), 2),
            'received' => round($rows->sum('paid_amount'), 2), 'due' => round($rows->sum('due_amount'), 2),
        ]]]);
    }

    public function expiry(Request $request)
    {
        $tenant = $this->tenant($request);
        $from = $request->input('from') ?: now()->toDateString();
        $to = $request->input('to') ?: now()->addDays(60)->toDateString();
        $types = [
            'insurance_expiry' => 'Insurance', 'puc_expiry' => 'PUC', 'fitness_expiry' => 'Fitness',
            'permit_expiry' => 'Permit', 'national_permit_expiry' => 'National Permit', 'tax_expiry' => 'Tax',
            'counter_tax_expiry' => 'Counter Tax',
        ];
        $base = DB::table('vehicles as v')->leftJoin('customers as c', 'c.id', '=', 'v.customer_id')
            ->where('v.tenant_id', $tenant)->whereNull('v.deleted_at')
            ->select('v.*', 'c.first_name', 'c.middle_name', 'c.last_name', 'c.mobile')->get();
        $rows = collect();
        foreach ($base as $v) {
            foreach ($types as $field => $label) {
                if (!property_exists($v, $field) || !$v->{$field}) continue;
                $date = (string) $v->{$field};
                if ($date < $from || $date > $to) continue;
                $days = now()->startOfDay()->diffInDays(\Carbon\Carbon::parse($date), false);
                $rows->push([
                    'vehicle_number' => $v->vehicle_number, 'vehicle_type' => $v->vehicle_type, 'customer_name' => $this->customerName($v),
                    'mobile' => $v->mobile, 'document' => $label, 'expiry_date' => $date, 'days_left' => $days,
                    'status' => $days < 0 ? 'Expired' : ($days <= 15 ? 'Expiring Soon' : 'Valid'),
                ]);
            }
        }
        $rows = $rows->sortBy('expiry_date')->values();
        return response()->json(['success' => true, 'data' => ['rows' => $rows, 'summary' => [
            'total' => $rows->count(), 'expired' => $rows->where('status', 'Expired')->count(),
            'expiring_soon' => $rows->where('status', 'Expiring Soon')->count(), 'valid' => $rows->where('status', 'Valid')->count(),
        ]]]);
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

    public function hsrp(Request $request)
    {
        $tenant = $this->tenant($request);
        [$from, $to] = $this->dates($request);
        $q = $this->vehicleBase('vehicle_hsrp_records', $tenant);
        $this->applyDates($q, 'x.order_date', $from, $to);
        $rows = $q->orderByDesc('x.order_date')->get()->map(fn($r) => [
            'date' => $r->order_date, 'vehicle_number' => $r->vehicle_number, 'customer_name' => $this->customerName($r),
            'mobile' => $r->mobile, 'party_name' => $r->party_name, 'vendor' => $r->vendor,
            'received_date' => $r->received_date, 'delivery_date' => $r->delivery_date,
            'party_amount' => (float) $r->party_amount, 'amount' => (float) $r->amount, 'status' => $r->status,
        ]);
        return response()->json(['success' => true, 'data' => ['rows' => $rows, 'summary' => [
            'count' => $rows->count(), 'billing' => round($rows->sum('party_amount'), 2), 'cost' => round($rows->sum('amount'), 2),
            'profit' => round($rows->sum('party_amount') - $rows->sum('amount'), 2),
        ]]]);
    }

    public function vehicles(Request $request)
    {
        $tenant = $this->tenant($request);
        $q = DB::table('vehicles as v')->leftJoin('customers as c', 'c.id', '=', 'v.customer_id')
            ->where('v.tenant_id', $tenant)->whereNull('v.deleted_at')
            ->select('v.*', 'c.first_name', 'c.middle_name', 'c.last_name', 'c.mobile');
        if ($request->filled('search')) {
            $s = '%'.$request->input('search').'%';
            $q->where(fn($x) => $x->where('v.vehicle_number','ilike',$s)->orWhere('v.vehicle_type','ilike',$s)->orWhere('c.mobile','ilike',$s));
        }
        $rows = $q->orderByDesc('v.created_at')->get()->map(fn($r) => [
            'vehicle_number' => $r->vehicle_number, 'customer_name' => $this->customerName($r), 'mobile' => $r->mobile,
            'vehicle_type' => $r->vehicle_type, 'vehicle_class' => $r->vehicle_class, 'manufacturer' => $r->manufacturer,
            'model' => $r->model, 'fuel_type' => $r->fuel_type, 'registration_date' => $r->registration_date,
            'insurance_status' => $r->insurance_status, 'puc_status' => $r->puc_status, 'fitness_status' => $r->fitness_status,
            'permit_status' => $r->permit_status, 'tax_status' => $r->tax_status,
        ]);
        return response()->json(['success' => true, 'data' => ['rows' => $rows, 'summary' => [
            'vehicle_count' => $rows->count(), 'private' => $rows->filter(fn($r) => str_contains(strtolower((string)$r['vehicle_type']), 'private'))->count(),
            'commercial' => $rows->filter(fn($r) => !str_contains(strtolower((string)$r['vehicle_type']), 'private'))->count(),
        ]]]);
    }

    public function agents(Request $request)
    {
        $tenant = $this->tenant($request);
        [$from, $to] = $this->dates($request);
        $insurance = DB::table('vehicle_insurances')->where('tenant_id',$tenant)->whereNull('deleted_at')->whereNotNull('agent');
        $this->applyDates($insurance, 'issue_date', $from, $to);
        $policyGroups = $insurance->get()->groupBy('agent');
        $rto = $this->rtoRows($tenant, $from, $to)->filter(fn($r) => !empty($r['agent']));
        $names = $policyGroups->keys()->merge($rto->pluck('agent'))->filter()->unique();
        $rows = $names->map(function($name) use($policyGroups,$rto){
            $p = collect($policyGroups->get($name, [])); $w = $rto->where('agent',$name);
            return ['agent' => $name, 'policy_count' => $p->count(), 'insurance_payable' => round((float)$p->sum('agent_commission'),2),
                'rto_work_count' => $w->count(), 'rto_payable' => round($w->sum('cost'),2),
                'total_payable' => round((float)$p->sum('agent_commission') + $w->sum('cost'),2)];
        })->sortByDesc('total_payable')->values();
        return response()->json(['success'=>true,'data'=>['rows'=>$rows,'summary'=>[
            'agent_count'=>$rows->count(),'policy_count'=>$rows->sum('policy_count'),'rto_work_count'=>$rows->sum('rto_work_count'),'total_payable'=>round($rows->sum('total_payable'),2)
        ]]]);
    }

    public function brokers(Request $request)
    {
        $tenant = $this->tenant($request);
        [$from, $to] = $this->dates($request);
        $rows = $this->rtoRows($tenant,$from,$to)->filter(fn($r)=>!empty($r['broker']))
            ->groupBy('broker')->map(fn($items,$broker)=>[
                'broker'=>$broker,'work_count'=>$items->count(),'billing'=>round($items->sum('billed'),2),
                'cost'=>round($items->sum('cost'),2),'profit'=>round($items->sum('profit'),2)
            ])->sortByDesc('work_count')->values();
        return response()->json(['success'=>true,'data'=>['rows'=>$rows,'summary'=>[
            'broker_count'=>$rows->count(),'work_count'=>$rows->sum('work_count'),'billing'=>round($rows->sum('billing'),2),'profit'=>round($rows->sum('profit'),2)
        ]]]);
    }

    public function agentWork(Request $request)
    {
        $tenant = $this->tenant($request);
        [$from, $to] = $this->dates($request);
        $rows = $this->rtoRows($tenant,$from,$to)->filter(fn($r)=>!empty($r['agent']))->values();
        if ($request->filled('agent')) $rows = $rows->where('agent',$request->input('agent'))->values();
        return response()->json(['success'=>true,'data'=>['rows'=>$rows,'summary'=>[
            'work_count'=>$rows->count(),'billing'=>round($rows->sum('billed'),2),'agent_cost'=>round($rows->sum('cost'),2),'profit'=>round($rows->sum('profit'),2)
        ]]]);
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
            if (!Schema::hasTable($table)) continue;
            $q = $this->vehicleBase($table, $tenant);
            $this->applyDates($q, 'x.'.$dateColumn, $from, $to);
            foreach ($q->get() as $r) {
                $amount = (float) ($r->amount ?? 0);
                $party = (float) ($r->party_amount ?? 0);
                $billed = $party > 0 ? $party : $amount;
                $cost = $party > 0 ? $amount : 0;
                if ($module === 'RTO Process') { $billed = $amount; $cost = (float) ($r->agent_amount ?? 0); }
                $workType = $r->work_type ?? $r->permit_type ?? $r->period ?? $module;
                $agent = $r->external_agent ?? $r->assigned_agent ?? null;
                $out->push([
                    'id' => $r->id, 'module' => $module, 'work_type' => $workType ?: $module,
                    'date' => $r->{$dateColumn} ?? $r->created_at, 'vehicle_number' => $r->vehicle_number,
                    'vehicle_type' => $r->vehicle_type, 'vehicle_class' => $r->vehicle_class,
                    'customer_name' => $this->customerName($r), 'mobile' => $r->mobile,
                    'reference_number' => $r->reference_number ?? null, 'status' => $r->status ?? null,
                    'agent' => $agent, 'broker' => $r->broker ?? null,
                    'billed' => round($billed,2), 'cost' => round($cost,2), 'profit' => round($billed-$cost,2),
                ]);
            }
        }
        return $out->sortByDesc('date')->values();
    }
}
