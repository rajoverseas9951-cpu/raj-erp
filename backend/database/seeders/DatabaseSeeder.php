<?php
namespace Database\Seeders;
use App\Models\User; use Illuminate\Database\Seeder;
class DatabaseSeeder extends Seeder { public function run(): void {User::updateOrCreate(['email'=>'admin@raj-erp.local'],['tenant_id'=>'00000000-0000-4000-8000-000000000001','name'=>'RAJ Administrator','password'=>'ChangeMe123!','permissions'=>['*']]);} }
