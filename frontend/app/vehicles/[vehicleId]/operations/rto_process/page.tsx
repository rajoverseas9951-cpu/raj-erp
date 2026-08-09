'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { OperationalRecord, vehicleOperationsApi } from '@/lib/vehicle-operations';
import { VehicleMaster, vehicleMasterApi } from '@/lib/vehicle-masters';

type Master = { id: string; name: string };

const inputClass = 'h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50';
const labelClass = 'grid gap-1.5 text-[11px] font-black uppercase tracking-[.04em] text-slate-500';

export default function RtoProcessPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const [rows, setRows] = useState<OperationalRecord[]>([]);
  const [workTypes, setWorkTypes] = useState<Master[]>([]);
  const [rtoOffices, setRtoOffices] = useState<VehicleMaster[]>([]);
  const [faceless, setFaceless] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      setRows(await vehicleOperationsApi.list(vehicleId, 'rto_process'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'RTO records could not be loaded.');
    }
  };

  const loadMasters = async () => {
    const [work, offices] = await Promise.all([
      vehicleOperationsApi.masters('rto_work_type'),
      vehicleMasterApi.list('rto_offices'),
    ]);
    setWorkTypes(work);
    setRtoOffices(offices.filter((row) => row.status === 'active').sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '') || a.name.localeCompare(b.name)));
  };

  useEffect(() => { void load(); }, [vehicleId]);
  useEffect(() => { void loadMasters().catch(() => undefined); }, []);

  async function addWorkType() {
    const name = prompt('New RTO work type');
    if (!name?.trim()) return;
    const added = await vehicleOperationsApi.addMaster('rto_work_type', name.trim());
    setWorkTypes((current) => current.some((x) => x.id === added.id) ? current : [...current, added].sort((a, b) => a.name.localeCompare(b.name)));
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
    setSaving(true);
    setError('');
    const element = event.currentTarget;
    const form = new FormData(element);
    form.set('faceless_appointment', faceless ? '1' : '0');
    if (faceless) form.delete('process_date');
    const body = Object.fromEntries([...form.entries()].filter(([, value]) => value !== ''));
    try {
      await vehicleOperationsApi.create(vehicleId, 'rto_process', body);
      element.reset();
      setFaceless(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'RTO process could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  const visible = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="min-h-screen bg-[#f4f7fc] p-3 text-[#081a3a] sm:p-5 lg:p-7">
      <div className="mx-auto max-w-[1450px] space-y-5">
        <section className="relative overflow-hidden rounded-[30px] border border-[#173d78] bg-[#071a3c] p-5 text-white shadow-[0_24px_70px_rgba(7,26,60,.20)] sm:p-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,rgba(43,117,255,.48),transparent_34%),linear-gradient(135deg,#06152f,#0a2555_60%,#0c3478)]" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <a href={`/vehicles/${vehicleId}`} className="text-xs font-bold text-blue-200 hover:text-white">← Vehicle Profile</a>
              <p className="mt-5 text-[9px] font-black uppercase tracking-[.24em] text-cyan-300">RTO work desk</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">RTO Process</h1>
              <p className="mt-2 max-w-2xl text-sm text-blue-100/70">Compact entry matching the actual RTO workflow.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-right backdrop-blur">
              <p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">Total records</p>
              <p className="mt-1 text-3xl font-black">{rows.length}</p>
            </div>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

        <form onSubmit={submit} className="overflow-hidden rounded-[28px] border border-[#d9e5f7] bg-white shadow-[0_16px_45px_rgba(26,64,120,.08)]">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/70 px-5 py-4 sm:px-6">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">New RTO work</p>
              <h2 className="mt-1 text-xl font-black">Vehicle RTO Process Detail</h2>
            </div>
            <a href="/masters" className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] font-black text-blue-700">Manage Masters →</a>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
            <MasterSelect name="work_type" label="Work Type" required rows={workTypes} onAdd={() => void addWorkType()} />
            <Field name="amount" label="Amount" type="number" />
            <Field name="reference_number" label="Application No" />

            <MasterSelect name="rto_office" label="RTO Office" rows={rtoOffices.map((x) => ({ id: x.id, name: `${x.code ? `${x.code} · ` : ''}${x.name}` }))} onAdd={() => void addRtoOffice()} />
            <Field name="external_agent" label="RTO Agent Name" />
            <Field name="broker" label="Broker" />

            <Field name="assigned_agent" label="Agent" />
            <Field name="agent_amount" label="RTO Agent Amount" type="number" />
            <label className={labelClass}>Faceless Appointment
              <div className="flex h-12 items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-3">
                <span className={`text-xs font-black ${faceless ? 'text-blue-700' : 'text-slate-400'}`}>{faceless ? 'ON' : 'OFF'}</span>
                <button type="button" role="switch" aria-checked={faceless} onClick={() => setFaceless((value) => !value)} className={`relative h-7 w-12 rounded-full transition ${faceless ? 'bg-blue-600' : 'bg-slate-300'}`}>
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${faceless ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </label>

            {!faceless && <Field name="process_date" label="Application Date" type="date" />}
            <Field name="approval_date" label="Approve Date" type="date" />
            <Field name="rc_received_date" label="RC Rec Date" type="date" />

            <Field name="rc_delivered_date" label="RC Deliver Date" type="date" />
            <Field name="invoice_number" label="Invoice No" />
            <Field name="period" label="RC Status" />

            <label className={labelClass}>Status
              <select name="status" defaultValue="ACTIVE" className={inputClass}>
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Pending</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            <label className={`${labelClass} sm:col-span-2`}>Remark
              <textarea name="notes" rows={3} className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" />
            </label>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 bg-[#f8fbff] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-[10px] font-semibold text-slate-500">Faceless ON = no application date. Turn it OFF only when an application date is required.</p>
            <button disabled={saving} className="min-w-[190px] rounded-2xl bg-gradient-to-r from-[#0b2b62] to-[#2563eb] px-6 py-3.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(37,99,235,.28)] transition hover:-translate-y-0.5 disabled:opacity-50">{saving ? 'Saving…' : '✓ Save RTO Work'}</button>
          </div>
        </form>

        <section className="overflow-hidden rounded-[28px] border border-[#d9e5f7] bg-white shadow-[0_14px_40px_rgba(26,64,120,.07)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div><p className="text-[9px] font-black uppercase tracking-[.22em] text-blue-500">RTO history</p><h2 className="mt-1 text-xl font-black">Process Records</h2></div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search application, RTO, agent…" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-blue-400 sm:w-72" />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm">
              <thead className="bg-[#f8fbff]"><tr className="text-left text-[9px] font-black uppercase tracking-wide text-slate-400"><th className="p-4">Work</th><th className="p-4">Application No</th><th className="p-4">RTO</th><th className="p-4">Agent</th><th className="p-4">Application Date</th><th className="p-4">RC Status</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead>
              <tbody>{visible.map((row) => <tr key={row.id} className="border-t border-slate-100 hover:bg-blue-50/30"><td className="p-4 font-black">{String(row.work_type ?? '—')}</td><td className="p-4 font-semibold text-blue-700">{String(row.reference_number ?? '—')}</td><td className="p-4">{String(row.rto_office ?? '—')}</td><td className="p-4">{String(row.assigned_agent ?? row.external_agent ?? '—')}</td><td className="p-4">{String(row.process_date ?? 'Faceless')}</td><td className="p-4">{String(row.period ?? '—')}</td><td className="p-4"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-black uppercase text-blue-700">{String(row.status ?? 'ACTIVE')}</span></td><td className="p-4"><button onClick={() => confirm('Archive this RTO record?') && vehicleOperationsApi.remove(vehicleId, 'rto_process', row.id).then(load)} className="font-black text-rose-600">Archive</button></td></tr>)}</tbody>
            </table>
            {visible.length === 0 && <p className="p-10 text-center text-sm font-semibold text-slate-400">No RTO work records added yet.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ name, label, type = 'text' }: { name: string; label: string; type?: string }) {
  return <label className={labelClass}>{label}<input name={name} type={type} step={type === 'number' ? '0.01' : undefined} className={inputClass} /></label>;
}

function MasterSelect({ name, label, rows, onAdd, required = false }: { name: string; label: string; rows: Master[]; onAdd: () => void; required?: boolean }) {
  return <label className={labelClass}>{label}{required ? ' *' : ''}<div className="flex gap-2"><select name={name} required={required} defaultValue="" className={inputClass}><option value="">Select</option>{rows.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><button type="button" onClick={onAdd} title={`Add ${label}`} className="h-12 shrink-0 rounded-xl border border-blue-100 bg-blue-50 px-4 text-lg font-black text-blue-700 hover:bg-blue-100">+</button></div></label>;
}
