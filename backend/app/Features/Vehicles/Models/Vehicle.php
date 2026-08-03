<?php
namespace App\Features\Vehicles\Models;
use App\Features\Customers\Models\Customer;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
class Vehicle extends Model { use HasFactory, HasUuids, SoftDeletes;
protected $fillable=['tenant_id','customer_id','vehicle_number','registration_date','registration_valid_upto','registration_authority','rto_office_id','state','district','vehicle_class','vehicle_category','vehicle_type','manufacturer','model','variant','manufacturing_year','manufacturing_month','colour','fuel_type','manufacturer_id','model_id','variant_id','colour_id','vehicle_class_id','vehicle_category_id','vehicle_type_id','fuel_type_id','seating_capacity','cubic_capacity','gross_weight','unladen_weight','number_of_cylinders','emission_norms','horse_power','wheel_base','chassis_number','engine_number','hypothecation','financier','insurance_status','fitness_status','permit_status','tax_status','puc_status','insurance_expiry','puc_expiry','fitness_expiry','permit_expiry','national_permit_expiry','tax_expiry','counter_tax_expiry','payment_due','archived_at','archived_by','created_by','updated_by'];
protected $casts=['registration_date'=>'date','registration_valid_upto'=>'date','insurance_expiry'=>'date','fitness_expiry'=>'date','permit_expiry'=>'date','national_permit_expiry'=>'date','tax_expiry'=>'date','counter_tax_expiry'=>'date','archived_at'=>'datetime','payment_due'=>'decimal:2','cubic_capacity'=>'decimal:2','horse_power'=>'decimal:2','manufacturing_month'=>'integer','number_of_cylinders'=>'integer','wheel_base'=>'integer','hypothecation'=>'boolean'];
public function customer(): BelongsTo { return $this->belongsTo(Customer::class);
} public function documents(): HasMany { return $this->hasMany(VehicleDocument::class);
} public function timelineEvents(): HasMany { return $this->hasMany(VehicleTimelineEvent::class)->latest();
} public function insurances(): HasMany { return $this->hasMany(VehicleInsurance::class);
} public function rtoFiles(): HasMany { return $this->hasMany(VehicleRtoFile::class);
} }
