<?php

namespace App\Features\Accounting\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Voucher extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'accounting_vouchers';

    protected $fillable = [
        'tenant_id','voucher_number','voucher_type','voucher_date','reference_number',
        'narration','total_debit','total_credit','status','created_by','updated_by',
    ];

    protected $casts = [
        'voucher_date' => 'date:Y-m-d',
        'total_debit' => 'decimal:2',
        'total_credit' => 'decimal:2',
    ];

    public function entries()
    {
        return $this->hasMany(VoucherEntry::class, 'voucher_id');
    }
}
