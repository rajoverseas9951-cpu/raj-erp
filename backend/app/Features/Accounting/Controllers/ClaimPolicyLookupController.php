<?php

namespace App\Features\Accounting\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Throwable;

class ClaimPolicyLookupController
{
    public function index(Request $request): JsonResponse
    {
        try {
            $tenant = (string) $request->user()?->tenant_id;
            $q = trim((string) $request->input('q', ''));
            $limit = min(250, max(20, (int) $request->input('limit', 120)));
            $rows = collect();
            $warnings = [];

            if ($tenant === '') {
                return response()->json(['success' => true, 'data' => [], 'warnings' => ['tenant']]);
            }

            if (Schema::hasTable('vehicle_insurances') && Schema::hasTable('vehicles')) {
                try {
                    $rows = $rows->concat($this->motorPolicies($tenant, $q, $limit));
                } catch (Throwable $e) {
                    $this->logLookupFailure('motor', $tenant, $e);
                    $warnings[] = 'motor';
                }
            }

            if (Schema::hasTable('other_insurance_policies')) {
                try {
                    $rows = $rows->concat($this->otherPolicies($tenant, $q, $limit));
                } catch (Throwable $e) {
                    $this->logLookupFailure('other', $tenant, $e);
                    $warnings[] = 'other';
                }
            }

            $rows = $rows
                ->sortByDesc(fn ($row) => (string) ($row['expiry_date'] ?? ''))
                ->values()
                ->take($limit)
                ->values();

            return response()->json([
                'success' => true,
                'data' => $rows,
                'warnings' => array_values(array_unique($warnings)),
            ]);
        } catch (Throwable $e) {
            Log::error('Claim policy lookup failed safely', [
                'tenant_id' => (string) $request->user()?->tenant_id,
                'type' => $e::class,
                'message' => $e->getMessage(),
            ]);

            // Claim creation must remain usable even if policy lookup has an unexpected issue.
            return response()->json([
                'success' => true,
                'data' => [],
                'warnings' => ['lookup'],
            ]);
        }
    }

    private function logLookupFailure(string $source, string $tenant, Throwable $e): void
    {
        Log::warning("Claim policy lookup source unavailable: {$source}", [
            'tenant_id' => $tenant,
            'type' => $e::class,
            'message' => $e->getMessage(),
        ]);
    }

    private function motorPolicies(string $tenant, string $q, int $limit)
    {
        $hasChannel = Schema::hasColumn('vehicle_insurances', 'business_channel');
        $hasCustomers = Schema::hasTable('customers');

        $query = DB::table('vehicle_insurances as p')
            ->join('vehicles as v', function ($join) {
                $join->on('v.id', '=', 'p.vehicle_id')
                    ->on('v.tenant_id', '=', 'p.tenant_id');
            });

        if ($hasCustomers) {
            $query->leftJoin('customers as c', function ($join) {
                $join->on('c.id', '=', 'v.customer_id')
                    ->on('c.tenant_id', '=', 'v.tenant_id');
            });
        }

        $query->where('p.tenant_id', $tenant)
            ->whereNull('p.deleted_at')
            ->where('p.status', '<>', 'cancelled');

        if ($q !== '') {
            $like = '%'.$q.'%';
            $query->where(function ($x) use ($like, $hasCustomers) {
                $x->where('p.policy_number', 'like', $like)
                    ->orWhere('v.vehicle_number', 'like', $like)
                    ->orWhere('p.company_name', 'like', $like);
                if ($hasCustomers) {
                    $x->orWhere('c.mobile', 'like', $like)
                        ->orWhereRaw("TRIM(CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,''))) ILIKE ?", [$like]);
                }
            });
        }

        $select = [
            'p.id as policy_id',
            'p.vehicle_id',
            'p.policy_number',
            'p.company_name as insurance_company',
            'p.issue_date',
            'p.expiry_date',
            'p.status',
            'v.vehicle_number as registration_number',
            'v.customer_id as customer_id',
        ];
        $select[] = $hasChannel ? 'p.business_channel' : DB::raw("'retail' as business_channel");

        if ($hasCustomers) {
            $select[] = 'c.first_name';
            $select[] = 'c.last_name';
            $select[] = 'c.mobile as customer_mobile';
        } else {
            $select[] = DB::raw("'' as first_name");
            $select[] = DB::raw("'' as last_name");
            $select[] = DB::raw('NULL as customer_mobile');
        }

        return $query
            ->orderByDesc('p.expiry_date')
            ->limit($limit)
            ->get($select)
            ->map(fn ($row) => [
                'source' => 'motor',
                'policy_id' => (string) $row->policy_id,
                'vehicle_id' => (string) $row->vehicle_id,
                'customer_id' => $row->customer_id ? (string) $row->customer_id : null,
                'insurance_line' => 'motor',
                'business_channel' => $row->business_channel ?: 'retail',
                'policy_number' => (string) $row->policy_number,
                'insurance_company' => $row->insurance_company,
                'customer_name' => trim(($row->first_name ?? '').' '.($row->last_name ?? '')) ?: 'Customer',
                'customer_mobile' => $row->customer_mobile ?? null,
                'registration_number' => $row->registration_number,
                'issue_date' => $row->issue_date,
                'expiry_date' => $row->expiry_date,
                'status' => $row->status,
            ]);
    }

    private function otherPolicies(string $tenant, string $q, int $limit)
    {
        $hasChannel = Schema::hasColumn('other_insurance_policies', 'business_channel');
        $hasCustomers = Schema::hasTable('customers');

        $query = DB::table('other_insurance_policies as p');
        if ($hasCustomers) {
            $query->leftJoin('customers as c', function ($join) {
                $join->on('c.id', '=', 'p.customer_id')
                    ->on('c.tenant_id', '=', 'p.tenant_id');
            });
        }

        $query->where('p.tenant_id', $tenant)
            ->whereNull('p.deleted_at')
            ->where('p.status', '<>', 'cancelled');

        if ($q !== '') {
            $like = '%'.$q.'%';
            $query->where(function ($x) use ($like, $hasCustomers) {
                $x->where('p.policy_number', 'like', $like)
                    ->orWhere('p.company_name', 'like', $like)
                    ->orWhere('p.customer_name', 'like', $like)
                    ->orWhere('p.mobile', 'like', $like);
                if ($hasCustomers) {
                    $x->orWhere('c.mobile', 'like', $like);
                }
            });
        }

        $select = [
            'p.id as policy_id',
            'p.customer_id',
            'p.insurance_line',
            'p.policy_number',
            'p.company_name as insurance_company',
            'p.customer_name',
            'p.mobile',
            'p.issue_date',
            'p.expiry_date',
            'p.status',
        ];
        $select[] = $hasChannel ? 'p.business_channel' : DB::raw("'retail' as business_channel");

        if ($hasCustomers) {
            $select[] = 'c.first_name';
            $select[] = 'c.last_name';
            $select[] = 'c.mobile as crm_mobile';
        } else {
            $select[] = DB::raw("'' as first_name");
            $select[] = DB::raw("'' as last_name");
            $select[] = DB::raw('NULL as crm_mobile');
        }

        return $query
            ->orderByDesc('p.expiry_date')
            ->limit($limit)
            ->get($select)
            ->map(function ($row) {
                $crmName = trim(($row->first_name ?? '').' '.($row->last_name ?? ''));
                return [
                    'source' => 'other',
                    'policy_id' => (string) $row->policy_id,
                    'vehicle_id' => null,
                    'customer_id' => $row->customer_id ? (string) $row->customer_id : null,
                    'insurance_line' => (string) $row->insurance_line,
                    'business_channel' => $row->business_channel ?: 'retail',
                    'policy_number' => (string) ($row->policy_number ?? ''),
                    'insurance_company' => $row->insurance_company,
                    'customer_name' => $row->customer_name ?: ($crmName ?: 'Customer'),
                    'customer_mobile' => $row->mobile ?: ($row->crm_mobile ?? null),
                    'registration_number' => null,
                    'issue_date' => $row->issue_date,
                    'expiry_date' => $row->expiry_date,
                    'status' => $row->status,
                ];
            });
    }
}
