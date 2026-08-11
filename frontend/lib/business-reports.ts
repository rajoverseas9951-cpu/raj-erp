'use client';

import { authenticatedRequest } from '@/lib/api-client';

function qs(filters?: Record<string,string|undefined>) {
  const p = new URLSearchParams();
  Object.entries(filters || {}).forEach(([k,v]) => { if (v) p.set(k,v); });
  const value = p.toString();
  return value ? `?${value}` : '';
}

export type BusinessOverview = {
  policy_count:number; insurance_premium:number; insurance_commission:number; insurance_profit:number;
  rto_work_count:number; rto_billing:number; rto_cost:number; rto_profit:number;
  rto_payment_received:number; total_business_profit:number;
};
export type ReportPayload = { rows:Array<Record<string,unknown>>; summary:Record<string,number>; categories?:Array<Record<string,unknown>> };

type ServicePayload = { rows:Array<Record<string,unknown>>; summary:{work_count:number;billing:number;cost:number;received:number;due:number;profit:number} };
const service = (type:'driving_licence'|'passport', filters?:Record<string,string|undefined>) => authenticatedRequest<ServicePayload>(`/service-works/${type}${qs(filters)}`);
const serviceAsRtoRows = (payload:ServicePayload, module:string) => payload.rows.map(row => ({
  id:row.id, module, work_type:row.work_type || module, date:row.work_date, vehicle_number:'—', vehicle_type:'—', vehicle_class:'—',
  customer_name:row.customer_name, mobile:row.mobile, reference_number:row.application_number, status:row.status,
  agent:null, broker:null, billed:Number(row.amount||0), cost:Number(row.cost||0), profit:Number(row.profit||0),
}));

async function combinedRto(filters?:Record<string,string|undefined>):Promise<ReportPayload>{
  const [base,dl,passport] = await Promise.all([
    authenticatedRequest<ReportPayload>(`/reports/rto-work${qs(filters)}`), service('driving_licence',filters), service('passport',filters)
  ]);
  const extra=[...serviceAsRtoRows(dl,'Driving Licence'),...serviceAsRtoRows(passport,'Passport')];
  const rows=[...base.rows,...extra];
  const categories=[...(base.categories||[]),
    {module:'Driving Licence',work_count:dl.summary.work_count,billing:dl.summary.billing,cost:dl.summary.cost,profit:dl.summary.profit},
    {module:'Passport',work_count:passport.summary.work_count,billing:passport.summary.billing,cost:passport.summary.cost,profit:passport.summary.profit},
  ].filter(row=>Number(row.work_count||0)>0);
  return {rows,categories,summary:{
    work_count:Number(base.summary.work_count||0)+dl.summary.work_count+passport.summary.work_count,
    billing:Number(base.summary.billing||0)+dl.summary.billing+passport.summary.billing,
    cost:Number(base.summary.cost||0)+dl.summary.cost+passport.summary.cost,
    profit:Number(base.summary.profit||0)+dl.summary.profit+passport.summary.profit,
    payment_received:Number(base.summary.payment_received||0)+dl.summary.received+passport.summary.received,
    payment_billed:Number(base.summary.payment_billed||0)+dl.summary.billing+passport.summary.billing,
  }};
}

export const businessReportsApi = {
  overview: async (filters?:Record<string,string|undefined>) => {
    const [base,rto]=await Promise.all([authenticatedRequest<BusinessOverview>(`/reports/business/overview${qs(filters)}`),combinedRto(filters)]);
    const backendRtoProfit=Number(base.rto_profit||0), mergedRtoProfit=Number(rto.summary.profit||0);
    return {...base,rto_work_count:Number(rto.summary.work_count||0),rto_billing:Number(rto.summary.billing||0),rto_cost:Number(rto.summary.cost||0),rto_profit:mergedRtoProfit,rto_payment_received:Number(rto.summary.payment_received||0),total_business_profit:Number(base.total_business_profit||0)-backendRtoProfit+mergedRtoProfit};
  },
  expiry: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/expiry${qs(filters)}`),
  agents: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/agents${qs(filters)}`),
  brokers: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/brokers${qs(filters)}`),
  insurance: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/insurance${qs(filters)}`),
  insuranceCommission: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/insurance-commission${qs(filters)}`),
  insuranceDue: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/insurance-due${qs(filters)}`),
  rtoWork: combinedRto,
  rtoProfit: async (filters?:Record<string,string|undefined>) => { const x=await combinedRto(filters); return {rows:x.categories||[],summary:x.summary}; },
  hsrp: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/hsrp${qs(filters)}`),
  vehicles: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/vehicles${qs(filters)}`),
  agentWork: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/agent-work${qs(filters)}`),
};
