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
            'period' => ['sometimes', Rule::in(['today', 'yesterday', 'this_week', 'this_month', 'last_month', 'custom', 'all_time'])],
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
        $vehicles = $scoped('vehicles');
        $policies = $scoped('vehicle_insurances');
        $validPolicies = fn () => (clone $policies)
            ->where(fn ($query) => $query->whereNull('status')->orWhere('status', '!=', 'cancelled'));
        $vouchers = $scoped('accounting_vouchers')->where('accounting_vouchers.status', 'posted');

        $newPolicies = $dateTimePeriod($validPolicies(), 'vehicle_insurances.created_at')->count();
        $previousPolicies = $previousDateTimePeriod($validPolicies(), 'vehicle_insurances.created_at')->count();
        $received = round((float) $datePeriod((clone $vouchers)->where('voucher_type', 'receipt'), 'voucher_date')->sum('total_credit'), 2);
        $previousReceived = round((float) $previousDatePeriod((clone $vouchers)->where('voucher_type', 'receipt'), 'voucher_date')->sum('total_credit'), 2);
        $expenses = round((float) $datePeriod((clone $vouchers)->where('voucher_type', 'payment'), 'voucher_date')->sum('total_debit'), 2);
        $previousExpenses = round((float) $previousDatePeriod((clone $vouchers)->where('voucher_type', 'payment'), 'voucher_date')->sum('total_debit'), 2);
        $commissionRevenue = round((float) $dateTimePeriod($validPolicies(), 'vehicle_insurances.created_at')->sum('gross_commission'), 2);
        $previousCommissionRevenue = round((float) $previousDateTimePeriod($validPolicies(), 'vehicle_insurances.created_at')->sum('gross_commission'), 2);
        $agentCommission = round((float) $dateTimePeriod($validPolicies(), 'vehicle_insurances.created_at')->sum('agent_commission'), 2);
        $netProfit = round($commissionRevenue - $agentCommission - $expenses, 2);
        $outstanding = (float) (clone $vehicles)->sum('payment_due');
        $activePolicies = (clone $policies)->whereDate('expiry_date', '>=', $now->toDateString())
            ->where(fn ($query) => $query->whereNull('status')->orWhereNotIn('status', ['cancelled', 'expired']))->count();
        $expiring = $datePeriod($validPolicies(), 'expiry_date')->count();
        $renewals = $datePeriod((clone $policies)->where('status', 'renewed'), 'expiry_date')->count();

        $trend = collect([[
            'month' => $period === 'today' ? 'Today' : ($period === 'all_time' ? 'All time' : $from?->format('d M').' – '.$to->format('d M')),
            'revenue' => $commissionRevenue,
            'expenses' => $expenses,
        ]]);
        $byVehicle = fn (array $types) => DB::table('vehicle_insurances')
            ->join('vehicles', 'vehicles.id', '=', 'vehicle_insurances.vehicle_id')
            ->where('vehicle_insurances.tenant_id', $tenant)
            ->whereNull('vehicle_insurances.deleted_at')->whereNull('vehicles.deleted_at')
            ->whereIn('vehicles.vehicle_type', $types)->count();

        return response()->json(['success' => true, 'data' => [
            'period' => ['key' => $period, 'from' => $from?->toDateString(), 'to' => $to->toDateString(), 'timezone' => $timezone],
            'kpis' => [
                'customers' => ['value' => (clone $customers)->count(), 'growth' => null],
                'vehicles' => ['value' => (clone $vehicles)->count(), 'growth' => null],
                'active_policies' => ['value' => $activePolicies, 'growth' => $comparison($newPolicies, $previousPolicies)],
                'expiring_policies' => ['value' => $expiring, 'growth' => null],
                'payments_received' => ['value' => $received, 'growth' => $comparison($received, $previousReceived)],
                'outstanding_amount' => ['value' => $outstanding, 'growth' => null],
                'monthly_revenue' => ['value' => $commissionRevenue, 'growth' => $comparison($commissionRevenue, $previousCommissionRevenue)],
                'agent_commission' => ['value' => $agentCommission, 'growth' => null],
                'monthly_expenses' => ['value' => $expenses, 'growth' => $comparison($expenses, $previousExpenses)],
                'net_result' => ['value' => $netProfit, 'growth' => null],
                'renewal_count' => ['value' => $renewals, 'growth' => null],
            ],
            'revenue' => ['current' => $commissionRevenue, 'previous' => $previousCommissionRevenue, 'agent_commission' => $agentCommission, 'expenses' => $expenses, 'net_result' => $netProfit, 'outstanding' => $outstanding, 'trend' => $trend],
            'policies' => ['new' => $newPolicies, 'renewals' => $renewals, 'comprehensive' => (clone $policies)->whereIn('insurance_type', ['comprehensive', 'package'])->count(), 'third_party' => (clone $policies)->whereIn('insurance_type', ['third_party', 'standalone_tp'])->count(), 'two_wheeler' => $byVehicle(['two_wheeler']), 'private_car' => $byVehicle(['private_car']), 'commercial' => $byVehicle(['lgv', 'hgv', 'taxi'])],
            'renewals' => ['7' => (clone $policies)->whereBetween('expiry_date', [$now->toDateString(), $now->addDays(7)->toDateString()])->count(), '15' => (clone $policies)->whereBetween('expiry_date', [$now->toDateString(), $now->addDays(15)->toDateString()])->count(), '30' => (clone $policies)->whereBetween('expiry_date', [$now->toDateString(), $now->addDays(30)->toDateString()])->count(), 'expired' => (clone $policies)->whereDate('expiry_date', '<', $now->toDateString())->count(), 'renewed' => $renewals],
            'work' => ['puc_due' => (clone $vehicles)->whereIn('puc_status', ['not_added', 'due', 'expired'])->count(), 'fitness_due' => (clone $vehicles)->whereIn('fitness_status', ['not_added', 'due', 'expired'])->count(), 'permit_due' => (clone $vehicles)->whereIn('permit_status', ['not_added', 'due', 'expired'])->count(), 'payment_follow_up' => (clone $vehicles)->where('payment_due', '>', 0)->count()],
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
}
