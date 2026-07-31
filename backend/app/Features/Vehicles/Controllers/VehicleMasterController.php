<?php

namespace App\Features\Vehicles\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class VehicleMasterController
{
    private const TYPES = ['manufacturers', 'models', 'colours', 'vehicle_classes', 'body_types', 'fuel_types'];

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

        return response()->json(['success' => true, 'data' => $query->orderBy('vehicle_masters.name')->get()]);
    }

    public function store(Request $request, string $type): JsonResponse
    {
        $type = $this->type($type);
        $this->authorize($request, 'vehicle.create');
        $data = $this->validated($request, $type);
        $this->ensureUnique($request, $type, $data['name']);
        $this->validateParent($request, $type, $data['parent_id'] ?? null);
        $id = (string) Str::uuid();
        DB::table('vehicle_masters')->insert([
            ...$data,
            'id' => $id,
            'tenant_id' => $this->tenant($request),
            'type' => $type,
            'name' => strtoupper(trim($data['name'])),
            'status' => $data['status'] ?? 'active',
            'created_by' => $request->user()?->id,
            'updated_by' => $request->user()?->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['success' => true, 'data' => $this->find($request, $type, $id)], 201);
    }

    public function update(Request $request, string $type, string $id): JsonResponse
    {
        $type = $this->type($type);
        $this->authorize($request, 'vehicle.update');
        $this->find($request, $type, $id);
        $data = $this->validated($request, $type, true);
        if (isset($data['name'])) $this->ensureUnique($request, $type, $data['name'], $id);
        if (array_key_exists('parent_id', $data)) $this->validateParent($request, $type, $data['parent_id']);
        if (isset($data['name'])) $data['name'] = strtoupper(trim($data['name']));
        DB::table('vehicle_masters')->where('id', $id)->update([
            ...$data,
            'updated_by' => $request->user()?->id,
            'updated_at' => now(),
        ]);

        return response()->json(['success' => true, 'data' => $this->find($request, $type, $id)]);
    }

    private function validated(Request $request, string $type, bool $updating = false): array
    {
        return $request->validate([
            'name' => [$updating ? 'sometimes' : 'required', 'string', 'max:160'],
            'code' => ['nullable', 'string', 'max:40'],
            'parent_id' => [$type === 'models' ? ($updating ? 'sometimes' : 'required') : 'nullable', 'uuid'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
    }

    private function validateParent(Request $request, string $type, ?string $parentId): void
    {
        if ($type !== 'models') return;
        $valid = $parentId && $this->query($request, 'manufacturers')->where('id', $parentId)->exists();
        if (! $valid) throw ValidationException::withMessages(['parent_id' => ['Select a valid vehicle manufacturer.']]);
    }

    private function ensureUnique(Request $request, string $type, string $name, ?string $except = null): void
    {
        $query = $this->query($request, $type)->whereRaw('LOWER(name) = ?', [strtolower(trim($name))]);
        if ($except) $query->where('id', '<>', $except);
        if ($query->exists()) throw ValidationException::withMessages(['name' => ['This master name already exists.']]);
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
