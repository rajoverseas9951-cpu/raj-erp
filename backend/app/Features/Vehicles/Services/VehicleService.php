<?php

namespace App\Features\Vehicles\Services;

use App\Features\Customers\Models\Customer;
use App\Features\Vehicles\Models\Vehicle;
use App\Features\Vehicles\Repositories\VehicleRepository;
use App\Features\Vehicles\Repositories\VehicleTimelineRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VehicleService
{
    private const MASTER_FIELDS = [
        'manufacturer_id' => ['manufacturers', 'manufacturer'],
        'model_id' => ['models', 'model'],
        'colour_id' => ['colours', 'colour'],
        'vehicle_class_id' => ['vehicle_classes', 'vehicle_class'],
        'vehicle_category_id' => ['body_types', 'vehicle_category'],
        'fuel_type_id' => ['fuel_types', 'fuel_type'],
    ];

    public function __construct(private VehicleRepository $vehicles, private VehicleTimelineRepository $timeline)
    {
    }

    public function create(array $data, string $tenantId, ?string $actorId): Vehicle
    {
        return DB::transaction(function () use ($data, $tenantId, $actorId) {
            Customer::where('tenant_id', $tenantId)->findOrFail($data['customer_id']);
            $data = $this->resolveMasters($data, $tenantId);
            $data += ['tenant_id' => $tenantId, 'created_by' => $actorId, 'updated_by' => $actorId];
            $vehicle = $this->vehicles->create($data);
            Customer::where('id', $vehicle->customer_id)->increment('vehicles_count');
            $this->record($vehicle, $actorId, 'vehicle.added', 'Vehicle Added', 'Vehicle master record was created.');
            return $vehicle->load('customer');
        });
    }

    public function update(Vehicle $vehicle, array $data, ?string $actorId): Vehicle
    {
        return DB::transaction(function () use ($vehicle, $data, $actorId) {
            Customer::where('tenant_id', $vehicle->tenant_id)->findOrFail($data['customer_id']);
            $data = $this->resolveMasters($data, $vehicle->tenant_id);
            $before = $vehicle->toArray();
            $oldCustomerId = $vehicle->customer_id;
            $data['updated_by'] = $actorId;
            $updated = $this->vehicles->update($vehicle, $data);
            if ($oldCustomerId !== $updated->customer_id) {
                Customer::where('id', $oldCustomerId)->decrement('vehicles_count');
                Customer::where('id', $updated->customer_id)->increment('vehicles_count');
            }
            $this->record($updated, $actorId, 'vehicle.updated', 'Vehicle Updated', 'Vehicle master record was updated.', ['before' => $before, 'after' => $updated->toArray()]);
            return $updated;
        });
    }

    private function resolveMasters(array $data, string $tenantId): array
    {
        $resolved = [];
        foreach (self::MASTER_FIELDS as $idField => [$type, $nameField]) {
            $id = $data[$idField] ?? null;
            if (! $id && ! empty($data[$nameField])) {
                $id = DB::table('vehicle_masters')->where('tenant_id', $tenantId)->where('type', $type)
                    ->whereRaw('UPPER(name) = ?', [strtoupper(trim($data[$nameField]))])->whereNull('deleted_at')->value('id');
            }
            if (! $id) continue;
            $master = DB::table('vehicle_masters')->where('tenant_id', $tenantId)->where('type', $type)
                ->where('id', $id)->whereNull('deleted_at')->first();
            if (! $master) throw ValidationException::withMessages([$idField => ['Select a valid master record.']]);
            $resolved[$idField] = $master->id;
            $resolved[$nameField] = $master->name;
        }
        if (! empty($resolved['model_id']) && ! empty($resolved['manufacturer_id'])) {
            $modelParent = DB::table('vehicle_masters')->where('id', $resolved['model_id'])->value('parent_id');
            if ($modelParent !== $resolved['manufacturer_id']) {
                throw ValidationException::withMessages(['model_id' => ['Selected model does not belong to the selected manufacturer.']]);
            }
        }
        return array_merge($data, $resolved);
    }

    public function bulkDelete(array $ids, string $tenantId): int
    {
        return DB::transaction(function () use ($ids, $tenantId) {
            $vehicles = Vehicle::where('tenant_id', $tenantId)->whereIn('id', $ids)->get(['id', 'customer_id']);
            $deleted = $this->vehicles->bulkDelete($ids, $tenantId);
            foreach ($vehicles->groupBy('customer_id') as $customerId => $items) Customer::where('id', $customerId)->decrement('vehicles_count', $items->count());
            return $deleted;
        });
    }

    public function bulkUpdate(array $ids, string $tenantId, array $updates, ?string $actorId): int
    {
        $updates['updated_by'] = $actorId;
        return $this->vehicles->bulkUpdate($ids, $tenantId, $updates);
    }

    public function record(Vehicle $vehicle, ?string $actorId, string $type, string $title, string $description, array $metadata = []): void
    {
        $this->timeline->record(['tenant_id' => $vehicle->tenant_id, 'vehicle_id' => $vehicle->id, 'actor_id' => $actorId, 'event_type' => $type, 'title' => $title, 'description' => $description, 'metadata' => $metadata]);
    }
}
