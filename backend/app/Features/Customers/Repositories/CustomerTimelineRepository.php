<?php
namespace App\Features\Customers\Repositories;
use App\Features\Customers\Models\CustomerTimelineEvent;
class CustomerTimelineRepository { public function record(array $data): CustomerTimelineEvent { return CustomerTimelineEvent::create($data); } public function list(string $customerId,string $tenantId){ return CustomerTimelineEvent::where('tenant_id',$tenantId)->where('customer_id',$customerId)->latest()->paginate(50); } }
