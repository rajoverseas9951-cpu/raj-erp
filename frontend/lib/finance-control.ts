'use client';

import { authenticatedRequest } from '@/lib/api-client';
import { apiUrl } from '@/lib/api-url';
import { invalidateDashboard } from '@/lib/dashboard-refresh';

export type OutstandingRow={id:string;name:string;group:string;receivable:number;payable:number};
export type OutstandingPayload={rows:OutstandingRow[];summary:{customer_receivable:number;ledger_receivable:number;total_receivable:number;party_receivable:number;party_payable:number;insurance_commission_due:number;service_customer_due:number}};
export type OpeningBalanceRow={id:string;ledger_name:string;ledger_group:string;opening_balance:number|string;balance_type:'debit'|'credit'};
export type FinancialYearStatus={fy_start:string;fy_end:string;locked:boolean;locked_at?:string|null};

async function write<T>(path:string,body:Record<string,unknown>,method='POST'){const r=await authenticatedRequest<T>(path,{method,body:JSON.stringify(body)});invalidateDashboard();return r}
async function downloadOutstanding(type:'receivable'|'payable'){
  const token=sessionStorage.getItem('raj_erp_token');
  if(!token) throw new Error('Login required.');
  const response=await fetch(apiUrl(`/accounting/outstanding/export?type=${type}`),{headers:{Authorization:`Bearer ${token}`,Accept:'application/pdf'}});
  if(!response.ok) throw new Error('PDF report could not be generated.');
  const blob=await response.blob(); const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=type==='receivable'?'customer-party-receivable.pdf':'party-payable.pdf'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export const financeControlApi={
  simpleEntry:(body:Record<string,unknown>)=>write<{id:string;voucher_number:string}>('/accounting/simple-entry',body),
  outstanding:()=>authenticatedRequest<OutstandingPayload>('/accounting/outstanding'),
  downloadOutstanding,
  openingBalances:()=>authenticatedRequest<OpeningBalanceRow[]>('/accounting/opening-balances'),
  updateOpening:(id:string,body:Record<string,unknown>)=>write<null>(`/accounting/opening-balances/${id}`,body,'PUT'),
  yearStatus:(fyStart?:string)=>authenticatedRequest<FinancialYearStatus>(`/accounting/financial-year${fyStart?`?fy_start=${encodeURIComponent(fyStart)}`:''}`),
  lockYear:(fy_start:string)=>write<FinancialYearStatus>('/accounting/financial-year/lock',{fy_start,confirm:true}),
  unlockYear:(fy_start:string)=>write<FinancialYearStatus>('/accounting/financial-year/unlock',{fy_start,confirm:true}),
};
