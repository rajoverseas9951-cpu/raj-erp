<?php

namespace App\Features\Vehicles\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PolicyController
{
    public function show(Request $request, string $policy): JsonResponse
    {
        abort_unless($request->user()?->can('vehicle.view'), 403);
        $record = $this->base((string) $request->user()->tenant_id)->where('vehicle_insurances.id', $policy)->first();
        abort_unless($record, 404);
        return response()->json(['success' => true, 'data' => $record])->header('Cache-Control', 'private, no-store');
    }

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('vehicle.view'), 403);
        $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:200'],
            'status' => ['sometimes', 'nullable', 'in:draft,running,pending,expired,cancelled,archived'],
            'from' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'per_page' => ['sometimes', 'integer', 'min:5', 'max:100'],
        ]);
        $tenant = (string) $request->user()->tenant_id;
        $query = $this->base($tenant);
        if (! $request->filled('status')) $query->whereNull('vehicle_insurances.archived_at');
        if ($search = trim((string) $request->query('search'))) {
            $term = '%'.strtolower($search).'%';
            $query->where(fn ($builder) => $builder
                ->whereRaw('LOWER(vehicle_insurances.policy_number) LIKE ?', [$term])
                ->orWhereRaw('LOWER(vehicle_insurances.company_name) LIKE ?', [$term])
                ->orWhereRaw('LOWER(vehicles.vehicle_number) LIKE ?', [$term])
                ->orWhereRaw("LOWER(COALESCE(customers.first_name, '') || ' ' || COALESCE(customers.last_name, '')) LIKE ?", [$term]));
        }
        if ($request->filled('status')) {
            if ($request->query('status') === 'archived') $query->whereNotNull('vehicle_insurances.archived_at');
            else $query->where('vehicle_insurances.status', $request->query('status'));
        }
        if ($request->filled('from')) $query->whereDate('vehicle_insurances.issue_date', '>=', $request->query('from'));
        if ($request->filled('to')) $query->whereDate('vehicle_insurances.issue_date', '<=', $request->query('to'));
        $page = $query->orderByDesc('vehicle_insurances.issue_date')->orderByDesc('vehicle_insurances.created_at')
            ->paginate((int) $request->query('per_page', 20));
        return response()->json(['success' => true, 'data' => $page])
            ->header('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    }

    public function summary(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('reports.view'), 403);
        $tenant = (string) $request->user()->tenant_id;
        $policies = DB::table('vehicle_insurances')->where('tenant_id', $tenant)->whereNull('deleted_at')->whereNull('archived_at')
            ->where(fn ($query) => $query->whereNull('status')->orWhere('status', '!=', 'cancelled'));
        $commissions = DB::table('insurance_commissions')->join('vehicle_insurances', function ($join) use ($tenant) {
            $join->on('vehicle_insurances.id', '=', 'insurance_commissions.policy_id')->where('vehicle_insurances.tenant_id', '=', $tenant);
        })->where('insurance_commissions.tenant_id', $tenant)->whereNull('insurance_commissions.deleted_at')
            ->whereNull('vehicle_insurances.deleted_at')->whereNull('vehicle_insurances.archived_at')
            ->whereNotIn('insurance_commissions.status', ['cancelled', 'reversed', 'void'])
            ->where('vehicle_insurances.status', '!=', 'cancelled');
        return response()->json(['success' => true, 'data' => [
            'policy_count' => (clone $policies)->count(),
            'gross_premium' => round((float) (clone $policies)->sum('gross_premium'), 2),
            'gross_commission' => round((float) (clone $policies)->sum('gross_commission'), 2),
            'agent_commission' => round((float) (clone $policies)->sum('agent_commission'), 2),
            'tds' => round((float) (clone $commissions)->sum('insurance_commissions.tds_amount'), 2),
            'commission_received' => round((float) (clone $commissions)->sum('insurance_commissions.received_amount'), 2),
            'commission_outstanding' => round((float) (clone $commissions)->sum(DB::raw('insurance_commissions.net_receivable - insurance_commissions.received_amount')), 2),
        ]])->header('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    }

    private function base(string $tenant)
    {
        return DB::table('vehicle_insurances')
            ->join('vehicles', function ($join) use ($tenant) {
                $join->on('vehicles.id', '=', 'vehicle_insurances.vehicle_id')->where('vehicles.tenant_id', '=', $tenant);
            })
            ->leftJoin('customers', function ($join) use ($tenant) {
                $join->on('customers.id', '=', 'vehicles.customer_id')->where('customers.tenant_id', '=', $tenant);
            })
            ->leftJoin('insurance_commissions', function ($join) use ($tenant) {
                $join->on('insurance_commissions.policy_id', '=', 'vehicle_insurances.id')
                    ->where('insurance_commissions.tenant_id', '=', $tenant)->whereNull('insurance_commissions.deleted_at');
            })
            ->where('vehicle_insurances.tenant_id', $tenant)->whereNull('vehicle_insurances.deleted_at')
            ->whereNull('vehicles.deleted_at')->whereNull('customers.deleted_at')
            ->select('vehicle_insurances.*', 'vehicles.vehicle_number', 'customers.first_name', 'customers.last_name',
                'insurance_commissions.tds_amount', 'insurance_commissions.net_receivable', 'insurance_commissions.received_amount');
    }
}
