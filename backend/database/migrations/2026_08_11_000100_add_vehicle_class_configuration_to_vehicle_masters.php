<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicle_masters', function (Blueprint $table): void {
            if (! Schema::hasColumn('vehicle_masters', 'transport_kind')) {
                $table->string('transport_kind', 30)->nullable()->index();
            }
            if (! Schema::hasColumn('vehicle_masters', 'module_rules')) {
                $table->json('module_rules')->nullable();
            }
        });

        $tenants = DB::table('vehicle_masters')->distinct()->pluck('tenant_id')
            ->merge(DB::table('vehicles')->distinct()->pluck('tenant_id'))->filter()->unique();

        $types = [
            ['TWO WHEELER','two_wheeler'], ['PRIVATE CAR','private_car'], ['THREE WHEELER','three_wheeler'],
            ['LGV / LIGHT GOODS VEHICLE','lgv'], ['TAXI / MOTOR CAB','taxi'], ['HGV / HEAVY GOODS VEHICLE','hgv'],
            ['BUS','bus'], ['AMBULANCE','ambulance'], ['TRACTOR','tractor'], ['OTHER TRANSPORT','transport'],
            ['OTHER NON-TRANSPORT','non_transport'],
        ];

        $base = ['insurance'=>'required','puc'=>'required','hsrp'=>'required','rto_process'=>'required','payment'=>'required'];
        $classes = [
            ['MCWOG','MCWOG','two_wheeler','non_transport',[]],
            ['MCWG','MCWG','two_wheeler','non_transport',[]],
            ['MOTOR CYCLE','MOTORCYCLE','two_wheeler','non_transport',[]],
            ['MOTOR CAR','MOTORCAR','private_car','non_transport',[]],
            ['LMV - NON TRANSPORT','LMV-NT','private_car','non_transport',[]],
            ['THREE WHEELER - NON TRANSPORT','3W-NT','three_wheeler','non_transport',[]],
            ['THREE WHEELER - TRANSPORT','3W-TR','three_wheeler','transport',['fitness'=>'required','permit'=>'required']],
            ['LIGHT GOODS VEHICLE','LGV','lgv','transport',['fitness'=>'required']],
            ['LIGHT COMMERCIAL VEHICLE','LCV','lgv','transport',['fitness'=>'required']],
            ['MOTOR CAB','MOTORCAB','taxi','transport',['fitness'=>'required','permit'=>'required','sld'=>'required','vltd'=>'required','tax'=>'optional']],
            ['MAXI CAB','MAXICAB','taxi','transport',['fitness'=>'required','permit'=>'required','sld'=>'required','vltd'=>'required','tax'=>'optional']],
            ['LIGHT PASSENGER VEHICLE','LPV','taxi','transport',['fitness'=>'required','permit'=>'required','sld'=>'required','vltd'=>'required','tax'=>'optional']],
            ['HEAVY GOODS VEHICLE','HGV','hgv','transport',['fitness'=>'required','permit'=>'required','sld'=>'required','vltd'=>'required','tax'=>'required']],
            ['HEAVY GOODS VEHICLE / TRUCK','HGVT','hgv','transport',['fitness'=>'required','permit'=>'required','sld'=>'required','vltd'=>'required','tax'=>'required']],
            ['GOODS TRANSPORT VEHICLE','GT','hgv','transport',['fitness'=>'required','permit'=>'required','sld'=>'required','vltd'=>'required','tax'=>'required']],
            ['BUS','BUS','bus','transport',['fitness'=>'required','permit'=>'required','sld'=>'required','vltd'=>'required','tax'=>'required']],
            ['OMNIBUS','OMNIBUS','bus','transport',['fitness'=>'required','permit'=>'required','sld'=>'required','vltd'=>'required','tax'=>'required']],
            ['SCHOOL BUS','SCHOOLBUS','bus','transport',['fitness'=>'required','permit'=>'required','sld'=>'required','vltd'=>'required','tax'=>'required']],
            ['AMBULANCE','AMBULANCE','ambulance','transport',['fitness'=>'required','permit'=>'required','sld'=>'required','vltd'=>'required','tax'=>'required']],
            ['TRACTOR - NON TRANSPORT','TRACTOR-NT','tractor','non_transport',[]],
            ['TRACTOR - TRANSPORT','TRACTOR-TR','tractor','transport',['fitness'=>'required','permit'=>'required','tax'=>'required']],
        ];

        foreach ($tenants as $tenant) {
            $typeIds = [];
            foreach ($types as [$name,$code]) {
                $existing = DB::table('vehicle_masters')->where('tenant_id',$tenant)->where('type','vehicle_types')
                    ->whereRaw('LOWER(code) = ?', [strtolower($code)])->whereNull('deleted_at')->first();
                $id = $existing?->id ?? (string) Str::uuid();
                if (! $existing) DB::table('vehicle_masters')->insert([
                    'id'=>$id,'tenant_id'=>$tenant,'type'=>'vehicle_types','name'=>$name,'code'=>$code,'status'=>'active',
                    'normalized_name'=>preg_replace('/[^A-Z0-9]+/','',strtoupper($name)),
                    'normalized_key'=>hash('sha256',$tenant.'|vehicle_types||'.preg_replace('/[^A-Z0-9]+/','',strtoupper($name))),
                    'created_at'=>now(),'updated_at'=>now(),
                ]);
                else DB::table('vehicle_masters')->where('id',$id)->update(['name'=>$name,'status'=>'active','updated_at'=>now()]);
                $typeIds[$code] = $id;
            }

            DB::table('vehicle_masters')->where('tenant_id',$tenant)->where('type','vehicle_types')
                ->whereNotIn('id',array_values($typeIds))->whereNull('deleted_at')->update(['status'=>'inactive','updated_at'=>now()]);

            $classIds = [];
            foreach ($classes as [$name,$code,$typeCode,$kind,$extra]) {
                $rules = array_merge([
                    'insurance'=>'na','puc'=>'na','hsrp'=>'na','fitness'=>'na','permit'=>'na','tax'=>'na','sld'=>'na','vltd'=>'na','rto_process'=>'na','payment'=>'na'
                ], $base, $extra);
                $existing = DB::table('vehicle_masters')->where('tenant_id',$tenant)->where('type','vehicle_classes')
                    ->whereRaw('LOWER(code) = ?', [strtolower($code)])->whereNull('deleted_at')->first();
                $id = $existing?->id ?? (string) Str::uuid();
                $payload = [
                    'name'=>$name,'code'=>$code,'parent_id'=>$typeIds[$typeCode] ?? null,'transport_kind'=>$kind,
                    'module_rules'=>json_encode($rules),'status'=>'active','updated_at'=>now(),
                ];
                if ($existing) DB::table('vehicle_masters')->where('id',$id)->update($payload);
                else DB::table('vehicle_masters')->insert(array_merge($payload,[
                    'id'=>$id,'tenant_id'=>$tenant,'type'=>'vehicle_classes',
                    'normalized_name'=>preg_replace('/[^A-Z0-9]+/','',strtoupper($name)),
                    'normalized_key'=>hash('sha256',$tenant.'|vehicle_classes|'.($typeIds[$typeCode] ?? '').'|'.preg_replace('/[^A-Z0-9]+/','',strtoupper($name))),
                    'created_at'=>now(),
                ]));
                $classIds[] = $id;
            }
            DB::table('vehicle_masters')->where('tenant_id',$tenant)->where('type','vehicle_classes')
                ->whereNotIn('id',$classIds)->whereNull('deleted_at')->update(['status'=>'inactive','updated_at'=>now()]);
        }
    }

    public function down(): void
    {
        Schema::table('vehicle_masters', function (Blueprint $table): void {
            if (Schema::hasColumn('vehicle_masters','module_rules')) $table->dropColumn('module_rules');
            if (Schema::hasColumn('vehicle_masters','transport_kind')) $table->dropColumn('transport_kind');
        });
    }
};
