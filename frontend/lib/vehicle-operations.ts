import { authenticatedRequest } from '@/lib/api-client';
import {apiUrl} from '@/lib/api-url';
import {bearerRequestInit} from '@/lib/bearer-request';
import {vehicleInsuranceApi} from '@/lib/vehicle-insurance';

export type VehicleModule = 'vehicle_details'|'insurance'|'puc'|'fitness'|'permit'|'tax'|'counter_tax'|'hsrp'|'sld'|'vltd'|'renewal_registration'|'rto_process'|'transfer'|'payment'|'agent_payment'|'other_payment';
export type OperationDocument={id:string;original_name:string;mime_type:string;size_bytes:number};
export type OperationalRecord = Record<string, unknown> & {id:string; derived_status?:string;documents?:OperationDocument[]};
export type OperationalProfile = {
  applicability:{groups:Record<'core'|'compliance'|'operations'|'finance',VehicleModule[]>;classification:Record<string,boolean>};
  modules:Partial<Record<VehicleModule,{count:number;status:string;current?:OperationalRecord}>>;
  balances:{billed:number;received:number;outstanding:number};
};
export const moduleLabels:Record<VehicleModule,string>={vehicle_details:'Vehicle Details',insurance:'Insurance',puc:'PUC',fitness:'Fitness',permit:'Permit',tax:'Tax',counter_tax:'Counter Tax',hsrp:'HSRP',sld:'SLD',vltd:'VLTD',renewal_registration:'Renewal Registration',rto_process:'RTO Process',transfer:'Transfer Process',payment:'Payment Process',agent_payment:'Agent Payment',other_payment:'Other Payment'};

async function profileWithInsurance(vehicleId:string):Promise<OperationalProfile>{
 const fresh=Date.now();
 const [profile,policies]=await Promise.all([
  authenticatedRequest<OperationalProfile>(`/vehicles/${vehicleId}/operational-profile?_fresh=${fresh}`),
  vehicleInsuranceApi.list(vehicleId).catch(()=>[]),
 ]);
 const live=policies.filter(p=>!p.archived_at&&p.status!=='cancelled'&&p.status!=='expired').sort((a,b)=>String(b.expiry_date).localeCompare(String(a.expiry_date)));
 if(live.length){
  const current=live[0];
  const expiry=new Date(`${current.expiry_date}T23:59:59`);
  const days=Math.ceil((expiry.getTime()-Date.now())/86400000);
  profile.modules.insurance={count:live.length,status:days<0?'expired':days<=30?'expiring_soon':'valid',current:current as unknown as OperationalRecord};
 }else profile.modules.insurance={count:0,status:'not_added'};
 return profile;
}

const masterPath=(type:string)=>type==='fitness_center'?'/vehicle-masters/fitness_centers':`/vehicle-operation-masters/${type}`;

function normalizedOperationBody(module:VehicleModule,body:unknown):unknown{
 if(module!=='payment'||!body||typeof body!=='object'||Array.isArray(body))return body;
 const paymentBody=body as Record<string,unknown>;
 // PUC customer charge is a customer debit. The accounting endpoint only accepts Receive or Debit.
 if(paymentBody.payment_type==='PUC Bill')return{...paymentBody,payment_type:'Debit'};
 return body;
}

export const vehicleOperationsApi={
 profile:profileWithInsurance,
 list:(vehicleId:string,module:VehicleModule)=>authenticatedRequest<OperationalRecord[]>(`/vehicles/${vehicleId}/operations/${module}`),
 create:(vehicleId:string,module:VehicleModule,body:unknown)=>authenticatedRequest<OperationalRecord>(`/vehicles/${vehicleId}/operations/${module}`,{method:'POST',body:JSON.stringify(normalizedOperationBody(module,body))}),
 update:(vehicleId:string,module:VehicleModule,id:string,body:unknown)=>authenticatedRequest<OperationalRecord>(`/vehicles/${vehicleId}/operations/${module}/${id}`,{method:'PUT',body:JSON.stringify(normalizedOperationBody(module,body))}),
 remove:(vehicleId:string,module:VehicleModule,id:string)=>authenticatedRequest<null>(`/vehicles/${vehicleId}/operations/${module}/${id}`,{method:'DELETE'}),
 upload:(vehicleId:string,module:VehicleModule,id:string,document:File)=>{const body=new FormData();body.set('document',document);return authenticatedRequest(`/vehicles/${vehicleId}/operations/${module}/${id}/documents`,{method:'POST',body})},
 masters:(type:string)=>authenticatedRequest<{id:string;name:string}[]>(masterPath(type)),
 addMaster:(type:string,name:string)=>authenticatedRequest<{id:string;name:string}>(masterPath(type),{method:'POST',body:JSON.stringify({name})}),
 downloadDocument:async(vehicleId:string,document:OperationDocument)=>{const token=sessionStorage.getItem('raj_erp_token')??'';const response=await fetch(apiUrl(`/vehicles/${vehicleId}/operation-documents/${document.id}`),bearerRequestInit(token));if(!response.ok)throw new Error('Document could not be downloaded.');const blob=await response.blob();const url=URL.createObjectURL(blob);const link=window.document.createElement('a');link.href=url;link.download=document.original_name;link.click();URL.revokeObjectURL(url)},
};
export function operationHref(vehicleId:string,module:VehicleModule){
 if(module==='vehicle_details')return `/vehicles/${vehicleId}`;
 if(module==='insurance')return `/vehicles/${vehicleId}/insurance`;
 if(module==='renewal_registration')return `/vehicles/${vehicleId}/operations/rto_process?mode=renewal-registration`;
 return `/vehicles/${vehicleId}/operations/${module}`;
}