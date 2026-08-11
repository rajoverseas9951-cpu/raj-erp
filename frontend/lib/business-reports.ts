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

export const businessReportsApi = {
  overview: (filters?:Record<string,string|undefined>) => authenticatedRequest<BusinessOverview>(`/reports/business/overview${qs(filters)}`),
  expiry: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/expiry${qs(filters)}`),
  agents: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/agents${qs(filters)}`),
  brokers: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/brokers${qs(filters)}`),
  insurance: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/insurance${qs(filters)}`),
  insuranceCommission: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/insurance-commission${qs(filters)}`),
  insuranceDue: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/insurance-due${qs(filters)}`),
  rtoWork: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/rto-work${qs(filters)}`),
  rtoProfit: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/rto-profit${qs(filters)}`),
  hsrp: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/hsrp${qs(filters)}`),
  vehicles: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/vehicles${qs(filters)}`),
  agentWork: (filters?:Record<string,string|undefined>) => authenticatedRequest<ReportPayload>(`/reports/agent-work${qs(filters)}`),
};
