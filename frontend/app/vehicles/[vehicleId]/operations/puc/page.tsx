'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { OperationalRecord, vehicleOperationsApi } from '@/lib/vehicle-operations';
import { Ledger, ledgerApi } from '@/lib/ledgers';

const inputClass = 'h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50';
const labelClass = 'grid gap-1.5 text-[11px] font-black uppercase tracking-[.04em] text-slate-500';
const money = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PucPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const [rows, setRows] = useState<OperationalRecord[]>([]);
  const [vendorLedgers, setVendorLedgers] = useState<Ledger[]>([]);
  const [period, setPeriod] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [customerCharge, setCustomerCharge] = useState('');
  const [vendorCost, setVendorCost] = useState('');
  const [vendor, setVendor] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    try { setRows(await vehicleOperationsApi.list(vehicleId, 'puc')); }
    catch (e) { setError(e instanceof Error ? e.message : 'PUC records could not be loaded.'); }
  };

  const loadVendors = async () => {
    try {
      const ledgers = await ledgerApi.list();
      setVendorLedgers(ledgers.filter((l) => l.status === 'active' && l.ledger_group === 'Sundry Creditors').sort((a, b) => a.ledger_name.localeCompare(b.ledger_name)));
    } catch {
      setVendorLedgers([]);
    }
  };

  useEffect(() => { void load(); void loadVendors(); }, [vehicleId]);

  const expiry = useMemo(() => addMonths(issueDate, Number(period || 0)), [issueDate, period]);
  const charge = Number(customerCharge || 0);
  const cost = Number(vendorCost || 0);
  const margin = charge - cost;
  const visible = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));

  async function addVendorLedger() {
    const name = prompt('PUC vendor name');
    if (!name?.trim()) return;
    try {
      const created = await ledgerApi.create({
        ledger_name: name.trim(),
        ledger_group: 'Sundry Creditors',
        opening_balance: 0,
        balance_type: 'credit',
        credit_limit: 0,
        credit_days: 30,
        gst_applicable: false,
        status: 'active',
      });
      setVendorLedgers((current) => [...current.filter((x) => x.id !== created.id), created].sort((a, b) => a.ledger_name.localeCompare(b.ledger_name)));
      setVendor(created.ledger_name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vendor ledger could not be created.');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cost > 0 && !vendor.trim()) { setError('Select the PUC vendor ledger when outsourced cost is entered.'); return; }
    setSaving(true); setError('');
    let createdId = '';
    try {
      const created = await vehicleOperationsApi.create(vehicleId, 'puc', {
        period,
        issue_date: issueDate,
        expiry_date: expiry,
        party_amount: charge,
        amount: cost,
        vendor: vendor.trim() || undefined,
        notes: cost > 0 ? `PUC outsourced to ${vendor.trim()} | Vendor payable ${money(cost)} | Monthly settlement` : 'PUC customer charge only',
      });
      createdId = created.id;

      if (charge > 0) {
        await vehicleOperationsApi.create(vehicleId, 'payment', {
          payment_type: 'PUC Bill',
          account: 'PUC SERVICE',
          issue_date: issueDate,
          billed_amount: charge,
          reference_number: `PUC-${issueDate}`,
          notes: `PUC customer charge | PUC record ${created.id}`,
        });
      }

      if (cost > 0) {
        await vehicleOperationsApi.create(vehicleId, 'agent_payment', {
          party_name: vendor.trim(),
          account: vendor.trim(),
          issue_date: issueDate,
          billed_amount: cost,
          paid_amount: 0,
          reference_number: `PUC-${issueDate}`,
          notes: `PUC vendor payable accrued for monthly settlement | PUC record ${created.id}`,
        });
      }

      setPeriod(''); setIssueDate(''); setCustomerCharge(''); setVendorCost(''); setVendor('');
      await load();
    } catch (e) {
      if (createdId) {
        try { await vehicleOperationsApi.remove(vehicleId, 'puc', createdId); } catch {}
      }
      setError(e instanceof Error ? e.message : 'PUC could not be saved with accounting entries.');
    } finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-[#f4f7fc] p-3 text-[#081a3a] sm:p-5 md:p-7">
    <div className="mx-auto max-w-7xl space-y-4">
      <section className="relative overflow-hidden rounded-[28px] border border-[#173d78] bg-[#071a3c] p-5 text-white shadow-[0_24px_70px_rgba(7,26,60,.20)] sm:p-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(43,117,255,.48),transparent_34%),linear-gradient(135deg,#06152f,#0a2555_60%,#0c3478)]" />
        <div className="relative flex items-center justify-between gap-4"><div><a href={`/vehicles/${vehicleId}`} className="text-xs font-bold text-blue-200">← Vehicle Profile</a><p className="mt-5 text-[9px] font-black uppercase tracking-[.24em] text-cyan-300">Emission & compliance</p><h1 className="mt-1 text-3xl font-black sm:text-4xl">PUC</h1><p className="mt-2 text-xs text-blue-100/70">Customer billing and monthly vendor settlement in one entry.</p></div><div className="grid h-20 w-20 place-items-center rounded-[24px] border border-white/10 bg-white/10 text-4xl">🌿</div></div>
      </section>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

      <form onSubmit={submit} className="overflow-hidden rounded-[28px] border border-[#d9e5f7] bg-white shadow-[0_18px_50px_rgba(26,64,120,.09)]">
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-white to-emerald-50/60 px-5 py-4 sm:px-6"><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-emerald-600">New PUC</p><h2 className="mt-1 text-xl font-black">PUC Entry</h2></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[9px] font-black uppercase text-emerald-700">Monthly vendor accounting</span></div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
          <label className={labelClass}>Period *<select required value={period} onChange={(e)=>setPeriod(e.target.value)} className={inputClass}><option value="">Select Period</option><option value="6">6 Month</option><option value="12">12 Month</option></select></label>
          <label className={labelClass}>Issue Date *<input type="date" required value={issueDate} onChange={(e)=>setIssueDate(e.target.value)} className={inputClass}/></label>
          <label className={labelClass}>Expire Date<input type="date" readOnly value={expiry} className={`${inputClass} cursor-not-allowed bg-blue-50/60`}/></label>

          <label className={labelClass}>Customer Charge *<div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</span><input type="number" min="0" step="0.01" required value={customerCharge} onChange={(e)=>setCustomerCharge(e.target.value)} className={`${inputClass} pl-7`} placeholder="100 / 200 / 0"/></div><span className="normal-case font-semibold tracking-normal text-slate-400">Free PUC ho to ₹0.</span></label>
          <label className={labelClass}>PUC Vendor Cost<div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</span><input type="number" min="0" step="0.01" value={vendorCost} onChange={(e)=>setVendorCost(e.target.value)} className={`${inputClass} pl-7`} placeholder="25 / 50"/></div><span className="normal-case font-semibold tracking-normal text-slate-400">Monthly vendor payable.</span></label>
          <label className={labelClass}>PUC Vendor Ledger{cost > 0 ? ' *' : ''}<div className="flex gap-2"><select required={cost > 0} value={vendor} onChange={(e)=>setVendor(e.target.value)} className={inputClass}><option value="">Select Vendor</option>{vendorLedgers.map((ledger)=><option key={ledger.id} value={ledger.ledger_name}>{ledger.ledger_name}</option>)}</select><button type="button" onClick={()=>void addVendorLedger()} className="h-12 shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-lg font-black text-emerald-700" title="Add vendor ledger">+</button></div><span className="normal-case font-semibold tracking-normal text-slate-400">Vendor = Sundry Creditor ledger. Monthly balance isi party ke naam se track hoga.</span></label>
        </div>

        <div className="mx-5 mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-[#f8fbff] p-4 sm:mx-6 sm:grid-cols-3">
          <MoneyCard label="Customer Receivable" value={charge} tone="blue" />
          <MoneyCard label="Vendor Payable" value={cost} tone="amber" />
          <MoneyCard label="PUC Margin" value={margin} tone={margin < 0 ? 'red' : 'green'} />
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-[#f8fbff] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><p className="text-[10px] font-semibold text-slate-500">Vendor cost is accrued against the selected creditor ledger and paid later in monthly settlement.</p><button disabled={saving || !expiry} className="min-w-[190px] rounded-2xl bg-gradient-to-r from-[#064e3b] to-[#059669] px-6 py-3.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(5,150,105,.25)] disabled:opacity-50">{saving ? 'Saving…' : '+ Add PUC'}</button></div>
      </form>

      <section className="overflow-hidden rounded-[28px] border border-[#d9e5f7] bg-white shadow-[0_14px_40px_rgba(26,64,120,.07)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">PUC history</p><h2 className="mt-1 text-xl font-black">PUC Records</h2></div><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search PUC / vendor" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-blue-400 sm:w-64"/></div>
        <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-xs sm:text-sm"><thead className="bg-[#f8fbff]"><tr className="text-left text-[9px] font-black uppercase tracking-wide text-slate-400"><th className="p-4">Period</th><th className="p-4">Issue</th><th className="p-4">Expiry</th><th className="p-4">Customer</th><th className="p-4">Vendor</th><th className="p-4">Cost</th><th className="p-4">Margin</th><th className="p-4">Status</th></tr></thead><tbody>{visible.map((row)=>{const c=Number(row.party_amount??0),v=Number(row.amount??0);return <tr key={row.id} className="border-t border-slate-100 hover:bg-emerald-50/30"><td className="p-4 font-black">{String(row.period??'—')} Month</td><td className="p-4">{formatDate(row.issue_date)}</td><td className="p-4">{formatDate(row.expiry_date)}</td><td className="p-4 font-black text-blue-700">{money(c)}</td><td className="p-4">{String(row.vendor??'—')}</td><td className="p-4 font-black text-amber-700">{money(v)}</td><td className={`p-4 font-black ${c-v<0?'text-rose-700':'text-emerald-700'}`}>{money(c-v)}</td><td className="p-4">{String(row.derived_status??row.status??'ACTIVE').replaceAll('_',' ')}</td></tr>})}</tbody></table>{visible.length===0&&<p className="p-10 text-center text-sm font-semibold text-slate-400">No PUC records added yet.</p>}</div>
      </section>
    </div>
  </main>;
}

function MoneyCard({label,value,tone}:{label:string;value:number;tone:'blue'|'amber'|'green'|'red'}){const styles={blue:'text-blue-700',amber:'text-amber-700',green:'text-emerald-700',red:'text-rose-700'};return <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-xl font-black ${styles[tone]}`}>{money(value)}</p></div>}
function addMonths(date:string,months:number){if(!date||!months)return '';const [y,m,d]=date.split('-').map(Number);const target=new Date(Date.UTC(y,m-1+months,d));if(target.getUTCDate()!==d)target.setUTCDate(0);return target.toISOString().slice(0,10)}
function formatDate(value:unknown){if(!value)return '—';const date=new Date(String(value));return Number.isNaN(date.getTime())?String(value):date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
