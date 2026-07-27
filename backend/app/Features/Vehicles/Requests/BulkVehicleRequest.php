<?php
namespace App\Features\Vehicles\Requests;
use Illuminate\Foundation\Http\FormRequest;
class BulkVehicleRequest extends FormRequest { public function authorize(): bool { return $this->user()?->can('vehicle.update') ?? false; } public function rules(): array { return ['ids'=>['required','array','min:1'],'ids.*'=>['uuid'],'updates'=>['sometimes','array'],'updates.insurance_status'=>['sometimes','in:not_added,active,expired,expiring_soon'],'updates.fitness_status'=>['sometimes','in:not_added,valid,expired,expiring_soon'],'updates.permit_status'=>['sometimes','in:not_added,valid,expired,expiring_soon'],'updates.tax_status'=>['sometimes','in:not_added,paid,due,overdue'],'updates.puc_status'=>['sometimes','in:not_added,valid,expired,expiring_soon']]; } }
