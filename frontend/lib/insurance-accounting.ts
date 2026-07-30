'use client';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = sessionStorage.getItem('raj_erp_token');
  const response = await fetch(`${API}/api/v1${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({})) as { data?: T; message?: string; errors?: Record<string, string[]> };
  if (!response.ok) throw new Error(payload.message ?? Object.values(payload.errors ?? {})?.[0]?.[0] ?? `API request failed: ${response.status}`);
  return payload.data as T;
}

export type InsuranceCompany = { id:string; company_name:string; short_code?:string; default_commission_percent:number; tds_percent:number; settlement_days:number; gst_number?:string; pan_number?:string; status:string };
export type CommissionRow = { id:string; company_name:string; statement_date:string; policy_number?:string; customer_name?:string; gross_premium:number; gross_commission:number; tds_amount:number; net_receivable:number; received_amount:number; status:string };
export type CommissionSummary = { gross_commission:number; tds_receivable:number; net_receivable:number; received:number; outstanding:number };

export const insuranceAccountingApi = {
  companies: () => request<InsuranceCompany[]>('/insurance-accounting/companies'),
  addCompany: (body: Record<string, unknown>) => request<InsuranceCompany>('/insurance-accounting/companies', { method:'POST', body:JSON.stringify(body) }),
  commissions: () => request<CommissionRow[]>('/insurance-accounting/commissions'),
  addCommission: (body: Record<string, unknown>) => request<CommissionRow>('/insurance-accounting/commissions', { method:'POST', body:JSON.stringify(body) }),
  receive: (id:string, body:Record<string,unknown>) => request<CommissionRow>(`/insurance-accounting/commissions/${id}/receive`, { method:'POST', body:JSON.stringify(body) }),
  summary: () => request<CommissionSummary>('/insurance-accounting/summary'),
};
