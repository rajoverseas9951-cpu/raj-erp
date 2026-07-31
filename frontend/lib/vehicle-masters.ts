'use client';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

export type VehicleMasterType = 'manufacturers'|'models'|'colours'|'vehicle_classes'|'body_types'|'fuel_types';
export type VehicleMaster = {
  id:string;
  type:VehicleMasterType;
  name:string;
  code?:string;
  parent_id?:string;
  parent_name?:string;
  status:'active'|'inactive';
  notes?:string;
};

async function request<T>(path:string, init?:RequestInit):Promise<T>{
  const token=sessionStorage.getItem('raj_erp_token');
  const response=await fetch(`${API}/api/v1${path}`,{
    ...init,
    headers:{Accept:'application/json','Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
    cache:'no-store',
  });
  const payload=await response.json().catch(()=>({})) as {data?:T;message?:string;errors?:Record<string,string[]>};
  if(!response.ok)throw new Error(Object.values(payload.errors??{})[0]?.[0]??payload.message??`Master request failed: ${response.status}`);
  return payload.data as T;
}

export const vehicleMasterApi={
  list:(type:VehicleMasterType)=>request<VehicleMaster[]>(`/vehicle-masters/${type}`),
  models:(manufacturerId:string)=>request<VehicleMaster[]>(`/vehicle-masters/models?manufacturer_id=${encodeURIComponent(manufacturerId)}&status=active`),
  create:(type:VehicleMasterType,body:Record<string,unknown>)=>request<VehicleMaster>(`/vehicle-masters/${type}`,{method:'POST',body:JSON.stringify(body)}),
  update:(type:VehicleMasterType,id:string,body:Record<string,unknown>)=>request<VehicleMaster>(`/vehicle-masters/${type}/${id}`,{method:'PUT',body:JSON.stringify(body)}),
};
