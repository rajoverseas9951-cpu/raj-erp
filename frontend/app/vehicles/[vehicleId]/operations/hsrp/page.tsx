'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { OperationalRecord, vehicleOperationsApi } from '@/lib/vehicle-operations';

const input = 'h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50';
const label = 'grid gap-1.5 text-[11px] font-black uppercase tracking-[.04em] text-slate-500';

export default function HsrpPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const [rows, setRows] = useState<OperationalRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const load = () => vehicleOperationsApi.list(vehicleId, 'hsrp').then(setRows).catch(e => setError(e instanceof Error ? e.message : 'HSRP history could not be loaded.'));

  useEffect(() => { void load(); }, [vehicleId]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setError('');
    const fd = new FormData(e.currentTarget);
    const body = {
      vendor: fd.get('dealer_name'),
      order_date: fd.get('order_date'),
      received_date: fd.get('received_date'),
      delivery_date: fd.get('delivery_date'),
      party_amount: Number(fd.get('party_amount') || 0),
      amount: Number(fd.get('dealer_amount') || 0),
    };
    try {
      await vehicleOperationsApi.create(vehicleId, 'hsrp', body);
      e.currentTarget.reset(); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'HSRP record could not be saved.'); }
    finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-[#f4f7fc] p-3 text-[#081a3a] sm:p-5 md:p-7">
    <div className="mx-auto max-w-7xl space-y-4">
      <section className="relative overflow-hidden rounded-[28px] border border-[#173d78] bg-[#071a3c] p-6 text-white shadow-[0_24px_70px_rgba(7,26,60,.20)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,rgba(48,143,255,.48),transparent_35%),linear-gradient(135deg,#06152f,#0a2555_60%,#0c3478)]" />
        <div className="relative flex items-center justify-between"><div><a href={`/vehicles/${vehicleId}`} className="text-xs font-bold text-blue-200">← Vehicle Profile</a><p className="mt-5 text-[9px] font-black uppercase tracking-[.24em] text-[#63d4ff]">High security registration plate</p><h1 className="mt-1 text-3xl font-black">HSRP</h1><p className="mt-2 text-xs text-blue-100/70">Track dealer, order, receipt and delivery in one workflow.</p></div><div className="grid h-20 w-20 place-items-center rounded-[24px] border border-white/10 bg-white/10 text-4xl">▣</div></div>
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      <form onSubmit={submit} className="overflow-hidden rounded-[26px] border border-[#d9e5f7] bg-white shadow-[0_14px_40px_rgba(26,64,120,.08)]">
        <div className="border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/70 px-6 py-4"><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">New HSRP</p><h2 className="mt-1 text-xl font-black">Create New HSRP</h2></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
          <label className={label}><span>Dealer Name *</span><input name="dealer_name" required placeholder="Enter / select dealer name" className={input}/></label>
          <label className={label}><span>Order Date *</span><input name="order_date" type="date" required className={input}/></label>
          <label className={label}><span>Received Date *</span><input name="received_date" type="date" required className={input}/></label>
          <label className={label}><span>Delivery Date *</span><input name="delivery_date" type="date" required className={input}/></label>
          <label className={label}><span>Party Amount *</span><input name="party_amount" type="number" min="0" step="0.01" required placeholder="Enter Party Amount" className={input}/></label>
          <label className={label}><span>Dealer Amount *</span><input name="dealer_amount" type="number" min="0" step="0.01" required placeholder="Enter Dealer Amount" className={input}/></label>
        </div>
        <div className="flex justify-end border-t border-slate-100 bg-[#f8fbff] p-4 sm:px-6"><button disabled={saving} className="min-w-[210px] rounded-2xl bg-gradient-to-r from-[#0b2b62] to-[#2563eb] px-6 py-3.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(37,99,235,.28)] disabled:opacity-50">{saving?'Saving…':'+ Add HSRP'}</button></div>
      </form>

      <section className="overflow-hidden rounded-[26px] border border-[#d9e5f7] bg-white shadow-[0_14px_40px_rgba(26,64,120,.07)]"><div className="border-b border-slate-100 px-6 py-4"><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">History</p><h2 className="mt-1 text-xl font-black">HSRP Records</h2></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-[#f8fbff] text-[9px] font-black uppercase tracking-wide text-slate-400"><tr><th className="p-4 text-left">Dealer</th><th className="p-4 text-left">Order</th><th className="p-4 text-left">Received</th><th className="p-4 text-left">Delivery</th><th className="p-4 text-left">Party Amount</th><th className="p-4 text-left">Dealer Amount</th><th className="p-4">Action</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t border-slate-100"><td className="p-4 font-black">{String(r.vendor??'—')}</td><td className="p-4">{String(r.order_date??'—')}</td><td className="p-4">{String(r.received_date??'—')}</td><td className="p-4">{String(r.delivery_date??'—')}</td><td className="p-4 font-black">₹{Number(r.party_amount??0).toFixed(2)}</td><td className="p-4 font-black">₹{Number(r.amount??0).toFixed(2)}</td><td className="p-4 text-center"><button onClick={()=>confirm('Delete this HSRP record?')&&vehicleOperationsApi.remove(vehicleId,'hsrp',r.id).then(load)} className="font-black text-red-600">Delete</button></td></tr>)}</tbody></table>{rows.length===0&&<p className="p-10 text-center text-sm font-semibold text-slate-400">No HSRP records added yet.</p>}</div></section>
    </div>
  </main>;
}
