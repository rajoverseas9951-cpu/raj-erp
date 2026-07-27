<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory; use Illuminate\Support\Str;
class UserFactory extends Factory { public function definition():array{return ['tenant_id'=>(string)Str::uuid(),'name'=>fake()->name(),'email'=>fake()->unique()->safeEmail(),'email_verified_at'=>now(),'password'=>'password12345A','is_admin'=>false,'is_active'=>true,'remember_token'=>Str::random(10)];} }
