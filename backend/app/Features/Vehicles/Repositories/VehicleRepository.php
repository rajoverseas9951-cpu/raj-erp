<?php
namespace App\Features\Vehicles\Repositories;
use App\Features\Vehicles\Models\Vehicle; use Illuminate\Contracts\Pagination\LengthAwarePaginator;
class VehicleRepository { public function paginate(array $filters,string $tenant): LengthAwarePaginator { return Vehicle::with('customer:id,first_name,last_name')->where('tenant_id',$tenant)->when($filters['search']??null,fn($q,$s)=>$q->where(fn($w)=>$w->where('registration_number','ilike',"%$s%")->orWhere('manufacturer','ilike',"%$s%")->orWhere('model','ilike',"%$s%")))->latest()->paginate(min((int)($filters['per_page']??25),100)); } public function find(string $id,string $tenant): Vehicle{return Vehicle::with('customer')->where('tenant_id',$tenant)->findOrFail($id);} }
