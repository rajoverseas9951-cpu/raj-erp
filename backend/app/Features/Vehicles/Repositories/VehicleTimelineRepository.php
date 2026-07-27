<?php
namespace App\Features\Vehicles\Repositories;
use App\Features\Vehicles\Models\VehicleTimelineEvent; use Illuminate\Support\Collection;
class VehicleTimelineRepository { public function record(array $data): VehicleTimelineEvent { return VehicleTimelineEvent::create($data); } public function list(string $vehicleId,string $tenantId): Collection { return VehicleTimelineEvent::where('tenant_id',$tenantId)->where('vehicle_id',$vehicleId)->latest()->get(); } }
