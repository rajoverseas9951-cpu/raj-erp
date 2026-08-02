'use client';

import { authenticatedRequest } from '@/lib/api-client';
import { invalidateDashboard } from '@/lib/dashboard-refresh';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const result = await authenticatedRequest<T>(path, init);
  if (init?.method && init.method !== 'GET') invalidateDashboard();
  return result;
}

export type InsuranceCompany = { id:string; company_name:string; short_code?:string; agency_code_name?:string; default_commission_percent:number; tds_percent:number; settlement_days:number; gst_number?:string; pan_number?:string; contact_person?:string; mobile?:string; email?:string; notes?:string; status:string };
export type PurchaseSource = { id:string; name:string; source_type:string; mobile?:string; email?:string; linked_company_id?:string; tds_applicable:boolean; tds_percent:number; is_active:boolean; notes?:string };
export type CommissionRow = { id:string; company_name:string; statement_date:string; policy_number?:string; customer_name?:string; gross_premium:number; gross_commission:number; tds_amount:number; net_receivable:number; received_amount:number; status:string };
export type CommissionSummary = { gross_commission:number; tds_receivable:number; net_receivable:number; received:number; outstanding:number };
export type MasterPage<T> = { data:T[]; current_page:number; last_page:number; per_page:number; total:number };

export const insuranceAccountingApi = {
  companies: () => request<InsuranceCompany[]>('/insurance-accounting/companies'),
  companyPage: (page:number, search='') => request<MasterPage<InsuranceCompany>>(`/insurance-accounting/companies?paginate=1&per_page=20&page=${page}&search=${encodeURIComponent(search)}`),
  addCompany: (body: Record<string, unknown>) => request<InsuranceCompany>('/insurance-accounting/companies', { method:'POST', body:JSON.stringify(body) }),
  updateCompany: (id:string, body:Record<string,unknown>) => request<InsuranceCompany>(`/insurance-accounting/companies/${id}`, {method:'PUT',body:JSON.stringify(body)}),
  removeCompany: (id:string) => request<null>(`/insurance-accounting/companies/${id}`, {method:'DELETE'}),
  purchaseSources: () => request<PurchaseSource[]>('/insurance-accounting/purchase-sources'),
  purchaseSourcePage: (page:number, search='') => request<MasterPage<PurchaseSource>>(`/insurance-accounting/purchase-sources?paginate=1&per_page=20&page=${page}&search=${encodeURIComponent(search)}`),
  addPurchaseSource: (body:Record<string,unknown>) => request<PurchaseSource>('/insurance-accounting/purchase-sources',{method:'POST',body:JSON.stringify(body)}),
  updatePurchaseSource: (id:string,body:Record<string,unknown>) => request<PurchaseSource>(`/insurance-accounting/purchase-sources/${id}`,{method:'PUT',body:JSON.stringify(body)}),
  removePurchaseSource: (id:string) => request<null>(`/insurance-accounting/purchase-sources/${id}`,{method:'DELETE'}),
  commissions: () => request<CommissionRow[]>('/insurance-accounting/commissions'),
  addCommission: (body: Record<string, unknown>) => request<CommissionRow>('/insurance-accounting/commissions', { method:'POST', body:JSON.stringify(body) }),
  receive: (id:string, body:Record<string,unknown>) => request<CommissionRow>(`/insurance-accounting/commissions/${id}/receive`, { method:'POST', body:JSON.stringify(body) }),
  summary: () => request<CommissionSummary>('/insurance-accounting/summary'),
};
