import { authenticatedRequest } from '@/lib/api-client';
import {apiUrl} from '@/lib/api-url';
import {bearerRequestInit} from '@/lib/bearer-request';

export type VehicleModule = 'vehicle_details'|'insurance'|'puc'|'fitness'|'permit'|'tax'|'counter_tax'|'hsrp'|'sld'|'vltd'|'rto_process'|'transfer'|'payment'|'agent_payment'|'other_payment';
export type OperationDocument={id:string;original_name:string;mime_type:string;size_bytes:number};
export type OperationalRecord = Record<string, unknown> & {id:string; derived_status?:string;documents?:OperationDocument[]};
export type OperationalProfile = {
  applicability:{groups:Record<'core'|'compliance'|'operations'|'finance',VehicleModule[]>;classification:Record<string,boolean>};
  modules:Partial<Record<VehicleModule,{count:number;status:string;current?:OperationalRecord}>>;
  balances:{billed:number;received:number;outstanding:number};
};
export const moduleLabels:Record<VehicleModule,string>={vehicle_details:'Vehicle Details',insurance:'Insurance',puc:'PUC',fitness:'Fitness',permit:'Permit',tax:'Tax',counter_tax:'Counter Tax',hsrp:'HSRP',sld:'SLD',vltd:'VLTD',rto_process:'RTO Process',transfer:'Transfer Process',payment:'Payment Process',agent_payment:'Agent Payment',other_payment:'Other Payment'};
export const vehicleOperationsApi={
 profile:(vehicleId:string)=>authenticatedRequest<OperationalProfile>(`/vehicles/${vehicleId}/operational-profile`),
 list:(vehicleId:string,module:VehicleModule)=>authenticatedRequest<OperationalRecord[]>(`/vehicles/${vehicleId}/operations/${module}`),
 create:(vehicleId:string,module:VehicleModule,body:unknown)=>authenticatedRequest<OperationalRecord>(`/vehicles/${vehicleId}/operations/${module}`,{method:'POST',body:JSON.stringify(body)}),
 update:(vehicleId:string,module:VehicleModule,id:string,body:unknown)=>authenticatedRequest<OperationalRecord>(`/vehicles/${vehicleId}/operations/${module}/${id}`,{method:'PUT',body:JSON.stringify(body)}),
 remove:(vehicleId:string,module:VehicleModule,id:string)=>authenticatedRequest<null>(`/vehicles/${vehicleId}/operations/${module}/${id}`,{method:'DELETE'}),
 upload:(vehicleId:string,module:VehicleModule,id:string,document:File)=>{const body=new FormData();body.set('document',document);return authenticatedRequest(`/vehicles/${vehicleId}/operations/${module}/${id}/documents`,{method:'POST',body})},
 masters:(type:string)=>authenticatedRequest<{id:string;name:string}[]>(`/vehicle-operation-masters/${type}`),
 addMaster:(type:string,name:string)=>authenticatedRequest<{id:string;name:string}>(`/vehicle-operation-masters/${type}`,{method:'POST',body:JSON.stringify({name})}),
 downloadDocument:async(vehicleId:string,document:OperationDocument)=>{const token=sessionStorage.getItem('raj_erp_token')??'';const response=await fetch(apiUrl(`/vehicles/${vehicleId}/operation-documents/${document.id}`),bearerRequestInit(token));if(!response.ok)throw new Error('Document could not be downloaded.');const blob=await response.blob();const url=URL.createObjectURL(blob);const link=window.document.createElement('a');link.href=url;link.download=document.original_name;link.click();URL.revokeObjectURL(url)},
};
export function operationHref(vehicleId:string,module:VehicleModule){
 if(module==='vehicle_details')return `/vehicles/${vehicleId}`;
 if(module==='insurance')return `/vehicles/${vehicleId}/insurance`;
 return `/vehicles/${vehicleId}/operations/${module}`;
}
