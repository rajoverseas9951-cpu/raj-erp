<?php

namespace App\Features\Vehicles\Controllers;

use App\Features\Customers\Models\Customer;
use App\Features\Vehicles\Models\Vehicle;
use App\Features\Vehicles\Repositories\VehicleRepository;
use App\Features\Vehicles\Repositories\VehicleTimelineRepository;
use App\Features\Vehicles\Requests\BulkVehicleRequest;
use App\Features\Vehicles\Requests\VehicleRequest;
use App\Features\Vehicles\Services\RecordDependencyService;
use App\Features\Vehicles\Services\VehicleService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class VehicleController
{
    public function __construct(
        private VehicleRepository $vehicles,
        private VehicleService $service,
        private VehicleTimelineRepository $timeline,
        private RecordDependencyService $dependencies,
    ) {}

    public function index(Request $request) { $this->authorize($request, 'vehicle.view'); return response()->json(['success' => true, 'data' => $this->vehicles->paginate($request->query(), $this->tenant($request))]); }
    public function store(VehicleRequest $request) { return response()->json(['success' => true, 'data' => $this->service->create($request->validated(), $this->tenant($request), $request->user()?->id)], 201); }
    public function show(Request $request, string $id) { $this->authorize($request, 'vehicle.view'); return response()->json(['success' => true, 'data' => $this->vehicles->find($id, $this->tenant($request))]); }
    public function update(VehicleRequest $request, string $id) { return response()->json(['success' => true, 'data' => $this->service->update($this->vehicles->find($id, $this->tenant($request)), $request->validated(), $request->user()?->id)]); }

    public function archive(Request $request, string $id)
    {
        $this->authorize($request, 'vehicle.delete');
        $vehicle = $this->vehicles->find($id, $this->tenant($request));
        DB::transaction(function () use ($request, $vehicle) {
            if (! $vehicle->archived_at) Customer::where('tenant_id', $vehicle->tenant_id)->where('id', $vehicle->customer_id)->where('vehicles_count', '>', 0)->decrement('vehicles_count');
            $vehicle->update(['archived_at' => now(), 'archived_by' => $request->user()?->id, 'updated_by' => $request->user()?->id]);
            $this->service->record($vehicle, $request->user()?->id, 'vehicle.archived', 'Vehicle Archived', 'Vehicle was removed from active operations.');
        });
        return response()->json(['success' => true, 'message' => 'Vehicle archived successfully.', 'data' => $vehicle->refresh()]);
    }

    public function destroy(Request $request, string $id)
    {
        $this->authorize($request, 'vehicle.delete');
        $vehicle = $this->vehicles->find($id, $this->tenant($request));
        $counts = $this->dependencies->vehicle($vehicle->tenant_id, $vehicle->id);
        if ($counts) return response()->json([
            'success' => false,
            'message' => 'This vehicle has linked records and cannot be permanently deleted. Archive it or remove/cancel linked records first.',
            'dependency_counts' => $counts,
        ], 409);
        DB::transaction(function () use ($vehicle) {
            if (! $vehicle->archived_at) Customer::where('tenant_id', $vehicle->tenant_id)->where('id', $vehicle->customer_id)->where('vehicles_count', '>', 0)->decrement('vehicles_count');
            $vehicle->forceDelete();
        });
        return response()->json(['success' => true, 'message' => 'Vehicle permanently deleted.', 'data' => null]);
    }

    public function bulkDelete(BulkVehicleRequest $request)
    {
        $vehicles = Vehicle::where('tenant_id', $this->tenant($request))->whereIn('id', $request->validated('ids'))->whereNull('archived_at')->get();
        DB::transaction(function () use ($request, $vehicles) {
            foreach ($vehicles as $vehicle) {
                Customer::where('tenant_id', $vehicle->tenant_id)->where('id', $vehicle->customer_id)->where('vehicles_count', '>', 0)->decrement('vehicles_count');
                $vehicle->update(['archived_at' => now(), 'archived_by' => $request->user()?->id, 'updated_by' => $request->user()?->id]);
            }
        });
        return response()->json(['success' => true, 'message' => 'Vehicles archived successfully.', 'data' => ['archived' => $vehicles->count()]]);
    }

    public function bulkUpdate(BulkVehicleRequest $request) { return response()->json(['success' => true, 'data' => ['updated' => $this->service->bulkUpdate($request->validated('ids'), $this->tenant($request), $request->validated('updates', []), $request->user()?->id)]]); }
    public function timeline(Request $request, string $id) { $this->authorize($request, 'vehicle.view'); return response()->json(['success' => true, 'data' => $this->timeline->list($id, $this->tenant($request))]); }

    public function export(Request $request): StreamedResponse
    {
        $this->authorize($request, 'vehicle.export'); $rows = $this->vehicles->exportQuery($request->query(), $this->tenant($request));
        if ($request->query('format') === 'pdf') return response()->streamDownload(function () use ($rows) { echo '<html><body><h1>Vehicles</h1><table border="1" cellpadding="6"><tr><th>Vehicle Number</th><th>Owner</th><th>Type</th></tr>'; foreach ($rows as $vehicle) echo '<tr><td>'.e($vehicle->vehicle_number).'</td><td>'.e(trim(($vehicle->customer->first_name ?? '').' '.($vehicle->customer->last_name ?? ''))).'</td><td>'.e($vehicle->vehicle_type).'</td></tr>'; echo '</table></body></html>'; }, 'vehicles.pdf', ['Content-Type' => 'application/pdf']);
        return response()->streamDownload(function () use ($rows) { $out = fopen('php://output', 'w'); fputcsv($out, ['Vehicle Number', 'Owner Name', 'Mobile Number', 'Vehicle Type', 'Manufacturer', 'Model', 'Fuel']); foreach ($rows as $vehicle) fputcsv($out, [$vehicle->vehicle_number, trim(($vehicle->customer->first_name ?? '').' '.($vehicle->customer->last_name ?? '')), $vehicle->customer->mobile ?? '', $vehicle->vehicle_type, $vehicle->manufacturer, $vehicle->model, $vehicle->fuel_type]); }, 'vehicles.csv');
    }

    private function tenant(Request $request): string { return (string) $request->user()?->tenant_id; }
    private function authorize(Request $request, string $permission): void { abort_unless($request->user()?->can($permission), 403); }
}
