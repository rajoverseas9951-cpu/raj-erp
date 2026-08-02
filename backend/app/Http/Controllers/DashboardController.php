<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DashboardController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $tenant = $request->user()->tenant_id;
        $now = now();
        $monthStart = $now->copy()->startOfMonth();
        $previousStart = $monthStart->copy()->subMonth();
        $scoped = fn (string $table) => DB::table($table)->where("{$table}.tenant_id", $tenant)
            ->when(Schema::hasColumn($table, 'deleted_at'), fn ($query) => $query->whereNull("{$table}.deleted_at"));
        $comparison = fn (float|int $current, float|int $previous) => $previous > 0
            ? round((($current - $previous) / $previous) * 100, 1)
            : null;
        $periodCount = function (string $table) use ($scoped, $monthStart, $previousStart, $comparison): array {
            $current = (clone $scoped($table))->where("{$table}.created_at", '>=', $monthStart)->count();
            $previous = (clone $scoped($table))->whereBetween("{$table}.created_at", [$previousStart, $monthStart])->count();
            return [$current, $comparison($current, $previous)];
        };

        $customers = $scoped('customers');
        $vehicles = $scoped('vehicles');
        $policies = $scoped('vehicle_insurances');
        [$newPolicies, $policyGrowth] = $periodCount('vehicle_insurances');
        [, $customerGrowth] = $periodCount('customers');
        [, $vehicleGrowth] = $periodCount('vehicles');

        $vouchers = $scoped('accounting_vouchers')->where('accounting_vouchers.status', 'posted');
        $received = (float) (clone $vouchers)->where('voucher_type', 'receipt')->whereBetween('voucher_date', [$monthStart, $now])->sum('total_credit');
        $previousReceived = (float) (clone $vouchers)->where('voucher_type', 'receipt')->whereBetween('voucher_date', [$previousStart, $monthStart])->sum('total_credit');
        $expenses = (float) (clone $vouchers)->where('voucher_type', 'payment')->whereBetween('voucher_date', [$monthStart, $now])->sum('total_debit');
        $previousExpenses = (float) (clone $vouchers)->where('voucher_type', 'payment')->whereBetween('voucher_date', [$previousStart, $monthStart])->sum('total_debit');
        $commissionRevenue = (float) (clone $policies)->where('vehicle_insurances.created_at', '>=', $monthStart)
            ->where(fn ($query) => $query->whereNull('status')->orWhere('status', '!=', 'cancelled'))->sum('gross_commission');
        $previousCommissionRevenue = (float) (clone $policies)->where('vehicle_insurances.created_at', '>=', $previousStart)
            ->where('vehicle_insurances.created_at', '<', $monthStart)
            ->where(fn ($query) => $query->whereNull('status')->orWhere('status', '!=', 'cancelled'))->sum('gross_commission');
        $outstanding = (float) (clone $vehicles)->sum('payment_due');
        $activePolicies = (clone $policies)->whereDate('expiry_date', '>=', $now->toDateString())->whereNotIn('status', ['cancelled', 'expired'])->count();
        $expiring = (clone $policies)->whereBetween('expiry_date', [$now->toDateString(), $now->copy()->addDays(30)->toDateString()])->count();
        $renewals = (clone $policies)->where('created_at', '>=', $monthStart)->where('status', 'renewed')->count();

        $trend = collect(range(5, 0))->map(function ($ago) use ($policies, $vouchers, $now) {
            $from = $now->copy()->subMonths($ago)->startOfMonth();
            $to = $from->copy()->endOfMonth();
            return [
                'month' => $from->format('M'),
                'revenue' => (float) (clone $policies)->where(fn ($query) => $query->whereNull('status')->orWhere('status', '!=', 'cancelled'))->whereBetween('vehicle_insurances.created_at', [$from, $to])->sum('gross_commission'),
                'expenses' => (float) (clone $vouchers)->where('voucher_type', 'payment')->whereBetween('voucher_date', [$from, $to])->sum('total_debit'),
            ];
        })->filter(fn ($row) => $row['revenue'] > 0 || $row['expenses'] > 0)->values();

        $byVehicle = fn (array $types) => DB::table('vehicle_insurances')
            ->join('vehicles', 'vehicles.id', '=', 'vehicle_insurances.vehicle_id')
            ->where('vehicle_insurances.tenant_id', $tenant)
            ->whereNull('vehicle_insurances.deleted_at')->whereNull('vehicles.deleted_at')
            ->whereIn('vehicles.vehicle_type', $types)->count();

        return response()->json(['success' => true, 'data' => [
            'kpis' => [
                'customers' => ['value' => (clone $customers)->count(), 'growth' => $customerGrowth],
                'vehicles' => ['value' => (clone $vehicles)->count(), 'growth' => $vehicleGrowth],
                'active_policies' => ['value' => $activePolicies, 'growth' => $policyGrowth],
                'expiring_policies' => ['value' => $expiring, 'growth' => null],
                'payments_received' => ['value' => $received, 'growth' => $comparison($received, $previousReceived)],
                'outstanding_amount' => ['value' => $outstanding, 'growth' => null],
                'monthly_revenue' => ['value' => $commissionRevenue, 'growth' => $comparison($commissionRevenue, $previousCommissionRevenue)],
                'monthly_expenses' => ['value' => $expenses, 'growth' => $comparison($expenses, $previousExpenses)],
                'net_result' => ['value' => $commissionRevenue - $expenses, 'growth' => null],
                'renewal_count' => ['value' => $renewals, 'growth' => null],
            ],
            'revenue' => ['current' => $commissionRevenue, 'previous' => $previousCommissionRevenue, 'expenses' => $expenses, 'net_result' => $commissionRevenue - $expenses, 'outstanding' => $outstanding, 'trend' => $trend],
            'policies' => ['new' => $newPolicies, 'renewals' => $renewals, 'comprehensive' => (clone $policies)->whereIn('insurance_type', ['comprehensive', 'package'])->count(), 'third_party' => (clone $policies)->whereIn('insurance_type', ['third_party', 'standalone_tp'])->count(), 'two_wheeler' => $byVehicle(['two_wheeler']), 'private_car' => $byVehicle(['private_car']), 'commercial' => $byVehicle(['lgv', 'hgv', 'taxi'])],
            'renewals' => ['7' => (clone $policies)->whereBetween('expiry_date', [$now, $now->copy()->addDays(7)])->count(), '15' => (clone $policies)->whereBetween('expiry_date', [$now, $now->copy()->addDays(15)])->count(), '30' => $expiring, 'expired' => (clone $policies)->whereDate('expiry_date', '<', $now)->count(), 'renewed' => $renewals],
            'work' => ['puc_due' => (clone $vehicles)->whereIn('puc_status', ['not_added', 'due', 'expired'])->count(), 'fitness_due' => (clone $vehicles)->whereIn('fitness_status', ['not_added', 'due', 'expired'])->count(), 'permit_due' => (clone $vehicles)->whereIn('permit_status', ['not_added', 'due', 'expired'])->count(), 'payment_follow_up' => (clone $vehicles)->where('payment_due', '>', 0)->count()],
        ]])->header('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    }
}
