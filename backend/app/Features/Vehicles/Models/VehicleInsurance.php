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
            'payment_details' => 'array',
        ];
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }
}
