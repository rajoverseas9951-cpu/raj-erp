'use client';

export type Metric={value:number;growth:number};
export type DashboardSummary={
  kpis:Record<string,Metric>;
  revenue:{current:number;previous:number;outstanding:number;trend:{month:string;revenue:number}[]};
  policies:Record<string,number>; renewals:Record<string,number>; work:Record<string,number>;
  master_counts:Record<string,{total:number;active:number}>;
};
const API=process.env.NEXT_PUBLIC_API_URL??'http://127.0.0.1:8000';
export async function getDashboardSummary():Promise<DashboardSummary>{
  const token=sessionStorage.getItem('raj_erp_token');
  const response=await fetch(`${API}/api/v1/dashboard/summary`,{headers:{Accept:'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},cache:'no-store'});
  const payload=await response.json().catch(()=>({})) as {data?:DashboardSummary;message?:string};
  if(!response.ok||!payload.data)throw new Error(payload.message??`Dashboard request failed: ${response.status}`);
  return payload.data;
}
