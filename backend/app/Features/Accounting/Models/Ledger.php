<?php

namespace App\Features\Accounting\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Ledger extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = [
        'tenant_id','customer_id','ledger_name','ledger_group','opening_balance',
        'balance_type','credit_limit','credit_days','gst_applicable','status',
        'created_by','updated_by',
    ];

    protected $casts = [
        'opening_balance' => 'decimal:2',
        'credit_limit' => 'decimal:2',
        'credit_days' => 'integer',
        'gst_applicable' => 'boolean',
    ];
}
