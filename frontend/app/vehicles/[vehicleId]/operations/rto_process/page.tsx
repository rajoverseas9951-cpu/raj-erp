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
const asString = (value: unknown) => value == null ? '' : String(value);
const asBool = (value: unknown) => value === true || value === 1 || value === '1';
const normGroup = (value: string) => value.toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ').replace(/\s+/g, ' ').trim();

export default function RtoProcessPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const searchParams = useSearchParams();
  const renewalMode = searchParams.get('mode') === 'renewal-registration';

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [rows, setRows] = useState<OperationalRecord[]>([]);
  const [workTypes, setWorkTypes] = useState<Master[]>([]);
  const [rtoOffices, setRtoOffices] = useState<VehicleMaster[]>([]);
  const [bankLedgers, setBankLedgers] = useState<Ledger[]>([]);
  const [agentLedgers, setAgentLedgers] = useState<Ledger[]>([]);
  const [showForm, setShowForm] = useState(renewalMode);
  const [editing, setEditing] = useState<OperationalRecord | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [selectedWorkType, setSelectedWorkType] = useState(renewalMode ? 'Renewal Registration' : '');
  const [selectedRtoOffice, setSelectedRtoOffice] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [faceless, setFaceless] = useState(true);
  const [rtoAgentEnabled, setRtoAgentEnabled] = useState(false);
  const [totalAmount, setTotalAmount] = useState('');
  const [governmentFee, setGovernmentFee] = useState('');
  const [governmentPaidBy, setGovernmentPaidBy] = useState<GovtPayer>('owner');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      setRows(await vehicleOperationsApi.list(vehicleId, 'rto_process'));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'RTO records could not be loaded.');
    }
  };

  const loadMasters = async () => {
    let work = await vehicleOperationsApi.masters('rto_work_type');
    if (renewalMode && !work.some((item) => item.name.toLowerCase() === 'renewal registration')) {
      try {
        const added = await vehicleOperationsApi.addMaster('rto_work_type', 'Renewal Registration');
        work = [...work, added];
      } catch {}
    }
    const offices = await vehicleMasterApi.list('rto_offices');
    const ledgers = await authenticatedRequest<Ledger[]>('/ledgers').catch(() => [] as Ledger[]);
    const active = ledgers.filter((l) => l.status === 'active');
    setWorkTypes(work.sort((a, b) => a.name.localeCompare(b.name)));
    setRtoOffices(offices.filter((row) => row.status === 'active').sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '') || a.name.localeCompare(b.name)));
    setBankLedgers(active.filter((l) => ['bank accounts', 'cash in hand'].includes(normGroup(l.ledger_group))).sort((a, b) => a.ledger_name.localeCompare(b.ledger_name)));
    setAgentLedgers(active.filter((l) => ['sundry creditors', 'creditors'].includes(normGroup(l.ledger_group))).sort((a, b) => a.ledger_name.localeCompare(b.ledger_name)));
  };

  useEffect(() => { void load(); }, [vehicleId]);
  useEffect(() => { void loadMasters().catch(() => undefined); }, [renewalMode]);
  useEffect(() => { vehicleApi.get(vehicleId).then(setVehicle).catch(() => setVehicle(null)); }, [vehicleId]);

  const total = Number(totalAmount || 0);
  const govt = Number(governmentFee || 0);
  const splitInvalid = !editing && govt > total && total > 0;
  const serviceOtherCharge = useMemo(() => Math.max(0, total - govt), [total, govt]);
  const customerLiability = useMemo(() => governmentPaidBy === 'owner' ? serviceOtherCharge : total, [governmentPaidBy, serviceOtherCharge, total]);

  function startAdd() {
    setEditing(null);
    setSelectedWorkType(renewalMode ? 'Renewal Registration' : '');
    setSelectedRtoOffice('');
    setSelectedAgent('');
    setFaceless(true);
    setRtoAgentEnabled(false);
    setTotalAmount('');
    setGovernmentFee('');
    setGovernmentPaidBy('owner');
    setError('');
    setFormKey((n) => n + 1);
    setShowForm(true);
    setTimeout(() => document.getElementById('rto-entry-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function startEdit(row: OperationalRecord) {
    setEditing(row);
    setSelectedWorkType(asString(row.work_type));
    setSelectedRtoOffice(asString(row.rto_office));
    setSelectedAgent(asString(row.external_agent));
    setFaceless(asBool(row.faceless_appointment));
    setRtoAgentEnabled(Boolean(asString(row.external_agent) || Number(row.agent_amount ?? 0) > 0));
    setTotalAmount(asString(row.amount));
    setGovernmentFee(asString(row.government_fee));
    setGovernmentPaidBy((asString(row.government_fee_paid_by) || 'owner') as GovtPayer);
    setError('');
    setFormKey((n) => n + 1);
    setShowForm(true);
    setTimeout(() => document.getElementById('rto-entry-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setError('');
  }

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
    setSelectedRtoOffice(`${added.code ? `${added.code} · ` : ''}${added.name}`);
  }

  async function addRtoAgentLedger() {
    const name = prompt('RTO Agent / Party name');
    if (!name?.trim()) return;
    try {
      const added = await authenticatedRequest<Ledger>('/ledgers', {
        method: 'POST',
        body: JSON.stringify({
          ledger_name: name.trim(),
          ledger_group: 'Sundry Creditors',
          opening_balance: 0,
          balance_type: 'credit',
          status: 'active',
        }),
      });
      setAgentLedgers((current) => [...current.filter((x) => x.id !== added.id), added].sort((a, b) => a.ledger_name.localeCompare(b.ledger_name)));
      setSelectedAgent(added.ledger_name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'RTO Agent ledger could not be created.');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (splitInvalid) { setError('Government fee cannot be more than total amount.'); return; }
    if (rtoAgentEnabled && !selectedAgent) { setError('Select an RTO Agent ledger.'); return; }
    setSaving(true);
    setError('');

    const form = new FormData(event.currentTarget);
    form.set('faceless_appointment', faceless ? '1' : '0');
    if (faceless) form.delete('process_date');
    if (rtoAgentEnabled) form.set('external_agent', selectedAgent);
    else { form.delete('external_agent'); form.delete('agent_amount'); }
    if (vehicle?.broker_agent_enabled) {
      form.set('broker', vehicle.broker_name ?? '');
      form.set('assigned_agent', vehicle.agent_name ?? '');
    } else {
      form.delete('broker');
      form.delete('assigned_agent');
    }

    try {
      if (editing) {
        form.delete('amount');
        form.delete('government_fee');
        form.delete('government_fee_paid_by');
        form.delete('government_fee_bank_ledger_id');
        const body = Object.fromEntries([...form.entries()].filter(([, value]) => value !== ''));
        await vehicleOperationsApi.update(vehicleId, 'rto_process', editing.id, body);
      } else {
        form.set('government_fee_paid_by', govt > 0 ? governmentPaidBy : 'owner');
        if (governmentPaidBy !== 'us' || govt <= 0) form.delete('government_fee_bank_ledger_id');
        const body = Object.fromEntries([...form.entries()].filter(([, value]) => value !== ''));
        await authenticatedRequest(`/vehicles/${vehicleId}/rto-work-accounting`, { method: 'POST', body: JSON.stringify(body) });
      }
      await load();
      closeForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'RTO process could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row: OperationalRecord) {
    if (!confirm(`Delete RTO work ${asString(row.reference_number) || ''}? Linked accounting entries will also be cancelled.`)) return;
    setDeletingId(row.id);
    setError('');
    try {
      await authenticatedRequest(`/vehicles/${vehicleId}/rto-work-records/${row.id}`, { method: 'DELETE' });
      if (editing?.id === row.id) closeForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'RTO record could not be deleted.');
    } finally {
      setDeletingId('');
    }
  }

  const visible = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="min-h-screen bg-[#f4f7fc] p-3 text-[#081a3a] sm:p-5 lg:p-7">
      <div className="mx-auto max-w-[1450px] space-y-5">
        <section className="relative overflow-hidden rounded-[30px] border border-[#173d78] bg-[#071a3c] p-5 text-white shadow-[0_24px_70px_rgba(7,26,60,.20)] sm:p-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,rgba(43,117,255,.48),transparent_34%),linear-gradient(135deg,#06152f,#0a2555_60%,#0c3478)]" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div><a href={`/vehicles/${vehicleId}`} className="text-xs font-bold text-blue-200 hover:text-white">← Vehicle Profile</a><p className="mt-5 text-[9px] font-black uppercase tracking-[.24em] text-cyan-300">RTO work desk</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{renewalMode ? 'Renewal Registration' : 'RTO Process'}</h1><p className="mt-2 max-w-2xl text-sm text-blue-100/70">RTO work, customer billing and agent payable in one controlled entry.</p></div>
            <div className="flex flex-wrap items-center gap-3"><div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-right"><p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">Total records</p><p className="mt-1 text-3xl font-black">{rows.length}</p></div><button type="button" onClick={startAdd} className="rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-[#0b2b62]">＋ Add RTO Work</button></div>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

        <section className="overflow-hidden rounded-[28px] border border-[#d9e5f7] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">RTO history</p><h2 className="mt-1 text-xl font-black">Process Records</h2></div><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search application, RTO, agent…" className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none sm:w-72" /></div>
          <div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-sm"><thead className="bg-[#f8fbff]"><tr className="text-left text-[9px] font-black uppercase tracking-wide text-slate-400"><th className="p-4">Work</th><th className="p-4">Application</th><th className="p-4">RTO</th><th className="p-4">Agent</th><th className="p-4">Total</th><th className="p-4">Customer Due</th><th className="p-4">Status</th><th className="p-4">Actions</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="p-4 font-black">{asString(row.work_type) || '—'}</td><td className="p-4">{asString(row.reference_number) || '—'}</td><td className="p-4">{asString(row.rto_office) || '—'}</td><td className="p-4">{asString(row.external_agent) || '—'}</td><td className="p-4 font-black">{money(Number(row.amount ?? 0))}</td><td className="p-4 font-black text-blue-700">{money(Number(row.customer_bill_amount ?? row.amount ?? 0))}</td><td className="p-4">{asString(row.status) || 'ACTIVE'}</td><td className="p-4"><div className="flex gap-3"><button type="button" onClick={() => startEdit(row)} className="font-black text-blue-700">✎ Edit</button><button type="button" disabled={deletingId === row.id} onClick={() => void deleteRow(row)} className="font-black text-rose-600">{deletingId === row.id ? 'Deleting…' : 'Delete'}</button></div></td></tr>)}</tbody></table>{visible.length === 0 && <div className="p-10 text-center text-sm font-semibold text-slate-400">No RTO work records added yet.</div>}</div>
        </section>

        {showForm && <form id="rto-entry-form" key={formKey} onSubmit={submit} className="overflow-hidden rounded-[28px] border border-[#d9e5f7] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">{editing ? 'Edit RTO work' : 'New RTO work'}</p><h2 className="mt-1 text-xl font-black">Vehicle RTO Process Detail</h2></div><button type="button" onClick={closeForm} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black">✕ Close</button></div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
            <MasterSelect name="work_type" label="Work Type" required rows={workTypes} onAdd={() => void addWorkType()} value={selectedWorkType} onChange={setSelectedWorkType} />
            <Field name="receipt_date" label="Date" type="date" required defaultValue={asString(editing?.receipt_date)} />
            <Field name="reference_number" label="Application No" required defaultValue={asString(editing?.reference_number)} />
            <MasterSelect name="rto_office" label="RTO Office" rows={rtoOffices.map((x) => ({ id: x.id, name: `${x.code ? `${x.code} · ` : ''}${x.name}` }))} onAdd={() => void addRtoOffice()} required value={selectedRtoOffice} onChange={setSelectedRtoOffice} />
            <Toggle label="RTO Agent" enabled={rtoAgentEnabled} onChange={(value) => { setRtoAgentEnabled(value); if (!value) setSelectedAgent(''); }} />
            {rtoAgentEnabled && <label className={labelClass}>RTO Agent Ledger *<div className="flex gap-2"><select name="external_agent" required value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} className={inputClass}><option value="">Select RTO Agent</option>{agentLedgers.map((l) => <option key={l.id} value={l.ledger_name}>{l.ledger_name}</option>)}</select><button type="button" onClick={() => void addRtoAgentLedger()} className="h-12 w-12 shrink-0 rounded-xl border border-blue-200 bg-blue-50 text-lg font-black text-blue-700">＋</button></div><span className="normal-case font-semibold tracking-normal text-slate-400">Sundry Creditor ledger. Agent payable will be tracked against this party.</span></label>}
            {rtoAgentEnabled && <Field name="agent_amount" label="RTO Agent Amount" type="number" required defaultValue={asString(editing?.agent_amount)} />}
            <Toggle label="Faceless Appointment" enabled={faceless} onChange={setFaceless} />
            {!faceless && <Field name="process_date" label="Application Date" type="date" required defaultValue={asString(editing?.process_date)} />}
            <Field name="approval_date" label="Approve Date" type="date" defaultValue={asString(editing?.approval_date)} />
            <Field name="rc_received_date" label="RC Rec Date" type="date" defaultValue={asString(editing?.rc_received_date)} />
            <Field name="rc_delivered_date" label="RC Deliver Date" type="date" defaultValue={asString(editing?.rc_delivered_date)} />
            <Field name="period" label="RC Status" defaultValue={asString(editing?.period)} />
            <label className={labelClass}>Status<select name="status" defaultValue={asString(editing?.status) || 'ACTIVE'} className={inputClass}><option value="ACTIVE">Active</option><option value="PENDING">Pending</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select></label>
          </div>

          {!editing && <section className="mx-5 mb-5 rounded-[24px] border border-slate-200 bg-[#fbfdff] p-5 sm:mx-6 sm:mb-6"><div className="grid gap-4 lg:grid-cols-3"><label className={labelClass}>Total Amount *<input name="amount" type="number" min="0" step="0.01" required value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className={inputClass} /></label><label className={labelClass}>Government Fee<input name="government_fee" type="number" min="0" step="0.01" value={governmentFee} onChange={(e) => setGovernmentFee(e.target.value)} className={inputClass} /></label><Summary label="Service + Other" value={money(serviceOtherCharge)} /></div>{govt > 0 && <div className="mt-4 grid gap-4 lg:grid-cols-3"><label className={labelClass}>Government Fee Paid By<select value={governmentPaidBy} onChange={(e) => setGovernmentPaidBy(e.target.value as GovtPayer)} className={inputClass}><option value="owner">Customer / Owner</option><option value="us">Office / Us</option><option value="agent">RTO Agent</option></select></label>{governmentPaidBy === 'us' && <label className={labelClass}>Paid From Bank / Cash *<select name="government_fee_bank_ledger_id" required className={inputClass}><option value="">Select Bank / Cash</option>{bankLedgers.map((l) => <option key={l.id} value={l.id}>{l.ledger_name}</option>)}</select></label>}<Summary label="Customer Receivable" value={money(customerLiability)} /></div>}<input type="hidden" name="government_fee_paid_by" value={govt > 0 ? governmentPaidBy : 'owner'} /></section>}

          <div className="px-5 pb-5 sm:px-6"><label className={labelClass}>Remark<textarea name="notes" defaultValue={asString(editing?.notes)} rows={3} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm" /></label></div>
          <div className="flex justify-end gap-2 border-t border-slate-100 bg-[#f8fbff] p-4 sm:px-6"><button type="button" onClick={closeForm} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black">Cancel</button><button disabled={saving || splitInvalid} className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? 'Saving…' : editing ? '✓ Update RTO Work' : '✓ Save RTO Work'}</button></div>
        </form>}
      </div>
    </main>
  );
}

function Field({ name, label, type = 'text', required = false, defaultValue = '' }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string }) { return <label className={labelClass}>{label}{required ? ' *' : ''}<input name={name} type={type} required={required} defaultValue={defaultValue} step={type === 'number' ? '0.01' : undefined} className={inputClass} /></label>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3"><p className="text-[9px] font-black uppercase tracking-wider text-emerald-700">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>; }
function Toggle({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (value: boolean) => void }) { return <label className={labelClass}>{label}<div className="flex h-12 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3"><span className={`text-xs font-black ${enabled ? 'text-blue-700' : 'text-slate-400'}`}>{enabled ? 'ON' : 'OFF'}</span><button type="button" onClick={() => onChange(!enabled)} className={`relative h-7 w-12 rounded-full ${enabled ? 'bg-blue-600' : 'bg-slate-300'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${enabled ? 'left-6' : 'left-1'}`} /></button></div></label>; }
function MasterSelect({ name, label, rows, onAdd, required = false, value, onChange }: { name: string; label: string; rows: Master[]; onAdd: () => void; required?: boolean; value?: string; onChange?: (value: string) => void }) { return <label className={labelClass}>{label}{required ? ' *' : ''}<div className="flex gap-2"><select name={name} required={required} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} className={inputClass}><option value="">Select</option>{rows.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><button type="button" onClick={onAdd} className="h-12 w-12 shrink-0 rounded-xl border border-blue-200 bg-blue-50 text-lg font-black text-blue-700">＋</button></div></label>; }
