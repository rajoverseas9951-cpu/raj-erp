<?php
namespace App\Features\Customers\Repositories;
use App\Features\Customers\Models\Customer; use Illuminate\Contracts\Pagination\LengthAwarePaginator; use Illuminate\Database\Eloquent\Builder; use Illuminate\Support\Collection;
class CustomerRepository {
  public function paginate(array $filters, string $tenantId): LengthAwarePaginator { $q=Customer::query()->where('tenant_id',$tenantId); $this->applyFilters($q,$filters); return $q->orderBy($filters['sort']??'created_at',$filters['direction']??'desc')->paginate((int)($filters['per_page']??25)); }
  public function find(string $id,string $tenantId): Customer { return Customer::where('tenant_id',$tenantId)->with(['documents','timelineEvents'])->findOrFail($id); }
  public function create(array $data): Customer { return Customer::create($data); }
  public function update(Customer $customer,array $data): Customer { $customer->update($data); return $customer->refresh(); }
  public function bulkDelete(array $ids,string $tenantId): int { return Customer::where('tenant_id',$tenantId)->whereIn('id',$ids)->delete(); }
  public function bulkAssign(array $ids,string $tenantId,string $assigneeId): int { return Customer::where('tenant_id',$tenantId)->whereIn('id',$ids)->update(['assigned_to'=>$assigneeId]); }
  public function exportQuery(array $filters,string $tenantId): Collection { $q=Customer::query()->where('tenant_id',$tenantId); $this->applyFilters($q,$filters); return $q->orderBy('customer_code')->get(); }
  private function applyFilters(Builder $q,array $f): void { if(!empty($f['search'])){$s=$f['search'];$q->where(fn($w)=>$w->where('customer_code','ilike',"%$s%")->orWhere('first_name','ilike',"%$s%")->orWhere('last_name','ilike',"%$s%")->orWhere('mobile','ilike',"%$s%"));} foreach(['city','state','status','priority','assigned_to'] as $key){ if(!empty($f[$key])) $q->where($key,$f[$key]); } }
}
