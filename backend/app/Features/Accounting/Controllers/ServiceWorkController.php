<?php

namespace App\Features\Accounting\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ServiceWorkController
{
    private function tenant(Request $request): string
    {
        return (string) ($request->user()?->tenant_id ?? $request->header('X-Tenant-Id'));
    }

    private function validateType(string $type): string
    {
        abort_unless(in_array($type, ['driving_licence','passport'], true), 404);
        return $type;
    }

    public function index(Request $request, string $type)
    {
        $type = $this->validateType($type);
        $q = DB::table('service_works as w')
            ->leftJoin('customers as c','c.id','=','w.customer_id')
            ->where('w.tenant_id',$this->tenant($request))->where('w.service_type',$type)->whereNull('w.deleted_at')
            ->select('w.*','c.first_name','c.middle_name','c.last_name','c.mobile');
        if ($request->filled('from')) $q->whereDate('w.work_date','>=',$request->input('from'));
        if ($request->filled('to')) $q->whereDate('w.work_date','<=',$request->input('to'));
        if ($request->filled('search')) {
            $s='%'.$request->input('search').'%';
            $q->where(fn($x)=>$x->where('w.application_number','ilike',$s)->orWhere('w.work_type','ilike',$s)->orWhere('c.mobile','ilike',$s)->orWhere('c.first_name','ilike',$s));
        }
        $rows=$q->orderByDesc('w.work_date')->orderByDesc('w.created_at')->get()->map(function($r){
            $name=trim(implode(' ',array_filter([$r->first_name,$r->middle_name,$r->last_name]))) ?: '—';
            return [
                'id'=>$r->id,'service_type'=>$r->service_type,'work_type'=>$r->work_type,'application_number'=>$r->application_number,
                'work_date'=>$r->work_date,'customer_id'=>$r->customer_id,'customer_name'=>$name,'mobile'=>$r->mobile,
                'amount'=>(float)$r->amount,'cost'=>(float)$r->cost,'received_amount'=>(float)$r->received_amount,
                'due_amount'=>round(max(0,(float)$r->amount-(float)$r->received_amount),2),'profit'=>round((float)$r->amount-(float)$r->cost,2),
                'status'=>$r->status,'notes'=>$r->notes,
            ];
        });
        return response()->json(['success'=>true,'data'=>[
            'rows'=>$rows,
            'summary'=>['work_count'=>$rows->count(),'billing'=>round($rows->sum('amount'),2),'cost'=>round($rows->sum('cost'),2),'received'=>round($rows->sum('received_amount'),2),'due'=>round($rows->sum('due_amount'),2),'profit'=>round($rows->sum('profit'),2)]
        ]]);
    }

    public function store(Request $request, string $type)
    {
        $type=$this->validateType($type);
        $data=$request->validate([
            'customer_id'=>'nullable|uuid','work_type'=>'nullable|string|max:255','application_number'=>'nullable|string|max:255',
            'work_date'=>'nullable|date','amount'=>'required|numeric|min:0','cost'=>'nullable|numeric|min:0','received_amount'=>'nullable|numeric|min:0',
            'status'=>'nullable|string|max:40','notes'=>'nullable|string|max:2000',
        ]);
        $id=(string)Str::uuid(); $now=now();
        DB::table('service_works')->insert([
            'id'=>$id,'tenant_id'=>$this->tenant($request),'customer_id'=>$data['customer_id']??null,'service_type'=>$type,
            'work_type'=>$data['work_type']??null,'application_number'=>$data['application_number']??null,'work_date'=>$data['work_date']??$now->toDateString(),
            'amount'=>$data['amount'],'cost'=>$data['cost']??0,'received_amount'=>$data['received_amount']??0,'status'=>$data['status']??'active','notes'=>$data['notes']??null,
            'created_by'=>$request->user()?->id,'created_at'=>$now,'updated_at'=>$now,
        ]);
        return response()->json(['success'=>true,'data'=>['id'=>$id]],201);
    }

    public function update(Request $request, string $type, string $id)
    {
        $this->validateType($type);
        $data=$request->validate([
            'customer_id'=>'nullable|uuid','work_type'=>'nullable|string|max:255','application_number'=>'nullable|string|max:255','work_date'=>'nullable|date',
            'amount'=>'nullable|numeric|min:0','cost'=>'nullable|numeric|min:0','received_amount'=>'nullable|numeric|min:0','status'=>'nullable|string|max:40','notes'=>'nullable|string|max:2000',
        ]);
        $data['updated_at']=now();
        DB::table('service_works')->where('id',$id)->where('tenant_id',$this->tenant($request))->where('service_type',$type)->whereNull('deleted_at')->update($data);
        return response()->json(['success'=>true,'data'=>null]);
    }

    public function destroy(Request $request, string $type, string $id)
    {
        $this->validateType($type);
        DB::table('service_works')->where('id',$id)->where('tenant_id',$this->tenant($request))->where('service_type',$type)->update(['deleted_at'=>now(),'updated_at'=>now()]);
        return response()->json(['success'=>true,'data'=>null]);
    }
}
