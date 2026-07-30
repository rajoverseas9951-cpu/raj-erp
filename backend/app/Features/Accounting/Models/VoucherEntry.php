<?php

namespace App\Features\Accounting\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class VoucherEntry extends Model
{
    use HasUuids;

    protected $table = 'accounting_voucher_entries';

    protected $fillable = [
        'tenant_id','voucher_id','ledger_id','entry_type','amount','description',
    ];

    protected $casts = ['amount' => 'decimal:2'];

    public function ledger()
    {
        return $this->belongsTo(Ledger::class, 'ledger_id');
    }

    public function voucher()
    {
        return $this->belongsTo(Voucher::class, 'voucher_id');
    }
}
