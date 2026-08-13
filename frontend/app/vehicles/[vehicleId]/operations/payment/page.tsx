'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { authenticatedRequest } from '@/lib/api-client';
import { OperationalProfile, OperationalRecord, vehicleOperationsApi } from '@/lib/vehicle-operations';

type Ledger = {
  id: string;
  ledger_name: string;
  ledger_group: string;
  status: string;
};

type PaymentMode = 'cash' | 'bank';
type PaymentType = 'Receive' | 'Debit';

const inputClass = 'h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50';
const labelClass = 'grid gap-1.5 text-[11px] font-black uppercase tracking-[.04em] text-slate-500';
const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PaymentPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const [rows, setRows] = useState<OperationalRecord[]>([]);
  const [profile, setProfile] = useState<OperationalProfile | null>(null);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [paymentType, setPaymentType] = useState<PaymentType>('Receive');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [ledgerId, setLedgerId] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadRows = async () => setRows(await vehicleOperationsApi.list(vehicleId, 'payment'));
  const loadProfile = async () => setProfile(await vehicleOperationsApi.profile(vehicleId));
  const loadLedgers = async () => {
    const list = await authenticatedRequest<Ledger[]>('/ledgers');
    setLedgers(list.filter((l) => l.status === 'active' && ['Bank Accounts', 'Cash-in-Hand'].includes(l.ledger_group)));
  };

  const refresh = async () => {
    const results = await Promise.allSettled([loadRows(), loadProfile(), loadLedgers()]);
    const failed = results.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') setError(failed.reason instanceof Error ? failed.reason.message : 'Payment data could not be refreshed.');
  };

  useEffect(() => { void refresh(); }, [vehicleId]);

  const visibleLedgers = useMemo(() => {
    const group = paymentMode === 'cash' ? 'Cash-in-Hand' : 'Bank Accounts';
    return ledgers.filter((l) => l.ledger_group === group).sort((a, b) => a.ledger_name.localeCompare(b.ledger_name));
  }, [ledgers, paymentMode]);

  useEffect(() => {
    if (paymentType !== 'Receive') {
      setLedgerId('');
      return;
    }
    if (!visibleLedgers.some((l) => l.id === ledgerId)) setLedgerId(visibleLedgers[0]?.id ?? '');
  }, [paymentType, visibleLedgers, ledgerId]);

  const outstanding = Number(profile?.balances.outstanding ?? 0);
  const entered = Number(amount || 0);
  const projected = paymentType === 'Receive' ? Math.max(0, outstanding - entered) : outstanding + entered;

  async function addLedger() {
    const group = paymentMode === 'cash' ? 'Cash-in-Hand' : 'Bank Accounts';
    const name = prompt(paymentMode === 'cash' ? 'Cash ledger name (example: CASH / OFFICE CASH)' : 'Bank ledger name (example: SBI BANK / HDFC CURRENT A/C)', paymentMode === 'cash' ? 'CASH' : '');
    if (!name?.trim()) return;
    try {
      setError('');
      const created = await authenticatedRequest<Ledger>('/ledgers', {
        method: 'POST',
        body: JSON.stringify({ ledger_name: name.trim(), ledger_group: group, opening_balance: 0, balance_type: 'debit', credit_limit: 0, credit_days: 0, gst_applicable: false, status: 'active' }),
      });
      await loadLedgers();
      setLedgerId(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ledger could not be created.');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const numericAmount = Number(amount || 0);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }
    if (paymentType === 'Receive' && !ledgerId) {
      setError('Select the Cash/Bank ledger where money was actually received.');
      return;
    }

    const selected = ledgers.find((l) => l.id === ledgerId);
    const body = {
      payment_type: paymentType,
      ...(paymentType === 'Receive' ? { ledger_id: ledgerId, account: selected?.ledger_name ?? '', paid_amount: numericAmount } : { billed_amount: numericAmount }),
      reference_number: String(form.get('reference_number') ?? ''),
      issue_date: String(form.get('issue_date') ?? ''),
      notes: String(form.get('notes') ?? ''),
    };

    try {
      setSaving(true);
      setError('');
      await vehicleOperationsApi.create(vehicleId, 'payment', body);

      // Capture the form element before await. React currentTarget is not reliable after async boundaries.
      formElement.reset();
      setPaymentType('Receive');
      setPaymentMode('cash');
      setAmount('');
      await Promise.all([loadRows(), loadProfile()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: OperationalRecord) {
    if (!confirm('Delete this payment entry? Its linked accounting voucher will also be cancelled.')) return;
    try {
      setError('');
      await vehicleOperationsApi.remove(vehicleId, 'payment', row.id);
      await Promise.all([loadRows(), loadProfile()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment could not be deleted.');
    }
  }

  const visibleRows = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="min-h-screen bg-[#f4f7fc] p-3 text-[#081a3a] sm:p-5 md:p-7">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="relative overflow-hidden rounded-[28px] border border-[#173d78] bg-[#071a3c] p-5 text-white shadow-[0_24px_70px_rgba(7,26,60,.20)] sm:p-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(43,117,255,.48),transparent_34%),linear-gradient(135deg,#06152f,#0a2555_60%,#0c3478)]" />
          <div className="relative flex items-center justify-between gap-4">
            <div>
              <a href={`/vehicles/${vehicleId}`} className="text-xs font-bold text-blue-200">← Vehicle Profile</a>
              <p className="mt-5 text-[9px] font-black uppercase tracking-[.24em] text-[#63d4ff]">Receipt & settlement</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Payment Process</h1>
              <p className="mt-2 text-xs text-blue-100/70">Every receipt posts to the selected Cash/Bank ledger and customer ledger in one transaction.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-right backdrop-blur">
              <p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">Outstanding</p>
              <p className="mt-1 text-2xl font-black">{money(outstanding)}</p>
            </div>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

        <form onSubmit={submit} className="overflow-hidden rounded-[28px] border border-[#d9e5f7] bg-white shadow-[0_16px_45px_rgba(26,64,120,.08)]">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/70 px-5 py-4 sm:px-6">
            <div><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">Receipt & settlement</p><h2 className="mt-1 text-xl font-black">Payment Entry</h2></div>
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[9px] font-black uppercase text-blue-700">Ledger controlled</span>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
            <label className={labelClass}>Payment Type *
              <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as PaymentType)} className={inputClass}>
                <option value="Receive">Receive</option>
                <option value="Debit">Customer Debit / Charge</option>
              </select>
            </label>

            {paymentType === 'Receive' && <label className={labelClass}>Payment Mode *
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMode)} className={inputClass}>
                <option value="cash">Cash</option><option value="bank">Bank / UPI / Online</option>
              </select>
            </label>}

            {paymentType === 'Receive' && <label className={labelClass}>{paymentMode === 'cash' ? 'Cash Ledger' : 'Bank Ledger'} *
              <div className="flex gap-2">
                <select value={ledgerId} onChange={(e) => setLedgerId(e.target.value)} className={inputClass} required>
                  <option value="">Select ledger</option>
                  {visibleLedgers.map((l) => <option key={l.id} value={l.id}>{l.ledger_name}</option>)}
                </select>
                <button type="button" onClick={() => void addLedger()} className="h-12 shrink-0 rounded-xl border border-blue-100 bg-blue-50 px-4 text-lg font-black text-blue-700">+</button>
              </div>
            </label>}

            <label className={labelClass}>Vou. No
              <input name="reference_number" className={inputClass} placeholder="Voucher / reference" />
            </label>
            <label className={labelClass}>Date *
              <input name="issue_date" type="date" required className={inputClass} defaultValue={new Date().toISOString().slice(0, 10)} />
            </label>
            <label className={labelClass}>Amount *
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0.01" step="0.01" required className={inputClass} />
            </label>
            <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>Narration
              <textarea name="notes" rows={3} className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm font-semibold normal-case tracking-normal outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" />
            </label>
          </div>

          <div className="mx-5 mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-[#fbfdff] p-4 sm:mx-6 sm:grid-cols-3">
            <Summary label="Current Balance" value={money(outstanding)} />
            <Summary label={paymentType === 'Receive' ? 'Receiving Now' : 'Adding Debit'} value={money(entered)} />
            <Summary label="Closing Balance" value={money(projected)} accent />
          </div>

          <div className="flex justify-end border-t border-slate-100 bg-[#f8fbff] p-4 sm:px-6">
            <button disabled={saving} className="min-w-[200px] rounded-2xl bg-gradient-to-r from-[#0b2b62] to-[#2563eb] px-6 py-3.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(37,99,235,.28)] disabled:opacity-50">{saving ? 'Posting…' : '+ Submit Payment'}</button>
          </div>
        </form>

        <section className="overflow-hidden rounded-[28px] border border-[#d9e5f7] bg-white shadow-[0_14px_40px_rgba(26,64,120,.07)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">Timeline</p><h2 className="mt-1 text-xl font-black">Payment Process Details</h2></div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search history" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-blue-400 sm:w-72" />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[850px] w-full text-sm">
              <thead className="bg-[#f8fbff]"><tr className="text-left text-[9px] font-black uppercase tracking-wide text-slate-400"><th className="p-4">Date</th><th className="p-4">Vou. No</th><th className="p-4">Account Name</th><th className="p-4">Credit</th><th className="p-4">Debit</th><th className="p-4">Action</th></tr></thead>
              <tbody>{visibleRows.map((row) => {
                const paid = Number(row.paid_amount ?? 0); const billed = Number(row.billed_amount ?? 0);
                return <tr key={row.id} className="border-t border-slate-100"><td className="p-4">{String(row.issue_date ?? '—')}</td><td className="p-4 text-blue-700">{String(row.reference_number ?? '—')}</td><td className="p-4"><b>{String(row.account ?? '—')}</b><div className="text-[10px] text-slate-400">{String(row.payment_type ?? '')}</div></td><td className="p-4 font-black text-emerald-700">{paid > 0 ? money(paid) : '—'}</td><td className="p-4 font-black text-rose-700">{billed > 0 ? money(billed) : '—'}</td><td className="p-4"><button onClick={() => void remove(row)} className="font-black text-rose-600">Delete</button></td></tr>;
              })}</tbody>
            </table>
            {visibleRows.length === 0 && <p className="p-10 text-center text-sm font-semibold text-slate-400">No payment records yet.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}

function Summary({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className={`rounded-xl border p-4 ${accent ? 'border-blue-200 bg-blue-50/70' : 'border-slate-200 bg-white'}`}><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-xl font-black ${accent ? 'text-blue-700' : 'text-slate-950'}`}>{value}</p></div>;
}
