<?php

namespace App\Features\Vehicles\Repositories;

use App\Features\Vehicles\Models\Vehicle;
use App\Features\Vehicles\Services\VehicleModuleApplicabilityService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class VehicleRepository
{
    public function paginate(array $filters, string $tenantId): LengthAwarePaginator
    {
        $query = Vehicle::query()
            ->where('tenant_id', $tenantId)
            ->whereNull('archived_at')
            ->with('customer');

        $this->applyFilters($query, $filters);

        $paginator = $query
            ->orderBy($filters['sort'] ?? 'created_at', $filters['direction'] ?? 'desc')
            ->paginate((int) ($filters['per_page'] ?? 25));

        // Vehicle cards must reflect the actual latest operational records, not the
        // legacy status columns stored on vehicles. This keeps list/profile views in sync.
        $this->hydrateComplianceStatuses($paginator->getCollection(), $tenantId);

        return $paginator;
    }

    public function find(string $id, string $tenantId): Vehicle
    {
        return Vehicle::where('tenant_id', $tenantId)
            ->with(['customer', 'documents', 'timelineEvents'])
            ->findOrFail($id);
    }

    public function create(array $data): Vehicle
    {
        return Vehicle::create($data);
    }

    public function update(Vehicle $vehicle, array $data): Vehicle
    {
        $vehicle->update($data);
        return $vehicle->refresh()->load(['customer', 'documents', 'timelineEvents']);
    }

    public function bulkDelete(array $ids, string $tenantId): int
    {
        return Vehicle::where('tenant_id', $tenantId)->whereIn('id', $ids)->delete();
    }

    public function bulkUpdate(array $ids, string $tenantId, array $data): int
    {
        return Vehicle::where('tenant_id', $tenantId)->whereIn('id', $ids)->update($data);
    }

    public function exportQuery(array $filters, string $tenantId): Collection
    {
        $query = Vehicle::query()
            ->where('tenant_id', $tenantId)
            ->whereNull('archived_at')
            ->with('customer');

        $this->applyFilters($query, $filters);
        return $query->orderBy('vehicle_number')->get();
    }

    /**
     * Hydrate compliance chips from their real source-of-truth tables.
     * Status window is shared with the operational profile:
     *   ACTIVE         = expiry more than 30 days away (or no expiry)
     *   EXPIRING_SOON  = expiry today through next 30 days
     *   EXPIRED        = expiry is in the past
     *   NOT_ADDED      = no live record exists
     */
    private function hydrateComplianceStatuses(Collection $vehicles, string $tenantId): void
    {
        if ($vehicles->isEmpty()) return;

        $vehicleIds = $vehicles->pluck('id')->all();

        $operationTables = [
            'puc' => 'vehicle_pucs',
            'fitness' => 'vehicle_fitnesses',
            'permit' => 'vehicle_permits',
            'tax' => 'vehicle_taxes',
        ];

        foreach ($operationTables as $module => $table) {
            $latest = DB::table($table)
                ->select(['vehicle_id', 'expiry_date'])
                ->where('tenant_id', $tenantId)
                ->whereIn('vehicle_id', $vehicleIds)
                ->whereNull('deleted_at')
                ->orderBy('vehicle_id')
                ->orderByDesc('expiry_date')
                ->orderByDesc('created_at')
                ->get()
                ->unique('vehicle_id')
                ->keyBy('vehicle_id');

            foreach ($vehicles as $vehicle) {
                $record = $latest->get($vehicle->id);
                $vehicle->setAttribute(
                    $module.'_status',
                    VehicleModuleApplicabilityService::status($record?->expiry_date, (bool) $record)
                );
            }
        }

        $latestInsurance = DB::table('vehicle_insurances')
            ->select(['vehicle_id', 'expiry_date'])
            ->where('tenant_id', $tenantId)
            ->whereIn('vehicle_id', $vehicleIds)
            ->whereNull('deleted_at')
            ->whereNull('archived_at')
            ->whereNotIn('status', ['cancelled'])
            ->orderBy('vehicle_id')
            ->orderByDesc('expiry_date')
            ->orderByDesc('created_at')
            ->get()
            ->unique('vehicle_id')
            ->keyBy('vehicle_id');

        foreach ($vehicles as $vehicle) {
            $record = $latestInsurance->get($vehicle->id);
            $vehicle->setAttribute(
                'insurance_status',
                VehicleModuleApplicabilityService::status($record?->expiry_date, (bool) $record)
            );
        }
    }

    private function applyFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(fn ($where) => $where
                ->where('vehicle_number', 'ilike', "%{$search}%")
                ->orWhere('manufacturer', 'ilike', "%{$search}%")
                ->orWhere('model', 'ilike', "%{$search}%")
                ->orWhere('chassis_number', 'ilike', "%{$search}%")
                ->orWhereHas('customer', fn ($customer) => $customer
                    ->where('first_name', 'ilike', "%{$search}%")
                    ->orWhere('last_name', 'ilike', "%{$search}%")
                    ->orWhere('mobile', 'ilike', "%{$search}%")));
        }

        foreach (['vehicle_type', 'manufacturer', 'model', 'fuel_type', 'insurance_status', 'fitness_status', 'permit_status', 'tax_status', 'puc_status', 'customer_id'] as $key) {
            if (! empty($filters[$key])) $query->where($key, $filters[$key]);
        }
    }
}
