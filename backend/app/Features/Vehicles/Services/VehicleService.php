<?php
namespace App\Features\Vehicles\Services;
use App\Features\Vehicles\Models\Vehicle; use Illuminate\Support\Facades\DB;
class VehicleService { public function create(array $data,string $tenant,?string $actor): Vehicle{return DB::transaction(function()use($data,$tenant,$actor){return Vehicle::create($data+['tenant_id'=>$tenant,'created_by'=>$actor,'updated_by'=>$actor]);});} public function update(Vehicle $vehicle,array $data,?string $actor): Vehicle{$vehicle->update($data+['updated_by'=>$actor]);return $vehicle->refresh();} }
