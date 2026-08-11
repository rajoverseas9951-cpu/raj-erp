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

export type InsuranceReportRow = {
  id:string; date:string; policy_number:string; vehicle_number:string; vehicle_type?:string;
  customer_name:string; mobile?:string; company_name:string; purchase_from:string; insurance_type:string;
  gross_premium:number; customer_pay:number; gross_commission:number; agent_commission:number;
  customer_discount:number; net_commission:number; status:string;
};

export type RtoReportRow = {
  id:string; module:string; work_type:string; date:string; vehicle_number:string; vehicle_type?:string;
  vehicle_class?:string; customer_name:string; mobile?:string; reference_number?:string; status?:string;
  billed:number; cost:number; profit:number;
};

export type CategoryRow = { module:string; work_count:number; billing:number; cost:number; profit:number };

export const businessReportsApi = {
  overview: (filters?:Record<string,string|undefined>) => authenticatedRequest<BusinessOverview>(`/reports/business/overview${qs(filters)}`),
  insurance: (filters?:Record<string,string|undefined>) => authenticatedRequest<{rows:InsuranceReportRow[];summary:Record<string,number>}>(`/reports/insurance${qs(filters)}`),
  insuranceCommission: (filters?:Record<string,string|undefined>) => authenticatedRequest<{rows:Array<Record<string,string|number>>;summary:Record<string,number>}>(`/reports/insurance-commission${qs(filters)}`),
  rtoWork: (filters?:Record<string,string|undefined>) => authenticatedRequest<{rows:RtoReportRow[];categories:CategoryRow[];summary:Record<string,number>}>(`/reports/rto-work${qs(filters)}`),
  rtoProfit: (filters?:Record<string,string|undefined>) => authenticatedRequest<{rows:CategoryRow[];summary:Record<string,number>}>(`/reports/rto-profit${qs(filters)}`),
};
