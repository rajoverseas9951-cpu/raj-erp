<?php
namespace App\Features\Customers\Controllers;
use App\Features\Customers\Requests\BulkCustomerRequest; use App\Features\Customers\Requests\CustomerRequest; use App\Features\Customers\Repositories\CustomerRepository; use App\Features\Customers\Repositories\CustomerTimelineRepository; use App\Features\Customers\Services\CustomerService; use App\Support\SimplePdf; use Illuminate\Http\Request; use Symfony\Component\HttpFoundation\StreamedResponse;
class CustomerController {
 public function __construct(private CustomerRepository $customers, private CustomerService $service, private CustomerTimelineRepository $timeline) {}
 public function index(Request $r){ $this->authorize($r,'customer.view'); return response()->json(['success'=>true,'data'=>$this->customers->paginate($r->query(),$this->tenant($r))]); }
 public function store(CustomerRequest $r){ return response()->json(['success'=>true,'data'=>$this->service->create($r->validated(),$this->tenant($r),$r->user()?->id)],201); }
 public function show(Request $r,string $id){ $this->authorize($r,'customer.view'); return response()->json(['success'=>true,'data'=>$this->customers->find($id,$this->tenant($r))]); }
 public function update(CustomerRequest $r,string $id){ $c=$this->customers->find($id,$this->tenant($r)); return response()->json(['success'=>true,'data'=>$this->service->update($c,$r->validated(),$r->user()?->id)]); }
 public function destroy(Request $r,string $id){ $this->authorize($r,'customer.delete'); $this->service->bulkDelete([$id],$this->tenant($r)); return response()->json(['success'=>true,'data'=>null]); }
 public function bulkDelete(BulkCustomerRequest $r){ return response()->json(['success'=>true,'data'=>['deleted'=>$this->service->bulkDelete($r->validated('ids'),$this->tenant($r))]]); }
 public function bulkAssign(BulkCustomerRequest $r){ return response()->json(['success'=>true,'data'=>['assigned'=>$this->service->bulkAssign($r->validated('ids'),$this->tenant($r),$r->validated('assigned_to'))]]); }
 public function timeline(Request $r,string $id){ $this->authorize($r,'customer.view'); return response()->json(['success'=>true,'data'=>$this->timeline->list($id,$this->tenant($r))]); }
 public function export(Request $r): StreamedResponse {
  $this->authorize($r,'customer.export'); $rows=$this->customers->exportQuery($r->query(),$this->tenant($r));
  if($r->query('format')==='pdf'){
   $pdfRows=[]; foreach($rows as $c){ $pdfRows[]=[ $c->customer_code, trim("$c->first_name $c->middle_name $c->last_name"), $c->mobile, $c->city, $c->vehicles_count, $c->insurance_policies_count, $c->rto_files_count, $c->status ]; }
   $pdf=SimplePdf::document('Customer Report',['Customer ID','Customer Name','Mobile','City','Vehicles','Policies','RTO Files','Status'],$pdfRows);
   return response()->streamDownload(fn()=>print($pdf),'customers.pdf',['Content-Type'=>'application/pdf']);
  }
  return response()->streamDownload(function() use($rows){ $out=fopen('php://output','w'); fputcsv($out,['Customer ID','Customer Name','Mobile','City','Vehicles','Insurance Policies','RTO Files','GST','Status']); foreach($rows as $c) fputcsv($out,[$c->customer_code,trim("$c->first_name $c->middle_name $c->last_name"),$c->mobile,$c->city,$c->vehicles_count,$c->insurance_policies_count,$c->rto_files_count,$c->gst_number,$c->status]); },'customers.csv');
 }
 private function tenant(Request $r): string { return (string)($r->user()?->tenant_id ?? $r->header('X-Tenant-Id')); }
 private function authorize(Request $r,string $permission): void { abort_unless($r->user()?->can($permission),403); }
}
