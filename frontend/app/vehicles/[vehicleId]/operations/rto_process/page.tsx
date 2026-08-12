'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { OperationalRecord, vehicleOperationsApi } from '@/lib/vehicle-operations';
import { VehicleMaster, vehicleMasterApi } from '@/lib/vehicle-masters';
import { Vehicle, vehicleApi } from '@/lib/vehicles';
import { authenticatedRequest } from '@/lib/api-client';

type Master = { id: string; name: string };
type Ledger = { id: string; ledger_name: string; ledger_group: string; status: string };
type GovtPayer = 'owner' | 'us' | 'agent';

const inputClass = 'h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50';
const labelClass = 'grid gap-1.5 text-[11px] font-black uppercase tracking-[.04em] text-slate-500';
const money = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function RtoProcessPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const searchParams = useSearchParams();
  const renewalMode = searchParams.get('mode') === 'renewal-registration';
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [rows, setRows] = useState<OperationalRecord[]>([]);
  const [workTypes, setWorkTypes] = useState<Master[]>([]);
  const [rtoOffices, setRtoOffices] = useState<VehicleMaster[]>([]);
  const [bankLedgers, setBankLedgers] = useState<Ledger[]>([]);
  const [selectedWorkType, setSelectedWorkType] = useState(renewalMode ? 'Renewal Registration' : '');
  const [faceless, setFaceless] = useState(true);
  const [rtoAgentEnabled, setRtoAgentEnabled] = useState(false);
  const [totalAmount, setTotalAmount] = useState('');
  const [governmentFee, setGovernmentFee] = useState('');
  const [governmentPaidBy, setGovernmentPaidBy] = useState<GovtPayer>('owner');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    try { setRows(await vehicleOperationsApi.list(vehicleId, 'rto_process')); }
    catch (e) { setError(e instanceof Error ? e.message : 'RTO records could not be loaded.'); }
  };

  const loadMasters = async () => {
    let work = await vehicleOperationsApi.masters('rto_work_type');
    if (renewalMode && !work.some((item) => item.name.toLowerCase() === 'renewal registration')) {
      try { const added = await vehicleOperationsApi.addMaster('rto_work_type', 'Renewal Registration'); work = [...work, added]; } catch {}
    }
    const offices = await vehicleMasterApi.list('rto_offices');
    const ledgers = await authenticatedRequest<Ledger[]>('/ledgers').catch(() => [] as Ledger[]);
    setWorkTypes(work.sort((a, b) => a.name.localeCompare(b.name)));
    setRtoOffices(offices.filter((row) => row.status === 'active').sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '') || a.name.localeCompare(b.name)));
    setBankLedgers(ledgers.filter((l) => l.status === 'active' && ['Bank Accounts', 'Cash-in-Hand'].includes(l.ledger_group)).sort((a, b) => a.ledger_name.localeCompare(b.ledger_name)));
  };

  useEffect(() => { void load(); }, [vehicleId]);
  useEffect(() => { void loadMasters().catch(() => undefined); }, [renewalMode]);
  useEffect(() => { vehicleApi.get(vehicleId).then(setVehicle).catch(() => setVehicle(null)); }, [vehicleId]);

  const total = Number(totalAmount || 0);
  const govt = Number(governmentFee || 0);
  const splitInvalid = govt > total && total > 0;
  const serviceOtherCharge = useMemo(() => Math.max(0, total - govt), [total, govt]);
  const customerLiability = useMemo(() => governmentPaidBy === 'owner' ? serviceOtherCharge : total, [governmentPaidBy, serviceOtherCharge, total]);

  async function addWorkType() {
    const name = prompt('New RTO work type');
    if (!name?.trim()) return;
    const added = await vehicleOperationsApi.addMaster('rto_work_type', name.trim());
    setWorkTypes((current) => current.some((x) => x.id === added.id) ? current : [...current, added].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedWorkType(added.name);
  }

  async function addRtoOffice() {
    const name = prompt('RTO office name, e.g. Palanpur (Banaskantha)');
    if (!name?.trim()) return;
    const code = prompt('RTO code, e.g. GJ-08')?.trim() ?? '';
    const added = await vehicleMasterApi.create('rto_offices', { name: name.trim(), code, status: 'active' });
    setRtoOffices((current) => [...current.filter((x) => x.id !== added.id), added].sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '') || a.name.localeCompare(b.name)));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (splitInvalid) { setError('Government fee cannot be more than total amount.'); return; }
    setSaving(true); setError('');
    const element = event.currentTarget;
    const form = new FormData(element);
    form.set('faceless_appointment', faceless ? '1' : '0');
    form.set('government_fee_paid_by', govt > 0 ? governmentPaidBy : 'owner');
    if (faceless) form.delete('process_date');
    if (!rtoAgentEnabled) { form.delete('external_agent'); form.delete('agent_amount'); }
    if (vehicle?.broker_agent_enabled) { form.set('broker', vehicle.broker_name ?? ''); form.set('assigned_agent', vehicle.agent_name ?? ''); }
    else { form.delete('broker'); form.delete('assigned_agent'); }
    if (governmentPaidBy !== 'us' || govt <= 0) form.delete('government_fee_bank_ledger_id');
    const body = Object.fromEntries([...form.entries()].filter(([, value]) => value !== ''));
    try {
      await authenticatedRequest(`/vehicles/${vehicleId}/rto-work-accounting`, { method: 'POST', body: JSON.stringify(body) });
      element.reset();
      setSelectedWorkType(renewalMode ? 'Renewal Registration' : '');
      setFaceless(true); setRtoAgentEnabled(false); setTotalAmount(''); setGovernmentFee(''); setGovernmentPaidBy('owner');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'RTO process could not be saved.'); }
    finally { setSaving(false); }
  }

  const visible = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));

  return <main className="min-h-screen bg-[#f4f7fc] p-3 text-[#081a3a] sm:p-5 lg:p-7"><div className="mx-auto max-w-[1450px] space-y-5">
    <section className="relative overflow-hidden rounded-[30px] border border-[#173d78] bg-[#071a3c] p-5 text-white shadow-[0_24px_70px_rgba(7,26,60,.20)] sm:p-7">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,rgba(43,117,255,.48),transparent_34%),linear-gradient(135deg,#06152f,#0a2555_60%,#0c3478)]"/>
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><a href={`/vehicles/${vehicleId}`} className="text-xs font-bold text-blue-200 hover:text-white">← Vehicle Profile</a><p className="mt-5 text-[9px] font-black uppercase tracking-[.24em] text-cyan-300">{renewalMode ? 'Registration renewal desk' : 'RTO work desk'}</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{renewalMode ? 'Renewal Registration' : 'RTO Process'}</h1><p className="mt-2 max-w-2xl text-sm text-blue-100/70">Enter the total customer charge once. Government fee is split separately and posted through a clearing account.</p></div><div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-right backdrop-blur"><p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">Total records</p><p className="mt-1 text-3xl font-black">{rows.length}</p></div></div>
    </section>

    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

    <form onSubmit={submit} className="overflow-hidden rounded-[28px] border border-[#d9e5f7] bg-white shadow-[0_16px_45px_rgba(26,64,120,.08)]">
      <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/70 px-5 py-4 sm:px-6"><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">{renewalMode ? 'New renewal registration' : 'New RTO work'}</p><h2 className="mt-1 text-xl font-black">Vehicle RTO Process Detail</h2></div><a href="/masters" className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] font-black text-blue-700">Manage Masters →</a></div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
        <MasterSelect name="work_type" label="Work Type" required rows={workTypes} onAdd={() => void addWorkType()} value={selectedWorkType} onChange={setSelectedWorkType}/>
        <Field name="receipt_date" label="Date" type="date" required/>
        <Field name="reference_number" label="Application No" required/>
        <MasterSelect name="rto_office" label="RTO Office" rows={rtoOffices.map((x) => ({ id: x.id, name: `${x.code ? `${x.code} · ` : ''}${x.name}` }))} onAdd={() => void addRtoOffice()} required/>
        <Toggle label="RTO Agent" enabled={rtoAgentEnabled} onChange={setRtoAgentEnabled}/>
        {rtoAgentEnabled && <Field name="external_agent" label="RTO Agent Name" required/>}
        {rtoAgentEnabled && <Field name="agent_amount" label="RTO Agent Amount" type="number" required/>}
        {vehicle?.broker_agent_enabled && <ReadOnlyField label="Broker" value={vehicle.broker_name || '—'}/>} 
        {vehicle?.broker_agent_enabled && <ReadOnlyField label="Agent" value={vehicle.agent_name || '—'}/>} 
        <Toggle label="Faceless Appointment" enabled={faceless} onChange={setFaceless}/>
        {!faceless && <Field name="process_date" label="Application Date" type="date" required/>}
        <Field name="approval_date" label="Approve Date" type="date"/><Field name="rc_received_date" label="RC Rec Date" type="date"/><Field name="rc_delivered_date" label="RC Deliver Date" type="date"/><Field name="period" label="RC Status"/>
        <label className={labelClass}>Status<select name="status" defaultValue="ACTIVE" className={inputClass}><option value="ACTIVE">Active</option><option value="PENDING">Pending</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select></label>
      </div>

      <section className="mx-5 mb-5 overflow-hidden rounded-[26px] border border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-emerald-50/50 sm:mx-6 sm:mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-blue-100 px-5 py-4">
          <div><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-600">Billing & statutory payment</p><h3 className="mt-1 text-lg font-black text-slate-950">One total → clean accounting split</h3><p className="mt-1 max-w-2xl text-xs font-semibold text-slate-500">Total is what you charge. Government fee moves through <b>GOVERNMENT FEE CLEARING</b>; only the balance is RTO income.</p></div>
          <div className="rounded-2xl bg-[#081f49] px-5 py-3 text-right text-white shadow-lg"><p className="text-[9px] font-black uppercase tracking-wider text-blue-200">Customer Receivable</p><p className="mt-1 text-2xl font-black">{money(customerLiability)}</p></div>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-3">
          <label className={labelClass}>Total Amount Charged *<input name="amount" type="number" min="0" step="0.01" required value={totalAmount} onChange={(e)=>setTotalAmount(e.target.value)} className={inputClass}/><span className="normal-case font-semibold tracking-normal text-slate-400">Full amount quoted to customer, including government fee.</span></label>
          <label className={labelClass}>Government Fee<input name="government_fee" type="number" min="0" step="0.01" value={governmentFee} onChange={(e)=>{ setGovernmentFee(e.target.value); if (Number(e.target.value || 0) <= 0) setGovernmentPaidBy('owner'); }} className={`${inputClass} ${splitInvalid ? 'border-rose-400 ring-4 ring-rose-50' : ''}`}/><span className={`normal-case font-semibold tracking-normal ${splitInvalid ? 'text-rose-600' : 'text-slate-400'}`}>{splitInvalid ? 'Government fee cannot exceed total amount.' : 'Official/statutory amount only.'}</span></label>
          <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm"><p className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-700">Service + Other Charge</p><p className="mt-2 text-2xl font-black text-slate-950">{money(serviceOtherCharge)}</p><p className="mt-1 text-xs font-semibold text-slate-500">Auto = Total − Government Fee. This is the RTO income component.</p></div>
        </div>

        <div className="border-t border-blue-100 bg-white/80 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-slate-400">Government fee settlement</p><p className="mt-1 text-sm font-black text-slate-900">Who actually paid the government fee?</p></div><span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-violet-700">Ledger: Government Fee Clearing</span></div>

          <div className="grid gap-3 lg:grid-cols-3">
            <button type="button" disabled={govt <= 0} onClick={()=>setGovernmentPaidBy('owner')} className={`rounded-2xl border p-4 text-left transition ${governmentPaidBy==='owner' && govt>0 ? 'border-blue-400 bg-blue-50 ring-4 ring-blue-50' : 'border-slate-200 bg-white'} ${govt<=0 ? 'cursor-not-allowed opacity-45' : 'hover:border-blue-300'}`}><p className="text-xs font-black text-slate-950">Owner / Customer</p><p className="mt-1 text-[11px] font-semibold text-slate-500">Paid directly by owner. No bank entry in our books.</p></button>
            <button type="button" disabled={govt <= 0} onClick={()=>setGovernmentPaidBy('us')} className={`rounded-2xl border p-4 text-left transition ${governmentPaidBy==='us' && govt>0 ? 'border-emerald-400 bg-emerald-50 ring-4 ring-emerald-50' : 'border-slate-200 bg-white'} ${govt<=0 ? 'cursor-not-allowed opacity-45' : 'hover:border-emerald-300'}`}><p className="text-xs font-black text-slate-950">Paid by Us</p><p className="mt-1 text-[11px] font-semibold text-slate-500">Select the exact Bank/Cash account below.</p></button>
            <button type="button" disabled={govt <= 0} onClick={()=>setGovernmentPaidBy('agent')} className={`rounded-2xl border p-4 text-left transition ${governmentPaidBy==='agent' && govt>0 ? 'border-amber-400 bg-amber-50 ring-4 ring-amber-50' : 'border-slate-200 bg-white'} ${govt<=0 ? 'cursor-not-allowed opacity-45' : 'hover:border-amber-300'}`}><p className="text-xs font-black text-slate-950">Paid by RTO Agent</p><p className="mt-1 text-[11px] font-semibold text-slate-500">Creates agent payable for the statutory amount.</p></button>
          </div>

          {govt <= 0 && <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">Enter Government Fee first. Payment source and Bank/Cash selection will activate here.</div>}

          {govt > 0 && governmentPaidBy === 'us' && <div className="mt-4 grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 lg:grid-cols-[1fr_1fr]">
            <label className={labelClass}>Paid From Bank / Cash *<select name="government_fee_bank_ledger_id" required className={`${inputClass} border-emerald-300 bg-white`}><option value="">Select Bank / Cash Account</option>{bankLedgers.map((l)=><option key={l.id} value={l.id}>{l.ledger_name}</option>)}</select><span className="normal-case font-semibold tracking-normal text-emerald-700">This account will be credited automatically for {money(govt)}.</span></label>
            <div className="rounded-xl bg-white p-4 ring-1 ring-emerald-200"><p className="text-[9px] font-black uppercase tracking-wider text-emerald-700">Posting Preview</p><div className="mt-2 grid gap-1 text-xs font-semibold text-slate-600"><span>Dr Government Fee Clearing <b className="float-right text-slate-950">{money(govt)}</b></span><span>Cr Selected Bank / Cash <b className="float-right text-slate-950">{money(govt)}</b></span></div></div>
          </div>}

          {govt > 0 && governmentPaidBy === 'owner' && <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-800">Owner paid the government fee directly. Customer receivable is only <b>{money(serviceOtherCharge)}</b>. No bank/cash or clearing voucher is posted by us.</div>}
          {govt > 0 && governmentPaidBy === 'agent' && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">RTO Agent paid the government fee. Turn ON <b>RTO Agent</b> above and select/enter the agent. Customer owes full <b>{money(total)}</b>; the same government-fee amount becomes payable to that agent.</div>}
          <input type="hidden" name="government_fee_paid_by" value={govt > 0 ? governmentPaidBy : 'owner'}/>
        </div>
      </section>

      <div className="px-5 pb-5 sm:px-6"><label className={labelClass}>Remark<textarea name="notes" rows={3} className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"/></label></div>
      <div className="flex flex-col gap-3 border-t border-slate-100 bg-[#f8fbff] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><p className="text-[10px] font-semibold text-slate-500">Income = Service + Other Charge. Government fee is reconciled through Government Fee Clearing.</p><button disabled={saving || splitInvalid} className="min-w-[190px] rounded-2xl bg-gradient-to-r from-[#0b2b62] to-[#2563eb] px-6 py-3.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(37,99,235,.28)] transition hover:-translate-y-0.5 disabled:opacity-50">{saving ? 'Saving…' : '✓ Save RTO Work'}</button></div>
    </form>

    <section className="overflow-hidden rounded-[28px] border border-[#d9e5f7] bg-white shadow-[0_14px_40px_rgba(26,64,120,.07)]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">RTO history</p><h2 className="mt-1 text-xl font-black">Process Records</h2></div><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search application, RTO, agent…" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-blue-400 sm:w-72"/></div><div className="overflow-x-auto"><table className="min-w-[1200px] w-full text-xs sm:text-sm"><thead className="bg-[#f8fbff]"><tr className="text-left text-[9px] font-black uppercase tracking-wide text-slate-400"><th className="p-4">Work</th><th className="p-4">Total Amount</th><th className="p-4">Govt Fee</th><th className="p-4">Service / Other</th><th className="p-4">Govt Paid By</th><th className="p-4">Customer Due</th><th className="p-4">Application</th><th className="p-4">RTO</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead><tbody>{visible.map((row)=>{ const rowTotal=Number(row.amount??0); const rowGovt=Number(row.government_fee??0); const rowService=Math.max(0,rowTotal-rowGovt); const payer=String(row.government_fee_paid_by??'owner'); return <tr key={row.id} className="border-t border-slate-100 hover:bg-blue-50/30"><td className="p-4 font-black">{String(row.work_type??'—')}</td><td className="p-4 font-black">{money(rowTotal)}</td><td className="p-4">{money(rowGovt)}</td><td className="p-4 font-semibold text-emerald-700">{money(rowService)}</td><td className="p-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase text-slate-700">{payer==='us'?'Office':payer==='agent'?'RTO Agent':'Owner'}</span></td><td className="p-4 font-black text-blue-700">{money(Number(row.customer_bill_amount??rowTotal))}</td><td className="p-4 font-semibold text-blue-700">{String(row.reference_number??'—')}</td><td className="p-4">{String(row.rto_office??'—')}</td><td className="p-4"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-black uppercase text-blue-700">{String(row.status??'ACTIVE')}</span></td><td className="p-4"><button onClick={()=>confirm('Archive this RTO record?')&&vehicleOperationsApi.remove(vehicleId,'rto_process',row.id).then(load)} className="font-black text-rose-600">Archive</button></td></tr>;})}</tbody></table>{visible.length===0&&<p className="p-10 text-center text-sm font-semibold text-slate-400">No RTO work records added yet.</p>}</div></section>
  </div></main>;
}

function Field({ name, label, type='text', required=false }: { name:string; label:string; type?:string; required?:boolean }) { return <label className={labelClass}>{label}{required?' *':''}<input name={name} type={type} required={required} step={type==='number'?'0.01':undefined} className={inputClass}/></label>; }
function ReadOnlyField({ label, value }: { label:string; value:string }) { return <label className={labelClass}>{label}<div className={`${inputClass} flex items-center bg-blue-50/60 text-blue-950`}>{value}</div></label>; }
function Toggle({ label, enabled, onChange }: { label:string; enabled:boolean; onChange:(value:boolean)=>void }) { return <label className={labelClass}>{label}<div className="flex h-12 items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-3"><span className={`text-xs font-black ${enabled?'text-blue-700':'text-slate-400'}`}>{enabled?'ON':'OFF'}</span><button type="button" role="switch" aria-checked={enabled} onClick={()=>onChange(!enabled)} className={`relative h-7 w-12 rounded-full transition ${enabled?'bg-blue-600':'bg-slate-300'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${enabled?'left-6':'left-1'}`}/></button></div></label>; }
function MasterSelect({ name,label,rows,onAdd,required=false,value,onChange }: { name:string; label:string; rows:Master[]; onAdd:()=>void; required?:boolean; value?:string; onChange?:(value:string)=>void }) { return <label className={labelClass}>{label}{required?' *':''}<div className="flex gap-2"><select name={name} required={required} value={value} onChange={(e)=>onChange?.(e.target.value)} className={inputClass}><option value="">Select</option>{rows.map((item)=><option key={item.id} value={item.name}>{item.name}</option>)}</select><button type="button" onClick={onAdd} title={`Add ${label}`} className="h-12 shrink-0 rounded-xl border border-blue-100 bg-blue-50 px-4 text-lg font-black text-blue-700 hover:bg-blue-100">+</button></div></label>; }
