import {authenticatedRequest} from '@/lib/api-client';

export type Fleet={id:string;fleet_code:string;fleet_name:string;business_name?:string|null;primary_customer_id?:string|null;primary_customer?:string|null;fleet_type:string;contact_person?:string|null;mobile?:string|null;gst_number?:string|null;credit_allowed:boolean;credit_limit:number;status:string;vehicle_count:number;compliance_attention:number};
export type FleetDetail={fleet:Fleet;summary:{vehicles:number;attention:number;outstanding:number;insurance_due:number;puc_due:number;fitness_due:number;permit_due:number;tax_due:number};vehicles:Array<{id:string;vehicle_number:string;vehicle_type?:string;insurance_status:string;insurance_expiry?:string;puc_status:string;puc_expiry?:string;fitness_status:string;fitness_expiry?:string;permit_status:string;permit_expiry?:string;tax_status:string;tax_expiry?:string;payment_due:number;attention:string[]}>};
export const fleetApi={
 list:(q='')=>authenticatedRequest<Fleet[]>(`/fleets${q}`),
 get:(id:string)=>authenticatedRequest<FleetDetail>(`/fleets/${id}`),
 create:(body:unknown)=>authenticatedRequest<{id:string;fleet_code:string}>('/fleets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
 update:(id:string,body:unknown)=>authenticatedRequest<null>(`/fleets/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
 remove:(id:string)=>authenticatedRequest<null>(`/fleets/${id}`,{method:'DELETE'}),
};
