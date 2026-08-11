'use client';

import { authenticatedRequest } from '@/lib/api-client';
import { invalidateDashboard } from '@/lib/dashboard-refresh';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const result = await authenticatedRequest<T>(path, init);
  if (init?.method && init.method !== 'GET') invalidateDashboard();
  return result;
}

export type VoucherEntryInput = { ledger_id: string; entry_type: 'debit'|'credit'; amount: number; description?: string };
export type Voucher = { id:string; voucher_number:string; voucher_type:string; voucher_date:string; narration?:string; total_debit:number|string; total_credit:number|string };
export type TrialBalance = { rows:{ledger_id:string;ledger_name:string;ledger_group:string;debit:number;credit:number}[]; total_debit:number; total_credit:number };
export type ProfitLoss={income:number;expense:number;insurance_commission:number;insurance_agent_commission:number;tds:number;rto_income:number;rto_cost:number;rto_profit:number;recorded_expenses:number;net_profit:number};
export type BalanceSheet={assets:number;book_liabilities:number;current_year_profit:number;liabilities:number;difference:number};

export const accountingApi = {
  vouchers: () => request<Voucher[]>('/accounting/vouchers'),
  createVoucher: (body: Record<string,unknown>) => request<Voucher>('/accounting/vouchers', { method:'POST', body: JSON.stringify(body) }),
  trialBalance: () => request<TrialBalance>('/accounting/trial-balance'),
  profitLoss: () => request<ProfitLoss>('/accounting/profit-loss'),
  balanceSheet: () => request<BalanceSheet>('/accounting/balance-sheet'),
};
