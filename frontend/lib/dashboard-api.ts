'use client';

import { apiUrl } from '@/lib/api-url';
import { dashboardQuery } from '@/lib/dashboard-periods';

export type Metric={value:number;growth:number|null};
export type DashboardSummary={
  kpis:Record<string,Metric>;
  period:{key:DashboardPeriod;from:string|null;to:string;timezone:string};
  revenue:{current:number;previous:number;company_cost:number;gross_profit:number;tds:number;agent_commission:number;expenses:number;net_result:number;outstanding:number;trend:{month:string;revenue:number;expenses:number}[]};
  policies:Record<string,number>; renewals:Record<string,number>; work:Record<string,number>;
  master_counts:Record<string,{total:number;active:number}>;
};
export type DashboardPeriod='today'|'yesterday'|'this_week'|'this_month'|'last_month'|'this_year'|'custom'|'all_time';
export type DashboardFilters={period:DashboardPeriod;dateFrom?:string;dateTo?:string};
export async function getDashboardSummary(filters:DashboardFilters={period:'today'},signal?:AbortSignal):Promise<DashboardSummary>{
  const token=sessionStorage.getItem('raj_erp_token');
  if(!token)throw new Error('AUTH_REQUIRED');
  const query=dashboardQuery(filters);
  const response=await fetch(apiUrl(`/dashboard/summary?${query}`),{headers:{Accept:'application/json',Authorization:`Bearer ${token}`,'Cache-Control':'no-cache'},cache:'no-store',signal});
  const payload=await response.json().catch(()=>({})) as {data?:DashboardSummary;message?:string};
  if(response.status===401)throw new Error('AUTH_REQUIRED');
  if(!response.ok||!payload.data){
    console.error('Dashboard summary request failed',response.status);
    throw new Error(response.status>=500?'Dashboard data is temporarily unavailable. Please refresh once.':payload.message??`Dashboard request failed: ${response.status}`);
  }
  return payload.data;
}
