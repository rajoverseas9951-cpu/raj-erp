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
        $now = now(); $start = $now->copy()->startOfMonth(); $previous = $start->copy()->subMonth();
        $table = fn(string $name) => DB::table($name)->where('tenant_id',$tenant)->whereNull('deleted_at');
        $growth = fn(float $a,float $b) => $b > 0 ? round((($a-$b)/$b)*100,1) : ($a > 0 ? 100.0 : 0.0);
        $period = function(string $name) use($table,$start,$previous,$growth) {
            $current=(clone $table($name))->where('created_at','>=',$start)->count();
            $prior=(clone $table($name))->whereBetween('created_at',[$previous,$start])->count();
            return [$current,$growth($current,$prior)];
        };
        $policies=$table('vehicle_insurances'); [$newPolicies,$policyGrowth]=$period('vehicle_insurances');
        $revenue=(float)(clone $policies)->where('created_at','>=',$start)->sum('customer_pay');
        $previousRevenue=(float)(clone $policies)->whereBetween('created_at',[$previous,$start])->sum('customer_pay');
        $outstanding=Schema::hasTable('insurance_commissions')?(float)DB::table('insurance_commissions')->where('tenant_id',$tenant)->whereNull('deleted_at')->selectRaw('COALESCE(SUM(net_receivable-received_amount),0) total')->value('total'):0;
        [$newCustomers,$customerGrowth]=$period('customers'); [$newVehicles,$vehicleGrowth]=$period('vehicles');
        $activePolicies=(clone $policies)->whereDate('expiry_date','>=',$now)->count();
        $expiring=(clone $policies)->whereBetween('expiry_date',[$now->toDateString(),$now->copy()->addDays(30)->toDateString()])->count();
        $trend=collect(range(5,0))->map(function($ago)use($policies,$now){$from=$now->copy()->subMonths($ago)->startOfMonth();return ['month'=>$from->format('M'),'revenue'=>(float)(clone $policies)->whereBetween('created_at',[$from,$from->copy()->addMonth()])->sum('customer_pay')];});
        $raw=DB::table('vehicle_masters')->where('tenant_id',$tenant)->whereNull('deleted_at')->selectRaw("type, COUNT(*) total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) active")->groupBy('type')->get()->keyBy('type');
        $masterCounts=collect(['manufacturers','models','colours','vehicle_classes','body_types','fuel_types'])->mapWithKeys(fn($type)=>[$type=>['total'=>(int)($raw->get($type)->total??0),'active'=>(int)($raw->get($type)->active??0)]]);
        foreach(['insurance_companies','insurance_purchase_sources','ledgers'] as $name){$q=$table($name);$active=Schema::hasColumn($name,'status')?(clone $q)->where('status','active')->count():(Schema::hasColumn($name,'is_active')?(clone $q)->where('is_active',true)->count():(clone $q)->count());$masterCounts[$name]=['total'=>(clone $q)->count(),'active'=>$active];}
        $byVehicle=fn(array $types)=>DB::table('vehicle_insurances')
            ->join('vehicles','vehicles.id','=','vehicle_insurances.vehicle_id')
            ->where('vehicle_insurances.tenant_id',$tenant)
            ->whereNull('vehicle_insurances.deleted_at')
            ->whereNull('vehicles.deleted_at')
            ->whereIn('vehicles.vehicle_type',$types)
            ->count();
        return response()->json(['success'=>true,'data'=>[
            'kpis'=>[
                'customers'=>['value'=>(clone $table('customers'))->count(),'growth'=>$customerGrowth],
                'vehicles'=>['value'=>(clone $table('vehicles'))->count(),'growth'=>$vehicleGrowth],
                'active_policies'=>['value'=>$activePolicies,'growth'=>$policyGrowth],
                'expiring_policies'=>['value'=>$expiring,'growth'=>0],
                'outstanding_receivable'=>['value'=>$outstanding,'growth'=>0],
                'monthly_revenue'=>['value'=>$revenue,'growth'=>$growth($revenue,$previousRevenue)],
                'gross_commission'=>['value'=>(float)(clone $policies)->where('created_at','>=',$start)->sum('gross_commission'),'growth'=>0],
                'pending_rto'=>['value'=>(clone $table('vehicles'))->where(fn($q)=>$q->whereIn('fitness_status',['not_added','due','expired'])->orWhereIn('permit_status',['not_added','due','expired']))->count(),'growth'=>0],
            ],
            'revenue'=>['current'=>$revenue,'previous'=>$previousRevenue,'outstanding'=>$outstanding,'trend'=>$trend],
            'policies'=>['new'=>$newPolicies,'renewals'=>(clone $policies)->where('created_at','>=',$start)->where('status','renewed')->count(),'comprehensive'=>(clone $policies)->whereIn('insurance_type',['comprehensive','package'])->count(),'third_party'=>(clone $policies)->whereIn('insurance_type',['third_party','standalone_tp'])->count(),'two_wheeler'=>$byVehicle(['two_wheeler']),'private_car'=>$byVehicle(['private_car']),'commercial'=>$byVehicle(['lgv','hgv','taxi'])],
            'renewals'=>['7'=>(clone $policies)->whereBetween('expiry_date',[$now,$now->copy()->addDays(7)])->count(),'15'=>(clone $policies)->whereBetween('expiry_date',[$now,$now->copy()->addDays(15)])->count(),'30'=>$expiring,'expired'=>(clone $policies)->whereDate('expiry_date','<',$now)->count(),'renewed'=>(clone $policies)->where('status','renewed')->count()],
            'work'=>['puc_due'=>(clone $table('vehicles'))->whereIn('puc_status',['not_added','due','expired'])->count(),'fitness_due'=>(clone $table('vehicles'))->whereIn('fitness_status',['not_added','due','expired'])->count(),'permit_due'=>(clone $table('vehicles'))->whereIn('permit_status',['not_added','due','expired'])->count(),'payment_follow_up'=>(clone $table('vehicles'))->where('payment_due','>',0)->count()],
            'master_counts'=>$masterCounts,
        ]]);
    }
}
