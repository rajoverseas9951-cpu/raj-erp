'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { OperationalRecord, vehicleOperationsApi } from '@/lib/vehicle-operations';

const input = 'h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50';
const label = 'grid gap-1.5 text-[11px] font-black uppercase tracking-[.04em] text-slate-500';

function addMonths(date: string, months: number) {
  if (!date || !months) return '';
  const d = new Date(`${date}T00:00:00`);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

export default function FitnessPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const [rows, setRows] = useState<OperationalRecord[]>([]);
  const [period, setPeriod] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const expiry = useMemo(() => addMonths(issueDate, Number(period || 0)), [issueDate, period]);
  const load = () => vehicleOperationsApi.list(vehicleId, 'fitness').then(setRows).catch(e => setError(e instanceof Error ? e.message : 'Fitness history could not be loaded.'));
  useEffect(() => { void load(); }, [vehicleId]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setError('');
    const fd = new FormData(e.currentTarget);
    const body = {
      period: fd.get('period'),
      issue_date: fd.get('issue_date'),
      expiry_date: fd.get('expiry_date'),
      reference_number: fd.get('reference_number'),
      receipt_date: fd.get('receipt_date'),
      amount: Number(fd.get('amount') || 0),
      notes: fd.get('inspection_name'),
    };
    try {
      await vehicleOperationsApi.create(vehicleId, 'fitness', body);
      e.currentTarget.reset(); setPeriod(''); setIssueDate(''); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Fitness record could not be saved.'); }
    finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-[#f4f7fc] p-3 text-[#081a3a] sm:p-5 md:p-7">
    <div className="mx-auto max-w-7xl space-y-4">
      <section className="relative overflow-hidden rounded-[28px] border border-[#173d78] bg-[#071a3c] p-6 text-white shadow-[0_24px_70px_rgba(7,26,60,.20)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,rgba(48,143,255,.48),transparent_35%),linear-gradient(135deg,#06152f,#0a2555_60%,#0c3478)]" />
        <div className="relative flex items-center justify-between"><div><a href={`/vehicles/${vehicleId}`} className="text-xs font-bold text-blue-200">← Vehicle Profile</a><p className="mt-5 text-[9px] font-black uppercase tracking-[.24em] text-[#63d4ff]">Commercial compliance</p><h1 className="mt-1 text-3xl font-black">Fitness</h1><p className="mt-2 text-xs text-blue-100/70">Create and track fitness validity in one clean workflow.</p></div><div className="grid h-20 w-20 place-items-center rounded-[24px] border border-white/10 bg-white/10 text-4xl">✓</div></div>
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      <form onSubmit={submit} className="overflow-hidden rounded-[26px] border border-[#d9e5f7] bg-white shadow-[0_14px_40px_rgba(26,64,120,.08)]">
        <div className="border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/70 px-6 py-4"><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">New Fitness</p><h2 className="mt-1 text-xl font-black">Create New Fitness</h2></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
          <label className={label}><span>Period *</span><select name="period" required value={period} onChange={e=>setPeriod(e.target.value)} className={input}><option value="">Select Period</option><option value="12">12 Month</option><option value="24">2 Year</option><option value="60">5 Year</option><option value="180">15 Year</option></select></label>
          <label className={label}><span>Issue Date *</span><input name="issue_date" type="date" required value={issueDate} onChange={e=>setIssueDate(e.target.value)} className={input}/></label>
          <label className={label}><span>Expire Date *</span><input name="expiry_date" type="date" required value={expiry} readOnly className={`${input} bg-blue-50/60`}/></label>
          <label className={label}><span>Rec No *</span><input name="reference_number" required placeholder="Enter Rec No." className={input}/></label>
          <label className={label}><span>Rec Date *</span><input name="receipt_date" type="date" required className={input}/></label>
          <label className={label}><span>Amount *</span><input name="amount" type="number" min="0" step="0.01" required placeholder="Enter Amount" className={input}/></label>
          <label className={label}><span>INS Name *</span><input name="inspection_name" required placeholder="Enter / select INS name" className={input}/></label>
        </div>
        <div className="flex justify-end border-t border-slate-100 bg-[#f8fbff] p-4 sm:px-6"><button disabled={saving} className="min-w-[210px] rounded-2xl bg-gradient-to-r from-[#0b2b62] to-[#2563eb] px-6 py-3.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(37,99,235,.28)] disabled:opacity-50">{saving?'Saving…':'+ Add Fitness'}</button></div>
      </form>

      <section className="overflow-hidden rounded-[26px] border border-[#d9e5f7] bg-white shadow-[0_14px_40px_rgba(26,64,120,.07)]"><div className="border-b border-slate-100 px-6 py-4"><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">History</p><h2 className="mt-1 text-xl font-black">Fitness Records</h2></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-[#f8fbff] text-[9px] font-black uppercase tracking-wide text-slate-400"><tr><th className="p-4 text-left">Period</th><th className="p-4 text-left">Issue</th><th className="p-4 text-left">Expiry</th><th className="p-4 text-left">Rec No</th><th className="p-4 text-left">INS Name</th><th className="p-4 text-left">Amount</th><th className="p-4">Action</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t border-slate-100"><td className="p-4 font-black">{String(r.period??'—')} Mo</td><td className="p-4">{String(r.issue_date??'—')}</td><td className="p-4">{String(r.expiry_date??'—')}</td><td className="p-4 font-semibold">{String(r.reference_number??'—')}</td><td className="p-4">{String(r.notes??'—')}</td><td className="p-4 font-black">₹{Number(r.amount??0).toFixed(2)}</td><td className="p-4 text-center"><button onClick={()=>confirm('Delete this fitness record?')&&vehicleOperationsApi.remove(vehicleId,'fitness',r.id).then(load)} className="font-black text-red-600">Delete</button></td></tr>)}</tbody></table>{rows.length===0&&<p className="p-10 text-center text-sm font-semibold text-slate-400">No fitness records added yet.</p>}</div></section>
    </div>
  </main>;
}
