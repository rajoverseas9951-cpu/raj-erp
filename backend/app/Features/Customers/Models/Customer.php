<?php

namespace App\Features\Customers\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'tenant_id','customer_code','first_name','middle_name','last_name','mobile','alternate_mobile','whatsapp','email','date_of_birth','gender','photo_file_id',
        'aadhaar_number','pan_number','driving_licence_number','passport_number','voter_id','current_address','permanent_address','city','district','state','pincode',
        'occupation','company_name','gst_number','remarks','tags','priority','status','vehicles_count','insurance_policies_count','rto_files_count','assigned_to','created_by','updated_by',
    ];

    protected $casts = ['tags' => 'array', 'date_of_birth' => 'date'];

    public function documents(): HasMany { return $this->hasMany(CustomerDocument::class); }
    public function timelineEvents(): HasMany { return $this->hasMany(CustomerTimelineEvent::class)->latest(); }
}
