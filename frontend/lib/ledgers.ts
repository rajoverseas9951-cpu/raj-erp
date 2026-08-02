'use client';

import { apiUrl } from '@/lib/api-url';

export type Ledger = {
  id: string;
  ledger_name: string;
  ledger_group: string;
  opening_balance: string | number;
  balance_type: 'debit' | 'credit';
  credit_limit: string | number;
  credit_days: number;
  gst_applicable: boolean;
  status: 'active' | 'inactive';
  customer_id?: string | null;
};

export type LedgerStatementEntry = {
  date: string | null;
  voucher_number: string | null;
  voucher_type: string | null;
  narration: string | null;
  debit: number;
  credit: number;
  balance: number;
  balance_type: 'debit' | 'credit';
};

export type LedgerStatement = {
  ledger: Ledger;
  opening_balance: number;
  opening_type: 'debit' | 'credit';
  entries: LedgerStatementEntry[];
  closing_balance: number;
  closing_type: 'debit' | 'credit';
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = sessionStorage.getItem('raj_erp_token');
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const firstError = payload.errors ? Object.values(payload.errors as Record<string, string[]>)[0]?.[0] : undefined;
    throw new Error(firstError ?? payload.message ?? `API request failed: ${response.status}`);
  }
  return payload.data as T;
}

export const ledgerApi = {
  list: () => request<Ledger[]>('/ledgers'),
  create: (body: Record<string, unknown>) => request<Ledger>('/ledgers', { method: 'POST', body: JSON.stringify(body) }),
  statement: (ledgerId: string) => request<LedgerStatement>(`/accounting/ledger-statement/${ledgerId}`),
};
