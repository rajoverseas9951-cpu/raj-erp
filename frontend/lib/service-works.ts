'use client';

import { authenticatedRequest } from '@/lib/api-client';
import { invalidateDashboard } from '@/lib/dashboard-refresh';

export type ServiceType='driving_licence'|'passport';
export type ServiceWork={id:string;service_type:ServiceType;work_type?:string;application_number?:string;work_date?:string;customer_id?:string;customer_name:string;mobile?:string;amount:number;cost:number;received_amount:number;due_amount:number;profit:number;status:string;notes?:string};
export type ServicePayload={rows:ServiceWork[];summary:{work_count:number;billing:number;cost:number;received:number;due:number;profit:number}};

export const serviceWorksApi={
  list:(type:ServiceType,q='')=>authenticatedRequest<ServicePayload>(`/service-works/${type}${q}`),
  create:async(type:ServiceType,body:Record<string,unknown>)=>{const x=await authenticatedRequest(`/service-works/${type}`,{method:'POST',body:JSON.stringify(body)});invalidateDashboard();return x;},
  update:async(type:ServiceType,id:string,body:Record<string,unknown>)=>{const x=await authenticatedRequest(`/service-works/${type}/${id}`,{method:'PUT',body:JSON.stringify(body)});invalidateDashboard();return x;},
  remove:async(type:ServiceType,id:string)=>{const x=await authenticatedRequest(`/service-works/${type}/${id}`,{method:'DELETE'});invalidateDashboard();return x;},
};
