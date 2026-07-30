'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Ledger, ledgerApi } from '@/lib/ledgers';

const groups = [
  'Sundry Debtors','Sundry Creditors','Bank Accounts','Cash-in-Hand',
  'Direct Expenses','Indirect Expenses','Direct Incomes','Indirect Incomes',
  'Loans & Liabilities','Capital Account','Fixed Assets','Current Assets','Other',
];

export default function LedgersPage() {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { setLedgers(await ledgerApi.list()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ledgers load nahi hue.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    const form = new FormData(event.currentTarget);
    try {
      await ledgerApi.create({
        ledger_name: String(form.get('ledger_name') ?? ''),
        ledger_group: String(form.get('ledger_group') ?? 'Other'),
        opening_balance: Number(form.get('opening_balance') ?? 0),
        balance_type: String(form.get('balance_type') ?? 'debit'),
        credit_limit: Number(form.get('credit_limit') ?? 0),
        credit_days: Number(form.get('credit_days') ?? 0),
        gst_applicable: form.get('gst_applicable') === 'on',
        status: 'active',
      });
      event.currentTarget.reset();
      setSuccess('Ledger successfully create ho gaya.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ledger create nahi hua.');
    } finally { setSaving(false); }
  }

  return <main className="space-y-6 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Ledger Master</h1><p className="text-slate-500">Customer, supplier, bank, cash, expense aur income ledgers.</p></div>
      <a href="/customers" className="rounded-xl border px-4 py-2">Back to Customers</a>
    </div>

    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
    {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{success}</div>}

    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">Add New Ledger</h2>
      <form onSubmit={submit} className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="text-sm font-semibold">Ledger Name<input name="ledger_name" required className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
        <label className="text-sm font-semibold">Ledger Group<select name="ledger_group" className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal">{groups.map((g)=><option key={g}>{g}</option>)}</select></label>
        <label className="text-sm font-semibold">Opening Balance<input name="opening_balance" type="number" step="0.01" defaultValue="0" className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
        <label className="text-sm font-semibold">Balance Type<select name="balance_type" className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal"><option value="debit">Debit</option><option value="credit">Credit</option></select></label>
        <label className="text-sm font-semibold">Credit Limit<input name="credit_limit" type="number" step="0.01" defaultValue="0" className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
        <label className="text-sm font-semibold">Credit Days<input name="credit_days" type="number" defaultValue="0" className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input name="gst_applicable" type="checkbox" /> GST Applicable</label>
        <div className="md:col-span-2"><button disabled={saving} className="rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Create Ledger'}</button></div>
      </form>
    </section>

    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b p-5"><h2 className="text-lg font-bold">All Ledgers</h2></div>
      {loading ? <div className="p-6">Loading...</div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Ledger Name</th><th className="p-3">Group</th><th className="p-3">Opening</th><th className="p-3">Dr/Cr</th><th className="p-3">Linked</th><th className="p-3">Status</th></tr></thead><tbody>{ledgers.map((l)=><tr key={l.id} className="border-t"><td className="p-3 font-semibold">{l.ledger_name}</td><td className="p-3">{l.ledger_group}</td><td className="p-3">₹{Number(l.opening_balance ?? 0).toFixed(2)}</td><td className="p-3 uppercase">{l.balance_type}</td><td className="p-3">{l.customer_id ? 'Customer' : 'Manual'}</td><td className="p-3">{l.status}</td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
