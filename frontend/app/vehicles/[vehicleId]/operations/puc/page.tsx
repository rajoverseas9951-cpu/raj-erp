'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { OperationalRecord, vehicleOperationsApi } from '@/lib/vehicle-operations';
import { Ledger, ledgerApi } from '@/lib/ledgers';

const inputClass = 'h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50';
const labelClass = 'grid gap-1.5 text-[11px] font-black uppercase tracking-[.04em] text-slate-500';
const money = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type LinkedRecord = OperationalRecord & { notes?: string };

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
  const [deletingId, setDeletingId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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

  function resetForm() {
    setPeriod(''); setIssueDate(''); setCustomerCharge(''); setVendorCost(''); setVendor(''); setEditingId('');
  }

  function openNew() {
    resetForm(); setError(''); setSuccess(''); setFormOpen(true);
    window.setTimeout(() => document.getElementById('puc-entry-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function editRow(row: OperationalRecord) {
    setEditingId(row.id);
    setPeriod(String(row.period ?? ''));
    setIssueDate(String(row.issue_date ?? '').slice(0, 10));
    setCustomerCharge(String(Number(row.party_amount ?? 0)));
    setVendorCost(String(Number(row.amount ?? 0)));
    setVendor(String(row.vendor ?? ''));
    setError(''); setSuccess(''); setFormOpen(true);
    window.setTimeout(() => document.getElementById('puc-entry-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function closeForm() {
    if (saving) return;
    resetForm(); setFormOpen(false); setError('');
  }

  async function addVendorLedger() {
    const name = prompt('PUC vendor name');
    if (!name?.trim()) return;
    try {
      const created = await ledgerApi.create({
        ledger_name: name.trim(), ledger_group: 'Sundry Creditors', opening_balance: 0, balance_type: 'credit', credit_limit: 0, credit_days: 30, gst_applicable: false, status: 'active',
      });
      setVendorLedgers((current) => [...current.filter((x) => x.id !== created.id), created].sort((a, b) => a.ledger_name.localeCompare(b.ledger_name)));
      setVendor(created.ledger_name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vendor ledger could not be created.');
    }
  }

  async function linkedRecords(module: 'payment' | 'agent_payment', pucId: string) {
    const all = await vehicleOperationsApi.list(vehicleId, module).catch(() => []);
    return (all as LinkedRecord[]).filter((record) => String(record.notes ?? '').includes(`PUC record ${pucId}`));
  }

  async function syncAccounting(pucId: string) {
    const [customerRows, vendorRows] = await Promise.all([
      linkedRecords('payment', pucId), linkedRecords('agent_payment', pucId),
    ]);

    if (charge > 0) {
      const body = { payment_type: 'Debit', account: 'PUC SERVICE', issue_date: issueDate, billed_amount: charge, reference_number: `PUC-${issueDate}`, notes: `PUC customer charge | PUC record ${pucId}` };
      if (customerRows[0]) await vehicleOperationsApi.update(vehicleId, 'payment', customerRows[0].id, body);
      else await vehicleOperationsApi.create(vehicleId, 'payment', body);
      for (const extra of customerRows.slice(1)) await vehicleOperationsApi.remove(vehicleId, 'payment', extra.id);
    } else {
      for (const row of customerRows) await vehicleOperationsApi.remove(vehicleId, 'payment', row.id);
    }

    if (cost > 0) {
      const body = { party_name: vendor.trim(), account: vendor.trim(), issue_date: issueDate, billed_amount: cost, paid_amount: 0, reference_number: `PUC-${issueDate}`, notes: `PUC vendor payable accrued for monthly settlement | PUC record ${pucId}` };
      if (vendorRows[0]) await vehicleOperationsApi.update(vehicleId, 'agent_payment', vendorRows[0].id, body);
      else await vehicleOperationsApi.create(vehicleId, 'agent_payment', body);
      for (const extra of vendorRows.slice(1)) await vehicleOperationsApi.remove(vehicleId, 'agent_payment', extra.id);
    } else {
      for (const row of vendorRows) await vehicleOperationsApi.remove(vehicleId, 'agent_payment', row.id);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cost > 0 && !vendor.trim()) { setError('Select the PUC vendor ledger when outsourced cost is entered.'); return; }
    setSaving(true); setError(''); setSuccess('');
    let createdId = '';
    try {
      const body = {
        period, issue_date: issueDate, expiry_date: expiry, party_amount: charge, amount: cost, vendor: vendor.trim() || undefined,
        notes: cost > 0 ? `PUC outsourced to ${vendor.trim()} | Vendor payable ${money(cost)} | Monthly settlement` : 'PUC customer charge only',
      };
      const record = editingId
        ? await vehicleOperationsApi.update(vehicleId, 'puc', editingId, body)
        : await vehicleOperationsApi.create(vehicleId, 'puc', body);
      createdId = editingId ? '' : record.id;
      await syncAccounting(record.id);
      await load();
      setSuccess(editingId ? 'PUC record and linked accounting updated.' : 'PUC added successfully. Vehicle status will now show Added.');
      resetForm(); setFormOpen(false);
    } catch (e) {
      if (createdId) {
        try { await vehicleOperationsApi.remove(vehicleId, 'puc', createdId); } catch {}
      }
      setError(e instanceof Error ? e.message : 'PUC could not be saved with accounting entries.');
    } finally { setSaving(false); }
  }

  async function removeRow(row: OperationalRecord) {
    if (!confirm(`Delete this ${String(row.period ?? '')} month PUC record? Linked customer/vendor accounting entries created by this PUC will also be removed.`)) return;
    setDeletingId(row.id); setError(''); setSuccess('');
    try {
      const [customerRows, vendorRows] = await Promise.all([linkedRecords('payment', row.id), linkedRecords('agent_payment', row.id)]);
      for (const linked of customerRows) await vehicleOperationsApi.remove(vehicleId, 'payment', linked.id);
      for (const linked of vendorRows) await vehicleOperationsApi.remove(vehicleId, 'agent_payment', linked.id);
      await vehicleOperationsApi.remove(vehicleId, 'puc', row.id);
      await load();
      if (editingId === row.id) { resetForm(); setFormOpen(false); }
      setSuccess('PUC record deleted. Linked accounting entries were removed too.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PUC record could not be deleted.');
    } finally { setDeletingId(''); }
  }

  return <main className="min-h-screen bg-[#f4f7fc] p-3 text-[#081a3a] sm:p-5 md:p-7">
    <div className="mx-auto max-w-7xl space-y-4">
      <section className="relative overflow-hidden rounded-[28px] border border-[#173d78] bg-[#071a3c] p-5 text-white shadow-[0_24px_70px_rgba(7,26,60,.20)] sm:p-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(43,117,255,.48),transparent_34%),linear-gradient(135deg,#06152f,#0a2555_60%,#0c3478)]" />
        <div className="relative flex items-center justify-between gap-4"><div><a href={`/vehicles/${vehicleId}`} className="text-xs font-bold text-blue-200">← Vehicle Profile</a><p className="mt-5 text-[9px] font-black uppercase tracking-[.24em] text-cyan-300">Emission & compliance</p><h1 className="mt-1 text-3xl font-black sm:text-4xl">PUC</h1><p className="mt-2 text-xs text-blue-100/70">View existing PUC first. Open the entry form only when you need to add or edit one.</p></div><div className="grid h-20 w-20 place-items-center rounded-[24px] border border-white/10 bg-white/10 text-4xl">🌿</div></div>
      </section>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}
      {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">✓ {success}</div>}

      {!formOpen && <section className="flex flex-col gap-3 rounded-[22px] border border-emerald-200 bg-[linear-gradient(135deg,#ffffff,#f0fdf7)] p-4 shadow-[0_10px_30px_rgba(5,150,105,.07)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div><p className="text-[9px] font-black uppercase tracking-[.2em] text-emerald-600">PUC Action</p><h2 className="mt-1 text-base font-black">Need another PUC entry?</h2><p className="mt-1 text-xs font-semibold text-slate-500">Existing records stay visible. Open the form only when required.</p></div>
        <button type="button" onClick={openNew} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#064e3b] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(6,78,59,.20)]"><span className="text-xl leading-none">＋</span> Add PUC</button>
      </section>}

      {formOpen && <form id="puc-entry-form" onSubmit={submit} className="overflow-hidden rounded-[28px] border border-[#d9e5f7] bg-white shadow-[0_18px_50px_rgba(26,64,120,.09)]">
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-white to-emerald-50/60 px-5 py-4 sm:px-6"><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-emerald-600">{editingId ? 'Edit PUC' : 'New PUC'}</p><h2 className="mt-1 text-xl font-black">{editingId ? 'Update PUC Entry' : 'PUC Entry'}</h2></div><button type="button" onClick={closeForm} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-lg font-black text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" title="Close form">×</button></div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
          <label className={labelClass}>Period *<select required value={period} onChange={(e)=>setPeriod(e.target.value)} className={inputClass}><option value="">Select Period</option><option value="6">6 Month</option><option value="12">12 Month</option></select></label>
          <label className={labelClass}>Issue Date *<input type="date" required value={issueDate} onChange={(e)=>setIssueDate(e.target.value)} className={inputClass}/></label>
          <label className={labelClass}>Expire Date<input type="date" readOnly value={expiry} className={`${inputClass} cursor-not-allowed bg-blue-50/60`}/></label>
          <label className={labelClass}>Customer Charge *<div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</span><input type="number" min="0" step="0.01" required value={customerCharge} onChange={(e)=>setCustomerCharge(e.target.value)} className={`${inputClass} pl-7`} placeholder="100 / 200 / 0"/></div><span className="normal-case font-semibold tracking-normal text-slate-400">Free PUC ho to ₹0.</span></label>
          <label className={labelClass}>PUC Vendor Cost<div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</span><input type="number" min="0" step="0.01" value={vendorCost} onChange={(e)=>setVendorCost(e.target.value)} className={`${inputClass} pl-7`} placeholder="25 / 50"/></div><span className="normal-case font-semibold tracking-normal text-slate-400">Monthly vendor payable.</span></label>
          <label className={labelClass}>PUC Vendor Ledger{cost > 0 ? ' *' : ''}<div className="flex gap-2"><select required={cost > 0} value={vendor} onChange={(e)=>setVendor(e.target.value)} className={inputClass}><option value="">Select Vendor</option>{vendorLedgers.map((ledger)=><option key={ledger.id} value={ledger.ledger_name}>{ledger.ledger_name}</option>)}</select><button type="button" onClick={()=>void addVendorLedger()} className="h-12 shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-lg font-black text-emerald-700" title="Add vendor ledger">+</button></div><span className="normal-case font-semibold tracking-normal text-slate-400">Vendor = Sundry Creditor ledger. Monthly balance isi party ke naam se track hoga.</span></label>
        </div>

        <div className="mx-5 mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-[#f8fbff] p-4 sm:mx-6 sm:grid-cols-3">
          <MoneyCard label="Customer Receivable" value={charge} tone="blue" /><MoneyCard label="Vendor Payable" value={cost} tone="amber" /><MoneyCard label="PUC Margin" value={margin} tone={margin < 0 ? 'red' : 'green'} />
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-[#f8fbff] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><p className="text-[10px] font-semibold text-slate-500">{editingId ? 'Updating this PUC also synchronizes the linked customer bill and vendor payable.' : 'Vendor cost is accrued against the selected creditor ledger and paid later in monthly settlement.'}</p><div className="flex gap-2"><button type="button" onClick={closeForm} className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-black text-slate-600">Cancel</button><button disabled={saving || !expiry} className="min-w-[190px] rounded-2xl bg-gradient-to-r from-[#064e3b] to-[#059669] px-6 py-3.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(5,150,105,.25)] disabled:opacity-50">{saving ? 'Saving…' : editingId ? '✓ Update PUC' : '+ Add PUC'}</button></div></div>
      </form>}

      <section className="overflow-hidden rounded-[28px] border border-[#d9e5f7] bg-white shadow-[0_14px_40px_rgba(26,64,120,.07)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">PUC history</p><h2 className="mt-1 text-xl font-black">PUC Records</h2></div><div className="flex w-full gap-2 sm:w-auto"><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search PUC / vendor" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-blue-400 sm:w-56"/><button type="button" onClick={openNew} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-600 text-xl font-black text-white shadow-sm" title="Add PUC">＋</button></div></div>
        <div className="overflow-x-auto"><table className="min-w-[1020px] w-full text-xs sm:text-sm"><thead className="bg-[#f8fbff]"><tr className="text-left text-[9px] font-black uppercase tracking-wide text-slate-400"><th className="p-4">Period</th><th className="p-4">Issue</th><th className="p-4">Expiry</th><th className="p-4">Customer</th><th className="p-4">Vendor</th><th className="p-4">Cost</th><th className="p-4">Margin</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>{visible.map((row)=>{const c=Number(row.party_amount??0),v=Number(row.amount??0);return <tr key={row.id} className="border-t border-slate-100 hover:bg-emerald-50/30"><td className="p-4 font-black">{String(row.period??'—')} Month</td><td className="p-4">{formatDate(row.issue_date)}</td><td className="p-4">{formatDate(row.expiry_date)}</td><td className="p-4 font-black text-blue-700">{money(c)}</td><td className="p-4">{String(row.vendor??'—')}</td><td className="p-4 font-black text-amber-700">{money(v)}</td><td className={`p-4 font-black ${c-v<0?'text-rose-700':'text-emerald-700'}`}>{money(c-v)}</td><td className="p-4"><StatusBadge value={String(row.derived_status??row.status??'ACTIVE')}/></td><td className="p-4"><div className="flex justify-end gap-2"><button type="button" onClick={()=>editRow(row)} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-black text-blue-700 transition hover:bg-blue-100">✎ Edit</button><button type="button" disabled={deletingId===row.id} onClick={()=>void removeRow(row)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-50">{deletingId===row.id?'Deleting…':'Delete'}</button></div></td></tr>})}</tbody></table>{visible.length===0&&<div className="grid place-items-center gap-3 p-10 text-center"><p className="text-sm font-semibold text-slate-400">No PUC records added yet.</p><button type="button" onClick={openNew} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white">＋ Add first PUC</button></div>}</div>
      </section>
    </div>
  </main>;
}

function MoneyCard({label,value,tone}:{label:string;value:number;tone:'blue'|'amber'|'green'|'red'}){const styles={blue:'text-blue-700',amber:'text-amber-700',green:'text-emerald-700',red:'text-rose-700'};return <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-xl font-black ${styles[tone]}`}>{money(value)}</p></div>}
function StatusBadge({value}:{value:string}){const normalized=value.toLowerCase();const active=!normalized.includes('expired')&&!normalized.includes('not_added');return <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${active?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500'}`}>{value.replaceAll('_',' ')}</span>}
function addMonths(date:string,months:number){if(!date||!months)return '';const [y,m,d]=date.split('-').map(Number);const target=new Date(Date.UTC(y,m-1+months,d));if(target.getUTCDate()!==d)target.setUTCDate(0);target.setUTCDate(target.getUTCDate()-1);return target.toISOString().slice(0,10)}
function formatDate(value:unknown){if(!value)return '—';const date=new Date(String(value));return Number.isNaN(date.getTime())?String(value):date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
