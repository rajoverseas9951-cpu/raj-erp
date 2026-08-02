'use client';

import { apiUrl } from '@/lib/api-url';

export type Metric={value:number;growth:number|null};
export type DashboardSummary={
  kpis:Record<string,Metric>;
  revenue:{current:number;previous:number;expenses:number;net_result:number;outstanding:number;trend:{month:string;revenue:number;expenses:number}[]};
  policies:Record<string,number>; renewals:Record<string,number>; work:Record<string,number>;
  master_counts:Record<string,{total:number;active:number}>;
};
export async function getDashboardSummary():Promise<DashboardSummary>{
  const token=sessionStorage.getItem('raj_erp_token');
  if(!token)throw new Error('AUTH_REQUIRED');
  const response=await fetch(apiUrl('/dashboard/summary'),{headers:{Accept:'application/json',Authorization:`Bearer ${token}`,'Cache-Control':'no-cache'},cache:'no-store'});
  const payload=await response.json().catch(()=>({})) as {data?:DashboardSummary;message?:string};
  if(response.status===401)throw new Error('AUTH_REQUIRED');
  if(!response.ok||!payload.data){
    console.error('Dashboard summary request failed',response.status);
    throw new Error(response.status>=500?'Dashboard data is temporarily unavailable. Please refresh once.':payload.message??`Dashboard request failed: ${response.status}`);
  }
  return payload.data;
}
