<?php

namespace App\Features\Vehicles\Controllers;

use App\Features\Vehicles\Services\VehicleMasterResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class VehicleMasterController
{
    private const TYPES = ['manufacturers', 'models', 'variants', 'colours', 'vehicle_types', 'vehicle_classes', 'body_types', 'fuel_types', 'rto_offices'];

    public function __construct(private VehicleMasterResolver $resolver) {}

    public function index(Request $request, string $type): JsonResponse
    {
        $type = $this->type($type);
        $this->authorize($request, 'vehicle.view');
        $query = $this->query($request, $type)
            ->leftJoin('vehicle_masters as parent', 'parent.id', '=', 'vehicle_masters.parent_id')
            ->select('vehicle_masters.*', 'parent.name as parent_name');

        if ($search = trim((string) $request->query('search'))) {
            $term = '%'.strtolower($search).'%';
            $query->where(fn ($q) => $q->whereRaw('LOWER(vehicle_masters.name) LIKE ?', [$term])
                ->orWhereRaw('LOWER(vehicle_masters.code) LIKE ?', [$term]));
        }
        if ($request->filled('status')) $query->where('vehicle_masters.status', $request->query('status'));
        if ($request->filled('parent_id')) $query->where('vehicle_masters.parent_id', $request->query('parent_id'));
        if ($type === 'models' && $request->filled('manufacturer_id')) {
            $request->validate(['manufacturer_id' => ['required', 'uuid']]);
            $query->where('vehicle_masters.parent_id', $request->query('manufacturer_id'));
        }
        if ($type === 'variants' && $request->filled('model_id')) {
            $request->validate(['model_id' => ['required', 'uuid']]);
            $query->where('vehicle_masters.parent_id', $request->query('model_id'));
        }

        $query->orderBy('vehicle_masters.name');
        if ($request->boolean('paginate')) {
            $request->validate(['per_page' => ['sometimes', 'integer', 'min:5', 'max:100']]);
            return response()->json(['success' => true, 'data' => $query->paginate((int) $request->query('per_page', 20))]);
        }
        return response()->json(['success' => true, 'data' => $query->get()]);
    }

    public function store(Request $request, string $type): JsonResponse
    {
        $type = $this->type($type);
        $this->authorize($request, 'vehicle.create');
        $data = $this->validated($request, $type);
        $this->validateParent($request, $type, $data['parent_id'] ?? null);
        $this->ensureUnique($request, $type, $data['name'], $data['parent_id'] ?? null);
        $id = (string) Str::uuid();
        $name = strtoupper(trim($data['name']));
        $inserted = DB::table('vehicle_masters')->insertOrIgnore([
            ...$data,
            'id' => $id,
            'tenant_id' => $this->tenant($request),
            'type' => $type,
            'name' => $name,
            'normalized_name' => $this->resolver->normalizeName($name),
            'normalized_key' => $this->resolver->normalizedKey(
                $this->tenant($request),
                $type,
                $name,
                $data['parent_id'] ?? null,
            ),
            'status' => $data['status'] ?? 'active',
            'created_by' => $request->user()?->id,
            'updated_by' => $request->user()?->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        if (! $inserted) {
            throw ValidationException::withMessages(['name' => ['This master name already exists.']]);
        }

        return response()->json(['success' => true, 'data' => $this->find($request, $type, $id)], 201);
    }

    public function update(Request $request, string $type, string $id): JsonResponse
    {
        $type = $this->type($type);
        $this->authorize($request, 'vehicle.update');
        $current = $this->find($request, $type, $id);
        $data = $this->validated($request, $type, true);
        if (array_key_exists('parent_id', $data)) $this->validateParent($request, $type, $data['parent_id']);
        $name = isset($data['name']) ? strtoupper(trim($data['name'])) : $current->name;
        $parentId = array_key_exists('parent_id', $data) ? $data['parent_id'] : $current->parent_id;
        $this->ensureUnique($request, $type, $name, $parentId, $id);
        $data['name'] = $name;
        $data['normalized_name'] = $this->resolver->normalizeName($name);
        $data['normalized_key'] = $this->resolver->normalizedKey(
            $this->tenant($request),
            $type,
            $name,
            $parentId,
        );
        $this->query($request, $type)->where('id', $id)->update([
            ...$data,
            'updated_by' => $request->user()?->id,
            'updated_at' => now(),
        ]);

        return response()->json(['success' => true, 'data' => $this->find($request, $type, $id)]);
    }

    public function destroy(Request $request, string $type, string $id): JsonResponse
    {
        $type = $this->type($type);
        $this->authorize($request, 'vehicle.delete');
        $this->find($request, $type, $id);
        $column = [
            'manufacturers' => 'manufacturer_id', 'models' => 'model_id', 'colours' => 'colour_id',
            'variants' => 'variant_id', 'vehicle_types' => 'vehicle_type_id',
            'vehicle_classes' => 'vehicle_class_id', 'body_types' => 'vehicle_category_id',
            'fuel_types' => 'fuel_type_id', 'rto_offices' => 'rto_office_id',
        ][$type] ?? null;
        $record = $this->find($request, $type, $id);
        $vehicleQuery = DB::table('vehicles')->where('tenant_id', $this->tenant($request))->whereNull('deleted_at');
        $inUse = $column ? $vehicleQuery->where($column, $id)->exists() : false;
        $hasChildren = ($type === 'manufacturers' && $this->query($request, 'models')->where('parent_id', $id)->exists())
            || ($type === 'models' && $this->query($request, 'variants')->where('parent_id', $id)->exists());
        if ($inUse || $hasChildren) {
            return response()->json(['success' => false, 'message' => 'This master is in use and cannot be deleted. Deactivate it instead.'], 409);
        }
        $this->query($request, $type)->where('id', $id)->update([
            'deleted_at' => now(),
            'normalized_key' => hash('sha256', $record->normalized_key.'|deleted|'.$id),
            'updated_by' => $request->user()?->id,
            'updated_at' => now(),
        ]);
        return response()->json(['success' => true, 'message' => 'Master deleted safely.', 'data' => null]);
    }

    private function validated(Request $request, string $type, bool $updating = false): array
    {
        return $request->validate([
            'name' => [$updating ? 'sometimes' : 'required', 'string', 'max:160'],
            'code' => ['nullable', 'string', 'max:40'],
            'parent_id' => [in_array($type, ['models', 'variants'], true) ? ($updating ? 'sometimes' : 'required') : 'nullable', 'uuid'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
    }

    private function validateParent(Request $request, string $type, ?string $parentId): void
    {
        $parentType = ['models' => 'manufacturers', 'variants' => 'models'][$type] ?? null;
        if (! $parentType) return;
        $valid = $parentId && $this->query($request, $parentType)->where('id', $parentId)->exists();
        if (! $valid) throw ValidationException::withMessages(['parent_id' => [
            $type === 'models' ? 'Select a valid vehicle manufacturer.' : 'Select a valid vehicle model.',
        ]]);
    }

    private function ensureUnique(
        Request $request,
        string $type,
        string $name,
        ?string $parentId = null,
        ?string $except = null
    ): void
    {
        $query = $this->query($request, $type);
        $parentId ? $query->where('parent_id', $parentId) : $query->whereNull('parent_id');
        if ($except) $query->where('id', '<>', $except);
        $target = $this->resolver->matchingName($type, $name);
        if ($query->get()->contains(
            fn (object $master) => $this->resolver->matchingName($type, $master->name) === $target
        )) {
            throw ValidationException::withMessages(['name' => ['This master name already exists.']]);
        }
    }

    private function find(Request $request, string $type, string $id): object
    {
        return $this->query($request, $type)->where('id', $id)->firstOrFail();
    }

    private function query(Request $request, string $type)
    {
        return DB::table('vehicle_masters')->where('vehicle_masters.tenant_id', $this->tenant($request))
            ->where('vehicle_masters.type', $type)->whereNull('vehicle_masters.deleted_at');
    }

    private function type(string $type): string
    {
        abort_unless(in_array($type, self::TYPES, true), 404);
        return $type;
    }

    private function tenant(Request $request): string
    {
        return (string) $request->user()?->tenant_id;
    }

    private function authorize(Request $request, string $permission): void
    {
        abort_unless($request->user()?->can($permission), 403);
    }
}
