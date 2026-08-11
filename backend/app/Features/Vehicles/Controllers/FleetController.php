<?php

namespace App\Features\Vehicles\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class FleetController
{
    private function tenant(Request $request): string { return (string) $request->user()?->tenant_id; }

    public function index(Request $request)
    {
        $q = DB::table('fleets as f')->leftJoin('customers as c','c.id','=','f.primary_customer_id')
            ->where('f.tenant_id',$this->tenant($request))->whereNull('f.deleted_at')
            ->select('f.*','c.first_name','c.last_name','c.mobile as customer_mobile');
        if ($request->filled('search')) { $s='%'.$request->input('search').'%'; $q->where(fn($x)=>$x->where('f.fleet_name','ilike',$s)->orWhere('f.business_name','ilike',$s)->orWhere('f.fleet_code','ilike',$s)->orWhere('f.mobile','ilike',$s)); }
        $rows=$q->orderBy('f.fleet_name')->get()->map(function($f){
            $vehicles=DB::table('vehicles')->where('tenant_id',$f->tenant_id)->where('fleet_id',$f->id)->whereNull('deleted_at')->whereNull('archived_at');
            $total=(clone $vehicles)->count();
            $due=(clone $vehicles)->where(function($q){$q->whereIn('insurance_status',['expired','expiring_soon'])->orWhereIn('puc_status',['expired','expiring_soon'])->orWhereIn('fitness_status',['expired','expiring_soon'])->orWhereIn('permit_status',['expired','expiring_soon'])->orWhereIn('tax_status',['due','overdue']);})->count();
            return [
                'id'=>$f->id,'fleet_code'=>$f->fleet_code,'fleet_name'=>$f->fleet_name,'business_name'=>$f->business_name,
                'primary_customer_id'=>$f->primary_customer_id,'primary_customer'=>trim(($f->first_name??'').' '.($f->last_name??'')) ?: null,
                'fleet_type'=>$f->fleet_type,'contact_person'=>$f->contact_person,'mobile'=>$f->mobile ?: $f->customer_mobile,'gst_number'=>$f->gst_number,
                'credit_allowed'=>(bool)$f->credit_allowed,'credit_limit'=>(float)$f->credit_limit,'status'=>$f->status,
                'vehicle_count'=>$total,'compliance_attention'=>$due,
            ];
        });
        return response()->json(['success'=>true,'data'=>$rows]);
    }

    public function show(Request $request, string $id)
    {
        $tenant=$this->tenant($request);
        $fleet=DB::table('fleets')->where('tenant_id',$tenant)->where('id',$id)->whereNull('deleted_at')->first(); abort_unless($fleet,404);
        $vehicles=DB::table('vehicles')->where('tenant_id',$tenant)->where('fleet_id',$id)->whereNull('deleted_at')->whereNull('archived_at')->orderBy('vehicle_number')->get();
        $rows=$vehicles->map(function($v){
            $attention=[];
            if(in_array($v->insurance_status,['expired','expiring_soon']))$attention[]='Insurance';
            if(in_array($v->puc_status,['expired','expiring_soon']))$attention[]='PUC';
            if(in_array($v->fitness_status,['expired','expiring_soon']))$attention[]='Fitness';
            if(in_array($v->permit_status,['expired','expiring_soon']))$attention[]='Permit';
            if(in_array($v->tax_status,['due','overdue']))$attention[]='Tax';
            return ['id'=>$v->id,'vehicle_number'=>$v->vehicle_number,'vehicle_type'=>$v->vehicle_type,'insurance_status'=>$v->insurance_status,'insurance_expiry'=>$v->insurance_expiry,'puc_status'=>$v->puc_status,'puc_expiry'=>$v->puc_expiry,'fitness_status'=>$v->fitness_status,'fitness_expiry'=>$v->fitness_expiry,'permit_status'=>$v->permit_status,'permit_expiry'=>$v->permit_expiry,'tax_status'=>$v->tax_status,'tax_expiry'=>$v->tax_expiry,'payment_due'=>(float)($v->payment_due??0),'attention'=>$attention];
        });
        return response()->json(['success'=>true,'data'=>[
            'fleet'=>$fleet,
            'summary'=>['vehicles'=>$rows->count(),'attention'=>$rows->filter(fn($r)=>count($r['attention'])>0)->count(),'outstanding'=>round($rows->sum('payment_due'),2),'insurance_due'=>$rows->filter(fn($r)=>in_array($r['insurance_status'],['expired','expiring_soon']))->count(),'puc_due'=>$rows->filter(fn($r)=>in_array($r['puc_status'],['expired','expiring_soon']))->count(),'fitness_due'=>$rows->filter(fn($r)=>in_array($r['fitness_status'],['expired','expiring_soon']))->count(),'permit_due'=>$rows->filter(fn($r)=>in_array($r['permit_status'],['expired','expiring_soon']))->count(),'tax_due'=>$rows->filter(fn($r)=>in_array($r['tax_status'],['due','overdue']))->count()],
            'vehicles'=>$rows,
        ]]);
    }

    public function store(Request $request)
    {
        $data=$request->validate($this->rules(true)); $tenant=$this->tenant($request); $id=(string)Str::uuid();
        $count=DB::table('fleets')->where('tenant_id',$tenant)->count()+1; $code='FLT-'.str_pad((string)$count,5,'0',STR_PAD_LEFT);
        DB::table('fleets')->insert([...$data,'id'=>$id,'tenant_id'=>$tenant,'fleet_code'=>$code,'credit_allowed'=>$request->boolean('credit_allowed'),'credit_limit'=>$data['credit_limit']??0,'status'=>$data['status']??'active','created_by'=>$request->user()?->id,'created_at'=>now(),'updated_at'=>now()]);
        return response()->json(['success'=>true,'data'=>['id'=>$id,'fleet_code'=>$code]],201);
    }

    public function update(Request $request,string $id)
    {
        $data=$request->validate($this->rules(false)); if(array_key_exists('credit_allowed',$data))$data['credit_allowed']=$request->boolean('credit_allowed'); $data['updated_at']=now();
        DB::table('fleets')->where('tenant_id',$this->tenant($request))->where('id',$id)->whereNull('deleted_at')->update($data);
        return response()->json(['success'=>true,'data'=>null]);
    }

    public function destroy(Request $request,string $id)
    {
        $tenant=$this->tenant($request); abort_if(DB::table('vehicles')->where('tenant_id',$tenant)->where('fleet_id',$id)->whereNull('deleted_at')->whereNull('archived_at')->exists(),409,'Fleet has active vehicles. Unlink vehicles first.');
        DB::table('fleets')->where('tenant_id',$tenant)->where('id',$id)->update(['deleted_at'=>now(),'updated_at'=>now()]);
        return response()->json(['success'=>true,'data'=>null]);
    }

    private function rules(bool $creating): array
    {
        return ['fleet_name'=>($creating?'required':'nullable').'|string|max:180','business_name'=>'nullable|string|max:220','primary_customer_id'=>'nullable|uuid','fleet_type'=>'nullable|string|max:60','contact_person'=>'nullable|string|max:160','mobile'=>'nullable|string|max:20','alternate_mobile'=>'nullable|string|max:20','gst_number'=>'nullable|string|max:30','address'=>'nullable|string|max:2000','credit_allowed'=>'nullable|boolean','credit_limit'=>'nullable|numeric|min:0','default_broker'=>'nullable|string|max:180','default_agent'=>'nullable|string|max:180','status'=>'nullable|string|max:30','notes'=>'nullable|string|max:3000'];
    }
}
