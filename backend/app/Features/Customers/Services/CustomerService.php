<?php
namespace App\Features\Customers\Services;
use App\Features\Customers\Models\Customer; use App\Features\Customers\Repositories\CustomerRepository; use App\Features\Customers\Repositories\CustomerTimelineRepository; use Illuminate\Support\Facades\DB;
class CustomerService {
 public function __construct(private CustomerRepository $customers, private CustomerTimelineRepository $timeline) {}
 public function create(array $data,string $tenantId,?string $actorId): Customer { return DB::transaction(function() use($data,$tenantId,$actorId){ $data+=['tenant_id'=>$tenantId,'created_by'=>$actorId,'updated_by'=>$actorId,'customer_code'=>$this->nextCode($tenantId)]; $c=$this->customers->create($data); $this->record($c,$actorId,'customer.created','Created Customer','Customer profile was created.'); return $c; }); }
 public function update(Customer $customer,array $data,?string $actorId): Customer { return DB::transaction(function() use($customer,$data,$actorId){ $before=$customer->toArray(); $data['updated_by']=$actorId; $c=$this->customers->update($customer,$data); $this->record($c,$actorId,'customer.edited','Edited Customer','Customer profile was updated.',['before'=>$before,'after'=>$c->toArray()]); return $c; }); }
 public function bulkDelete(array $ids,string $tenantId): int { return $this->customers->bulkDelete($ids,$tenantId); }
 public function bulkAssign(array $ids,string $tenantId,string $assigneeId): int { return $this->customers->bulkAssign($ids,$tenantId,$assigneeId); }
 public function record(Customer $c,?string $actorId,string $type,string $title,string $description,array $metadata=[]): void { $this->timeline->record(['tenant_id'=>$c->tenant_id,'customer_id'=>$c->id,'actor_id'=>$actorId,'event_type'=>$type,'title'=>$title,'description'=>$description,'metadata'=>$metadata]); }
 private function nextCode(string $tenantId): string { return 'CUST-'.now()->format('Ymd').'-'.str_pad((string)random_int(1,999999),6,'0',STR_PAD_LEFT); }
}
