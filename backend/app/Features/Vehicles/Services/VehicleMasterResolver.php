<?php

namespace App\Features\Vehicles\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class VehicleMasterResolver
{
    private const MIN_OCR_MASTER_CONFIDENCE = 0.40;

    private const FIELD_MAP = [
        'rto_offices' => ['registration_authority', 'rto_office_id'],
        'vehicle_types' => ['vehicle_type', 'vehicle_type_id'],
        'vehicle_classes' => ['vehicle_class', 'vehicle_class_id'],
        'body_types' => ['vehicle_category', 'vehicle_category_id'],
        'manufacturers' => ['manufacturer', 'manufacturer_id'],
        'models' => ['model', 'model_id'],
        'variants' => ['variant', 'variant_id'],
        'colours' => ['colour', 'colour_id'],
        'fuel_types' => ['fuel_type', 'fuel_type_id'],
    ];

    /**
     * @param  array<string, mixed>  $fields
     * @param  array<string, float>  $confidence
     * @return array{fields:array<string,mixed>,masters:array<string,array<string,mixed>>,matched:array<string,string>,created:array<string,string>,warnings:array<int,string>}
     */
    public function resolveOcrFields(
        array $fields,
        string $tenantId,
        ?string $actorId,
        array $confidence = []
    ): array {
        return DB::transaction(function () use ($fields, $tenantId, $actorId, $confidence) {
            $resolvedFields = $fields;
            $masters = [];
            $matched = [];
            $created = [];
            $warnings = [];
            $manufacturerId = null;
            $modelId = null;

            foreach (self::FIELD_MAP as $type => [$nameField, $idField]) {
                $name = trim((string) ($resolvedFields[$nameField] ?? ''));
                if ($name === '') {
                    continue;
                }
                $fieldConfidence = isset($confidence[$nameField])
                    ? (float) $confidence[$nameField]
                    : null;
                if (! $this->isValidOcrCandidate($type, $name, $fieldConfidence)) {
                    unset($resolvedFields[$idField]);
                    $warnings[] = "OCR {$nameField} was retained as text but was not auto-resolved.";
                    Log::debug('ocr.rc.master_skipped', [
                        'type' => $type,
                        'reason' => 'invalid_candidate',
                    ]);

                    continue;
                }

                $parentId = match ($type) {
                    'models' => $manufacturerId,
                    'variants' => $modelId,
                    default => null,
                };
                if (in_array($type, ['models', 'variants'], true) && ! $parentId) {
                    $warnings[] = "OCR {$nameField} was retained as text until its parent master resolves.";
                    Log::debug('ocr.rc.master_skipped', [
                        'type' => $type,
                        'reason' => 'missing_parent',
                    ]);

                    continue;
                }

                [$master, $wasCreated] = $this->resolveOne(
                    $tenantId,
                    $type,
                    $name,
                    $parentId,
                    $actorId
                );
                if (! $master) {
                    $warnings[] = "OCR {$nameField} was retained as text because master resolution failed.";
                    Log::warning('ocr.rc.master_resolution_failed', [
                        'type' => $type,
                    ]);

                    continue;
                }
                $resolvedFields[$idField] = $master->id;
                $masters[$type] = (array) $master;
                if ($wasCreated) {
                    $created[$type] = $master->id;
                } else {
                    $matched[$type] = $master->id;
                }

                if ($type === 'manufacturers') {
                    $manufacturerId = $master->id;
                }
                if ($type === 'models') {
                    $modelId = $master->id;
                }
            }

            Log::debug('ocr.rc.master_resolution', [
                'matched_master_ids' => $matched,
                'auto_created_master_ids' => $created,
                'low_confidence_fields' => array_keys(array_filter(
                    $confidence,
                    fn (float $value) => $value < 0.8
                )),
            ]);

            return compact('masters', 'matched', 'created', 'warnings') + [
                'fields' => $resolvedFields,
            ];
        });
    }

    public function normalizeName(string $value): string
    {
        $value = Str::ascii(Str::upper(trim($value)));

        return (string) preg_replace('/[^A-Z0-9]+/', '', $value);
    }

    public function matchingName(string $type, string $value): string
    {
        $upper = Str::ascii(Str::upper(trim($value)));
        $upper = str_replace('+', $type === 'models' ? ' PLUS ' : ' ', $upper);
        $upper = str_replace('GRAY', 'GREY', $upper);

        if ($type === 'manufacturers') {
            $upper = (string) preg_replace(
                '/\b(?:PRIVATE|PVT)\s+LIMITED\b|\bPVT\.?\s+LTD\.?\b|\bLIMITED\b|\bLTD\.?\b|\bINDIA\b/',
                ' ',
                $upper
            );
            $upper = (string) preg_replace('/\bMOTOR\s+COMPANY\b/', ' ', $upper);
        }
        if ($type === 'rto_offices') {
            $upper = (string) preg_replace('/^(?:RTO|ARTO)\s+/', '', $upper);
        }

        $normalized = (string) preg_replace('/[^A-Z0-9]+/', '', $upper);

        return match ($type) {
            'vehicle_types' => match (true) {
                preg_match('/^(?:TWOWHEELER|2WHEELER|MOTORCYCLE|SCOOTER)$/', $normalized) === 1 => 'TWOWHEELER',
                preg_match('/^(?:PRIVATECAR|MOTORCAR|LMV)$/', $normalized) === 1 => 'PRIVATECAR',
                default => $normalized,
            },
            default => $normalized,
        };
    }

    public function isValidOcrCandidate(
        string $type,
        string $value,
        ?float $confidence = null
    ): bool {
        if ($confidence !== null && $confidence < self::MIN_OCR_MASTER_CONFIDENCE) {
            return false;
        }

        $normalized = $this->matchingName($type, $value);
        if (strlen($normalized) < 2 || in_array($normalized, [
            'USED', 'NAME', 'TYPE', 'NUMBER', 'NO', 'NA', 'UNKNOWN',
            'FINANCIER', 'FINANCIERNAME', 'MAKER', 'MAKERSNAME',
            'MODEL', 'MODELNAME', 'BODYTYPE', 'VEHICLECLASS', 'FUELUSED',
        ], true)) {
            return false;
        }

        if ($type === 'fuel_types') {
            return in_array($normalized, [
                'PETROL', 'DIESEL', 'CNG', 'LPG', 'ELECTRIC', 'HYBRID',
                'PETROLCNG', 'PETROLLPG', 'HYDROGEN', 'FLEXFUEL',
            ], true);
        }

        return true;
    }

    public function normalizedKey(
        string $tenantId,
        string $type,
        string $name,
        ?string $parentId = null
    ): string {
        return hash('sha256', implode('|', [
            $tenantId,
            $type,
            $parentId ?: '',
            $this->matchingName($type, $name),
        ]));
    }

    /** @return array{0:object|null,1:bool} */
    private function resolveOne(
        string $tenantId,
        string $type,
        string $name,
        ?string $parentId,
        ?string $actorId
    ): array {
        $target = $this->matchingName($type, $name);
        $query = DB::table('vehicle_masters')
            ->where('tenant_id', $tenantId)
            ->where('type', $type)
            ->whereNull('deleted_at');
        $parentId ? $query->where('parent_id', $parentId) : $query->whereNull('parent_id');

        $existing = $query->get()->first(
            fn (object $master) => $this->matchingName($type, (string) $master->name) === $target
        );
        if ($existing) {
            if ($existing->status !== 'active') {
                DB::table('vehicle_masters')->where('id', $existing->id)->update([
                    'status' => 'active',
                    'updated_by' => $actorId,
                    'updated_at' => now(),
                ]);
                $existing->status = 'active';
            }

            return [$existing, false];
        }

        $id = (string) Str::uuid();
        $displayName = Str::upper(trim($name));
        $normalizedKey = $this->normalizedKey($tenantId, $type, $name, $parentId);
        DB::table('vehicle_masters')->insertOrIgnore([
            'id' => $id,
            'tenant_id' => $tenantId,
            'type' => $type,
            'name' => $displayName,
            'normalized_name' => $this->normalizeName($name),
            'normalized_key' => $normalizedKey,
            'parent_id' => $parentId,
            'status' => 'active',
            'source' => 'OCR',
            'created_by' => $actorId,
            'updated_by' => $actorId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $master = DB::table('vehicle_masters')
            ->where('normalized_key', $normalizedKey)
            ->whereNull('deleted_at')
            ->first();
        if (! $master) {
            return [null, false];
        }

        return [$master, $master->id === $id];
    }
}
