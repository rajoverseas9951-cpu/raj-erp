<?php

namespace App\Features\Accounting\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClaimPolicyLookupController
{
    public function index(Request $request): JsonResponse
    {
        $tenant = (string) $request->user()?->tenant_id;
        $q = trim((string) $request->input('q', ''));
        $limit = min(250, max(20, (int) $request->input('limit', 120)));

        $motor = DB::table('vehicle_insurances as p')
            ->join('vehicles as v', function ($join) {
                $join->on('v.id', '=', 'p.vehicle_id')->on('v.tenant_id', '=', 'p.tenant_id');
            })
            ->leftJoin('customers as c', function ($join) {
                $join->on('c.id', '=', 'v.customer_id')->on('c.tenant_id', '=', 'v.tenant_id');
            })
            ->where('p.tenant_id', $tenant)
            ->whereNull('p.deleted_at')
            ->where('p.status', '<>', 'cancelled')
            ->when($q !== '', function ($query) use ($q) {
                $like = '%'.$q.'%';
                $query->where(function ($x) use ($like) {
                    $x->where('p.policy_number', 'like', $like)
                        ->orWhere('v.vehicle_number', 'like', $like)
                        ->orWhere('p.company_name', 'like', $like)
                        ->orWhere('c.mobile', 'like', $like)
                        ->orWhereRaw("TRIM(CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,''))) ILIKE ?", [$like]);
                });
            })
            ->orderByDesc('p.expiry_date')
            ->limit($limit)
            ->get([
                'p.id as policy_id','p.vehicle_id','p.policy_number','p.company_name as insurance_company',
                'p.business_channel','p.issue_date','p.expiry_date','p.status','v.vehicle_number as registration_number',
                'c.id as customer_id','c.first_name','c.last_name','c.mobile as customer_mobile',
            ])
            ->map(function ($row) {
                return [
                    'source' => 'motor',
                    'policy_id' => (string) $row->policy_id,
                    'vehicle_id' => (string) $row->vehicle_id,
                    'customer_id' => $row->customer_id ? (string) $row->customer_id : null,
                    'insurance_line' => 'motor',
                    'business_channel' => $row->business_channel ?: 'retail',
                    'policy_number' => $row->policy_number,
                    'insurance_company' => $row->insurance_company,
                    'customer_name' => trim(($row->first_name ?? '').' '.($row->last_name ?? '')) ?: 'Customer',
                    'customer_mobile' => $row->customer_mobile,
                    'registration_number' => $row->registration_number,
                    'issue_date' => $row->issue_date,
                    'expiry_date' => $row->expiry_date,
                    'status' => $row->status,
                ];
            });

        $other = DB::table('other_insurance_policies as p')
            ->leftJoin('customers as c', function ($join) {
                $join->on('c.id', '=', 'p.customer_id')->on('c.tenant_id', '=', 'p.tenant_id');
            })
            ->where('p.tenant_id', $tenant)
            ->whereNull('p.deleted_at')
            ->where('p.status', '<>', 'cancelled')
            ->when($q !== '', function ($query) use ($q) {
                $like = '%'.$q.'%';
                $query->where(function ($x) use ($like) {
                    $x->where('p.policy_number', 'like', $like)
                        ->orWhere('p.company_name', 'like', $like)
                        ->orWhere('p.customer_name', 'like', $like)
                        ->orWhere('p.mobile', 'like', $like)
                        ->orWhere('c.mobile', 'like', $like);
                });
            })
            ->orderByDesc('p.expiry_date')
            ->limit($limit)
            ->get([
                'p.id as policy_id','p.customer_id','p.insurance_line','p.business_channel','p.policy_number','p.company_name as insurance_company',
                'p.customer_name','p.mobile','p.issue_date','p.expiry_date','p.status','c.first_name','c.last_name','c.mobile as crm_mobile',
            ])
            ->map(function ($row) {
                $crmName = trim(($row->first_name ?? '').' '.($row->last_name ?? ''));
                return [
                    'source' => 'other',
                    'policy_id' => (string) $row->policy_id,
                    'vehicle_id' => null,
                    'customer_id' => $row->customer_id ? (string) $row->customer_id : null,
                    'insurance_line' => $row->insurance_line,
                    'business_channel' => $row->business_channel ?: 'retail',
                    'policy_number' => $row->policy_number,
                    'insurance_company' => $row->insurance_company,
                    'customer_name' => $row->customer_name ?: ($crmName ?: 'Customer'),
                    'customer_mobile' => $row->mobile ?: $row->crm_mobile,
                    'registration_number' => null,
                    'issue_date' => $row->issue_date,
                    'expiry_date' => $row->expiry_date,
                    'status' => $row->status,
                ];
            });

        $rows = $motor->concat($other)->sortByDesc(fn ($row) => (string) ($row['expiry_date'] ?? ''))->values()->take($limit)->values();
        return response()->json(['success' => true, 'data' => $rows]);
    }
}
