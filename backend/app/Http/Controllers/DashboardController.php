<?php

namespace App\Http\Controllers;

use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class DashboardController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'period' => ['sometimes', Rule::in(['today', 'yesterday', 'this_week', 'this_month', 'last_month', 'this_year', 'custom', 'all_time'])],
            'date_from' => ['nullable', 'date_format:Y-m-d', 'required_if:period,custom'],
            'date_to' => ['nullable', 'date_format:Y-m-d', 'required_if:period,custom', 'after_or_equal:date_from'],
        ]);
        $tenant = (string) $request->user()->tenant_id;
        $timezone = config('app.timezone', 'Asia/Kolkata');
        $now = CarbonImmutable::now($timezone);
        [$period, $from, $to] = $this->period($validated, $now);
        [$previousFrom, $previousTo] = $this->previousPeriod($from, $to);

        $scoped = fn (string $table) => DB::table($table)->where("{$table}.tenant_id", $tenant)
            ->when(Schema::hasColumn($table, 'deleted_at'), fn ($query) => $query->whereNull("{$table}.deleted_at"));
        $comparison = fn (float|int $current, float|int $previous) => $previous > 0
            ? round((($current - $previous) / $previous) * 100, 1)
            : null;
        $dateTimePeriod = fn (Builder $query, string $column) => $this->dateTimeRange($query, $column, $from, $to);
        $datePeriod = fn (Builder $query, string $column) => $this->dateRange($query, $column, $from, $to);
        $previousDateTimePeriod = fn (Builder $query, string $column) => $this->dateTimeRange($query, $column, $previousFrom, $previousTo);
        $previousDatePeriod = fn (Builder $query, string $column) => $this->dateRange($query, $column, $previousFrom, $previousTo);

        $customers = $scoped('customers');
        $vehicles = $scoped('vehicles')->whereNull('vehicles.archived_at');
        $policies = $scoped('vehicle_insurances')->whereNull('vehicle_insurances.archived_at');
        $validPolicies = fn () => (clone $policies)
            ->where(fn ($query) => $query->whereNull('status')->orWhere('status', '!=', 'cancelled'));
        $vouchers = $scoped('accounting_vouchers')->where('accounting_vouchers.status', 'posted')
            ->whereNotExists(fn ($query) => $query->selectRaw('1')->from('accounting_vouchers as reversals')
                ->whereColumn('reversals.reversal_of_id', 'accounting_vouchers.id')
                ->where('reversals.status', 'posted')->whereNull('reversals.deleted_at'));

        $newPolicies = $dateTimePeriod($validPolicies(), 'vehicle_insurances.created_at')->count();
        $previousPolicies = $previousDateTimePeriod($validPolicies(), 'vehicle_insurances.created_at')->count();
        $received = round((float) $datePeriod((clone $vouchers)->where('voucher_type', 'receipt'), 'voucher_date')->sum('total_credit'), 2);
        $previousReceived = round((float) $previousDatePeriod((clone $vouchers)->where('voucher_type', 'receipt'), 'voucher_date')->sum('total_credit'), 2);
        $expenses = round((float) $datePeriod((clone $vouchers)->where('voucher_type', 'payment'), 'voucher_date')->sum('total_debit'), 2);
        $previousExpenses = round((float) $previousDatePeriod((clone $vouchers)->where('voucher_type', 'payment'), 'voucher_date')->sum('total_debit'), 2);
        $commissionRevenue = round((float) $dateTimePeriod($validPolicies(), 'vehicle_insurances.created_at')->sum('gross_commission'), 2);
        $previousCommissionRevenue = round((float) $previousDateTimePeriod($validPolicies(), 'vehicle_insurances.created_at')->sum('gross_commission'), 2);
        $customerPay = DB::raw('COALESCE(vehicle_insurances.customer_pay, vehicle_insurances.gross_premium, 0)');
        $policyRevenue = round((float) $dateTimePeriod($validPolicies(), 'vehicle_insurances.created_at')->sum($customerPay), 2);
        $previousPolicyRevenue = round((float) $previousDateTimePeriod($validPolicies(), 'vehicle_insurances.created_at')->sum($customerPay), 2);
        $agentCommission = round((float) $dateTimePeriod($validPolicies(), 'vehicle_insurances.created_at')->sum('agent_commission'), 2);
        $tds = round((float) $datePeriod(
            $scoped('insurance_commissions')->whereNotIn('status', ['cancelled', 'reversed', 'void']),
            'statement_date'
        )->sum('tds_amount'), 2);
        $otherPolicyCost = round((float) $dateTimePeriod($validPolicies(), 'vehicle_insurances.created_at')->sum('other_charges'), 2);
        $companyCost = round($tds + $otherPolicyCost, 2);
        $grossProfit = round($commissionRevenue - $companyCost - $agentCommission, 2);
        $netProfit = round($grossProfit - $expenses, 2);
        $outstanding = round((float) $dateTimePeriod((clone $vehicles), 'vehicles.created_at')->sum('payment_due'), 2);
        $activePolicies = (clone $policies)->whereDate('expiry_date', '>=', $now->toDateString())
            ->where(fn ($query) => $query->whereNull('status')->orWhereNotIn('status', ['cancelled', 'expired']))->count();
        $expiring = $datePeriod($validPolicies(), 'expiry_date')->count();
        $renewals = $datePeriod((clone $policies)->where('status', 'renewed'), 'expiry_date')->count();

        $trend = collect([[
            'month' => $period === 'today' ? 'Today' : ($period === 'all_time' ? 'All time' : $from?->format('d M').' – '.$to->format('d M')),
            'revenue' => $policyRevenue,
            'expenses' => $expenses,
        ]]);
        $byVehicle = fn (array $types) => $dateTimePeriod(DB::table('vehicle_insurances')
            ->join('vehicles', 'vehicles.id', '=', 'vehicle_insurances.vehicle_id')
            ->where('vehicle_insurances.tenant_id', $tenant)
            ->whereNull('vehicle_insurances.deleted_at')->whereNull('vehicle_insurances.archived_at')->whereNull('vehicles.deleted_at')
            ->where(fn ($query) => $query->whereNull('vehicle_insurances.status')->orWhere('vehicle_insurances.status', '!=', 'cancelled'))
            ->whereIn('vehicles.vehicle_type', $types), 'vehicle_insurances.created_at')->count();
        $periodPolicies = fn () => $dateTimePeriod($validPolicies(), 'vehicle_insurances.created_at');
        $masterCounts = $this->masterCounts($tenant);

        return response()->json(['success' => true, 'data' => [
            'period' => ['key' => $period, 'from' => $from?->toDateString(), 'to' => $to->toDateString(), 'timezone' => $timezone],
            'kpis' => [
                'customers' => ['value' => (clone $customers)->count(), 'growth' => null],
                'vehicles' => ['value' => (clone $vehicles)->count(), 'growth' => null],
                'policies' => ['value' => $newPolicies, 'growth' => $comparison($newPolicies, $previousPolicies)],
                'active_policies' => ['value' => $activePolicies, 'growth' => $comparison($newPolicies, $previousPolicies)],
                'expiring_policies' => ['value' => $expiring, 'growth' => null],
                'payments_received' => ['value' => $received, 'growth' => $comparison($received, $previousReceived)],
                'outstanding_amount' => ['value' => $outstanding, 'growth' => null],
                'revenue' => ['value' => $policyRevenue, 'growth' => $comparison($policyRevenue, $previousPolicyRevenue)],
                'gross_commission' => ['value' => $commissionRevenue, 'growth' => $comparison($commissionRevenue, $previousCommissionRevenue)],
                'company_cost' => ['value' => $companyCost, 'growth' => null],
                'gross_profit' => ['value' => $grossProfit, 'growth' => null],
                'monthly_revenue' => ['value' => $commissionRevenue, 'growth' => $comparison($commissionRevenue, $previousCommissionRevenue)],
                'tds' => ['value' => $tds, 'growth' => null],
                'agent_commission' => ['value' => $agentCommission, 'growth' => null],
                'expenses' => ['value' => $expenses, 'growth' => $comparison($expenses, $previousExpenses)],
                'monthly_expenses' => ['value' => $expenses, 'growth' => $comparison($expenses, $previousExpenses)],
                'net_result' => ['value' => $netProfit, 'growth' => null],
                'renewal_count' => ['value' => $renewals, 'growth' => null],
            ],
            'revenue' => ['current' => $policyRevenue, 'previous' => $previousPolicyRevenue, 'gross_commission' => $commissionRevenue, 'company_cost' => $companyCost, 'gross_profit' => $grossProfit, 'tds' => $tds, 'agent_commission' => $agentCommission, 'expenses' => $expenses, 'net_result' => $netProfit, 'outstanding' => $outstanding, 'trend' => $trend],
            'policies' => ['new' => $newPolicies, 'renewals' => $renewals, 'comprehensive' => $periodPolicies()->whereIn('insurance_type', ['comprehensive', 'package'])->count(), 'third_party' => $periodPolicies()->whereIn('insurance_type', ['third_party', 'standalone_tp'])->count(), 'two_wheeler' => $byVehicle(['two_wheeler']), 'private_car' => $byVehicle(['private_car']), 'commercial' => $byVehicle(['lgv', 'hgv', 'taxi'])],
            'renewals' => ['7' => (clone $policies)->whereBetween('expiry_date', [$now->toDateString(), $now->addDays(7)->toDateString()])->count(), '15' => (clone $policies)->whereBetween('expiry_date', [$now->toDateString(), $now->addDays(15)->toDateString()])->count(), '30' => (clone $policies)->whereBetween('expiry_date', [$now->toDateString(), $now->addDays(30)->toDateString()])->count(), 'expired' => (clone $policies)->whereDate('expiry_date', '<', $now->toDateString())->count(), 'renewed' => $renewals],
            'work' => ['puc_due' => (clone $vehicles)->whereIn('puc_status', ['not_added', 'due', 'expired'])->count(), 'fitness_due' => (clone $vehicles)->whereIn('fitness_status', ['not_added', 'due', 'expired'])->count(), 'permit_due' => (clone $vehicles)->whereIn('permit_status', ['not_added', 'due', 'expired'])->count(), 'payment_follow_up' => (clone $vehicles)->where('payment_due', '>', 0)->count()],
            'master_counts' => $masterCounts,
        ]])->header('Cache-Control', 'private, no-store, no-cache, must-revalidate')
            ->header('Pragma', 'no-cache')->header('Expires', '0');
    }

    private function period(array $input, CarbonImmutable $now): array
    {
        $period = $input['period'] ?? 'today';
        return match ($period) {
            'yesterday' => [$period, $now->subDay()->startOfDay(), $now->subDay()->endOfDay()],
            'this_week' => [$period, $now->startOfWeek(), $now->endOfDay()],
            'this_month' => [$period, $now->startOfMonth(), $now->endOfDay()],
            'last_month' => [$period, $now->subMonthNoOverflow()->startOfMonth(), $now->subMonthNoOverflow()->endOfMonth()],
            'this_year' => [$period, $now->startOfYear(), $now->endOfDay()],
            'custom' => [$period, CarbonImmutable::parse($input['date_from'], $now->timezone)->startOfDay(), CarbonImmutable::parse($input['date_to'], $now->timezone)->endOfDay()],
            'all_time' => [$period, null, $now->endOfDay()],
            default => ['today', $now->startOfDay(), $now->endOfDay()],
        };
    }

    private function previousPeriod(?CarbonImmutable $from, CarbonImmutable $to): array
    {
        if (! $from) return [null, null];
        $duration = $to->diffInSeconds($from) + 1;
        return [$from->subSeconds($duration), $from->subSecond()];
    }

    private function dateTimeRange(Builder $query, string $column, ?CarbonImmutable $from, ?CarbonImmutable $to): Builder
    {
        if (! $from || ! $to) return $query;
        return $query->whereBetween($column, [$from->utc(), $to->utc()]);
    }

    private function dateRange(Builder $query, string $column, ?CarbonImmutable $from, ?CarbonImmutable $to): Builder
    {
        if (! $from || ! $to) return $query;
        return $query->whereBetween($column, [$from->toDateString(), $to->toDateString()]);
    }

    private function masterCounts(string $tenant): array
    {
        $counts = [];
        foreach (['manufacturers', 'models', 'variants', 'colours', 'vehicle_types', 'vehicle_classes', 'body_types', 'fuel_types', 'rto_offices'] as $type) {
            $query = DB::table('vehicle_masters')->where('tenant_id', $tenant)->where('type', $type)->whereNull('deleted_at');
            $counts[$type] = ['total' => (clone $query)->count(), 'active' => (clone $query)->where('status', 'active')->count()];
        }
        foreach (['insurance_companies' => 'status', 'insurance_purchase_sources' => 'is_active', 'ledgers' => 'status'] as $table => $statusColumn) {
            $query = DB::table($table)->where('tenant_id', $tenant)->whereNull('deleted_at');
            $counts[$table] = [
                'total' => (clone $query)->count(),
                'active' => $statusColumn === 'is_active'
                    ? (clone $query)->where($statusColumn, true)->count()
                    : (clone $query)->where($statusColumn, 'active')->count(),
            ];
        }
        return $counts;
    }
}
