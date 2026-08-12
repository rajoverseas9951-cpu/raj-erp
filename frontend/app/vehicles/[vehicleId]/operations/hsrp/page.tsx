'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { OperationalRecord, vehicleOperationsApi } from '@/lib/vehicle-operations';
import { Ledger, ledgerApi } from '@/lib/ledgers';

const input = 'h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50';
const label = 'grid gap-1.5 text-[11px] font-black uppercase tracking-[.04em] text-slate-500';
const money = (value:number)=>`₹${value.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export default function HsrpPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const [rows, setRows] = useState<OperationalRecord[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [dealerLedgerId, setDealerLedgerId] = useState('');
  const [partyAmount, setPartyAmount] = useState('');
  const [dealerAmount, setDealerAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [history, allLedgers] = await Promise.all([
        vehicleOperationsApi.list(vehicleId, 'hsrp'),
        ledgerApi.list(),
      ]);
      setRows(history);
      setLedgers(allLedgers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'HSRP history could not be loaded.');
    }
  };

  useEffect(() => { void load(); }, [vehicleId]);

  const dealerLedgers = useMemo(() => ledgers.filter((l) => l.status === 'active' && l.ledger_group === 'Sundry Creditors'), [ledgers]);
  const selectedDealer = dealerLedgers.find((l) => l.id === dealerLedgerId);
  const customerCharge = Number(partyAmount || 0);
  const dealerCost = Number(dealerAmount || 0);
  const margin = customerCharge - dealerCost;

  async function createDealerLedger() {
    const name = window.prompt('HSRP dealer / vendor name');
    if (!name?.trim()) return;
    setError('');
    try {
      const created = await ledgerApi.create({ ledger_name: name.trim().toUpperCase(), ledger_group: 'Sundry Creditors', opening_balance: 0, balance_type: 'credit', credit_limit: 0, credit_days: 30, gst_applicable: false, status: 'active' });
      setLedgers((prev) => [...prev, created]);
      setDealerLedgerId(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dealer ledger could not be created.');
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (dealerCost > 0 && !selectedDealer) {
      setError('Select HSRP dealer ledger when dealer cost is entered.');
      return;
    }
    setSaving(true); setError('');
    const fd = new FormData(form);
    let createdId = '';
    try {
      const created = await vehicleOperationsApi.create(vehicleId, 'hsrp', {
        vendor: selectedDealer?.ledger_name || undefined,
        order_date: fd.get('order_date'),
        received_date: fd.get('received_date'),
        delivery_date: fd.get('delivery_date'),
        party_amount: customerCharge,
        amount: dealerCost,
        notes: dealerCost > 0 ? `HSRP outsourced to ${selectedDealer?.ledger_name} | Dealer payable ${money(dealerCost)} | Monthly settlement` : 'HSRP customer charge only',
      });
      createdId = created.id;

      if (customerCharge > 0) await vehicleOperationsApi.create(vehicleId, 'payment', { payment_type: 'HSRP Bill', account: 'HSRP SERVICE', issue_date: fd.get('order_date'), billed_amount: customerCharge, reference_number: `HSRP-${String(fd.get('order_date') || '')}`, notes: `HSRP customer charge | HSRP record ${created.id}` });
      if (dealerCost > 0 && selectedDealer) await vehicleOperationsApi.create(vehicleId, 'agent_payment', { party_name: selectedDealer.ledger_name, account: 'HSRP DEALER PAYABLE', issue_date: fd.get('order_date'), billed_amount: dealerCost, paid_amount: 0, reference_number: `HSRP-${String(fd.get('order_date') || '')}`, notes: `HSRP dealer cost accrued for monthly settlement | HSRP record ${created.id}` });

      form.reset();
      setDealerLedgerId(''); setPartyAmount(''); setDealerAmount('');
      await load();
    } catch (err) {
      if (createdId) { try { await vehicleOperationsApi.remove(vehicleId, 'hsrp', createdId); } catch {} }
      setError(err instanceof Error ? err.message : 'HSRP record could not be saved with accounting entries.');
    } finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-[#f4f7fc] p-3 text-[#081a3a] sm:p-5 md:p-7"><div className="mx-auto max-w-7xl space-y-4">
    <section className="relative overflow-hidden rounded-[28px] border border-[#173d78] bg-[#071a3c] p-6 text-white shadow-[0_24px_70px_rgba(7,26,60,.20)]"><div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,rgba(48,143,255,.48),transparent_35%),linear-gradient(135deg,#06152f,#0a2555_60%,#0c3478)]" /><div className="relative flex items-center justify-between"><div><a href={`/vehicles/${vehicleId}`} className="text-xs font-bold text-blue-200">← Vehicle Profile</a><p className="mt-5 text-[9px] font-black uppercase tracking-[.24em] text-[#63d4ff]">High security registration plate</p><h1 className="mt-1 text-3xl font-black">HSRP</h1><p className="mt-2 text-xs text-blue-100/70">Customer billing + dealer payable, with monthly settlement.</p></div><div className="grid h-20 w-20 place-items-center rounded-[24px] border border-white/10 bg-white/10 text-4xl">▣</div></div></section>
    {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
    <form onSubmit={submit} className="overflow-hidden rounded-[26px] border border-[#d9e5f7] bg-white shadow-[0_14px_40px_rgba(26,64,120,.08)]">
      <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/70 px-6 py-4"><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">New HSRP</p><h2 className="mt-1 text-xl font-black">HSRP Entry</h2></div><span className="rounded-full bg-blue-50 px-3 py-1.5 text-[9px] font-black uppercase text-blue-700">Monthly dealer accounting</span></div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
        <label className={label}><span>HSRP Dealer Ledger {dealerCost > 0 ? '*' : ''}</span><div className="flex gap-2"><select value={dealerLedgerId} onChange={(e)=>setDealerLedgerId(e.target.value)} required={dealerCost > 0} className={input}><option value="">Select dealer</option>{dealerLedgers.map((d)=><option key={d.id} value={d.id}>{d.ledger_name}</option>)}</select><button type="button" onClick={createDealerLedger} className="h-12 min-w-12 rounded-xl border border-blue-200 bg-blue-50 text-xl font-black text-blue-700 hover:bg-blue-100">+</button></div><span className="normal-case font-semibold tracking-normal text-slate-400">Dealer/vendor ko Sundry Creditor ledger ke roop me maintain kiya jayega.</span></label>
        <label className={label}><span>Order Date *</span><input name="order_date" type="date" required className={input}/></label>
        <label className={label}><span>Received Date *</span><input name="received_date" type="date" required className={input}/></label>
        <label className={label}><span>Delivery Date *</span><input name="delivery_date" type="date" required className={input}/></label>
        <label className={label}><span>Customer Charge *</span><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</span><input value={partyAmount} onChange={(e)=>setPartyAmount(e.target.value)} name="party_amount" type="number" min="0" step="0.01" required placeholder="Total charged to customer" className={`${input} pl-7`}/></div></label>
        <label className={label}><span>Dealer Cost</span><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</span><input value={dealerAmount} onChange={(e)=>setDealerAmount(e.target.value)} name="dealer_amount" type="number" min="0" step="0.01" placeholder="Cost charged by dealer" className={`${input} pl-7`}/></div><span className="normal-case font-semibold tracking-normal text-slate-400">Abhi payment nahi — monthly payable banega.</span></label>
      </div>
      <div className="mx-5 mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-[#f8fbff] p-4 sm:mx-6 sm:grid-cols-3"><MoneyCard label="Customer Receivable" value={customerCharge} tone="blue" /><MoneyCard label="Dealer Payable" value={dealerCost} tone="amber" /><MoneyCard label="HSRP Margin" value={margin} tone={margin < 0 ? 'red' : 'green'} /></div>
      <div className="flex flex-col gap-3 border-t border-slate-100 bg-[#f8fbff] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><p className="text-[10px] font-semibold text-slate-500">Dealer cost accrues as payable now and can be settled month-wise later. Customer charge remains separate as receivable until collected.</p><button disabled={saving} className="min-w-[210px] rounded-2xl bg-gradient-to-r from-[#0b2b62] to-[#2563eb] px-6 py-3.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(37,99,235,.28)] disabled:opacity-50">{saving?'Saving…':'+ Add HSRP'}</button></div>
    </form>
    <section className="overflow-hidden rounded-[26px] border border-[#d9e5f7] bg-white shadow-[0_14px_40px_rgba(26,64,120,.07)]"><div className="border-b border-slate-100 px-6 py-4"><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">History</p><h2 className="mt-1 text-xl font-black">HSRP Records</h2></div><div className="overflow-x-auto"><table className="min-w-[950px] w-full text-sm"><thead className="bg-[#f8fbff] text-[9px] font-black uppercase tracking-wide text-slate-400"><tr><th className="p-4 text-left">Dealer</th><th className="p-4 text-left">Order</th><th className="p-4 text-left">Received</th><th className="p-4 text-left">Delivery</th><th className="p-4 text-left">Customer</th><th className="p-4 text-left">Dealer Cost</th><th className="p-4 text-left">Margin</th><th className="p-4">Action</th></tr></thead><tbody>{rows.map(r=>{const c=Number(r.party_amount??0),v=Number(r.amount??0);return <tr key={r.id} className="border-t border-slate-100"><td className="p-4 font-black">{String(r.vendor??'—')}</td><td className="p-4">{formatDate(r.order_date)}</td><td className="p-4">{formatDate(r.received_date)}</td><td className="p-4">{formatDate(r.delivery_date)}</td><td className="p-4 font-black text-blue-700">{money(c)}</td><td className="p-4 font-black text-amber-700">{money(v)}</td><td className={`p-4 font-black ${c-v<0?'text-rose-700':'text-emerald-700'}`}>{money(c-v)}</td><td className="p-4 text-center"><button onClick={()=>confirm('Delete this HSRP record?')&&vehicleOperationsApi.remove(vehicleId,'hsrp',r.id).then(load)} className="font-black text-red-600">Delete</button></td></tr>})}</tbody></table>{rows.length===0&&<p className="p-10 text-center text-sm font-semibold text-slate-400">No HSRP records added yet.</p>}</div></section>
  </div></main>;
}

function MoneyCard({label,value,tone}:{label:string;value:number;tone:'blue'|'amber'|'green'|'red'}){const styles={blue:'text-blue-700',amber:'text-amber-700',green:'text-emerald-700',red:'text-rose-700'};return <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-xl font-black ${styles[tone]}`}>{money(value)}</p></div>}
function formatDate(value:unknown){if(!value)return '—';const date=new Date(String(value));return Number.isNaN(date.getTime())?String(value):date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
