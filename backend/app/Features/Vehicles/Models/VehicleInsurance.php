<?php

namespace App\Features\Vehicles\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class VehicleInsurance extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'vehicle_id', 'insurance_company_id', 'company_name', 'company_code',
        'purchase_from', 'policy_number', 'policy_date', 'issue_date', 'expiry_date',
        'status', 'insurance_type', 'remark', 'od_premium', 'tp_premium', 'addon_premium',
        'gst_other_charges', 'gross_premium', 'commission_percent', 'gross_commission',
        'customer_discount', 'customer_pay', 'agent', 'agent_commission', 'payment_details',
        'policy_document_file_id', 'has_od_cover', 'has_tp_cover', 'net_premium',
        'tp_net_premium', 'commission_on_od', 'commission_on_tp', 'commission_on_net',
        'commission_on_addon', 'od_commission_percent', 'tp_commission_percent',
        'od_commission_amount', 'tp_commission_amount', 'long_term_tp_policy_number',
        'long_term_tp_expiry',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'policy_date' => 'date:Y-m-d',
            'issue_date' => 'date:Y-m-d',
            'expiry_date' => 'date:Y-m-d',
            'od_premium' => 'decimal:2',
            'tp_premium' => 'decimal:2',
            'addon_premium' => 'decimal:2',
            'gst_other_charges' => 'decimal:2',
            'gross_premium' => 'decimal:2',
            'commission_percent' => 'decimal:3',
            'gross_commission' => 'decimal:2',
            'customer_discount' => 'decimal:2',
            'customer_pay' => 'decimal:2',
            'agent_commission' => 'decimal:2',
            'net_premium' => 'decimal:2',
            'tp_net_premium' => 'decimal:2',
            'has_od_cover' => 'boolean',
            'has_tp_cover' => 'boolean',
            'commission_on_od' => 'boolean',
            'commission_on_tp' => 'boolean',
            'commission_on_net' => 'boolean',
            'commission_on_addon' => 'boolean',
            'od_commission_percent' => 'decimal:3',
            'tp_commission_percent' => 'decimal:3',
            'od_commission_amount' => 'decimal:2',
            'tp_commission_amount' => 'decimal:2',
            'long_term_tp_expiry' => 'date:Y-m-d',
            'payment_details' => 'array',
        ];
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }
}
