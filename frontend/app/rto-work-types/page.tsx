'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { vehicleOperationsApi } from '@/lib/vehicle-operations';

type Master = { id: string; name: string; code?: string };

export default function RtoWorkTypesPage() {
  const [rows, setRows] = useState<Master[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try { setRows(await vehicleOperationsApi.masters('rto_work_type')); }
    catch (e) { setError(e instanceof Error ? e.message : 'RTO work types could not be loaded.'); }
  };

  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    if (!name) { setSaving(false); return; }
    try {
      await vehicleOperationsApi.addMaster('rto_work_type', name);
      event.currentTarget.reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'RTO work type could not be saved.');
    } finally { setSaving(false); }
  }

  const visible = useMemo(() => rows.filter((row) => row.name.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  return <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
    <section className="overflow-hidden rounded-[28px] bg-gradient-to-r from-blue-950 via-blue-800 to-indigo-700 p-7 text-white shadow-xl">
      <p className="text-[10px] font-black uppercase tracking-[.22em] text-blue-200">Masters / RTO</p>
      <h1 className="mt-2 text-3xl font-black">RTO Work Types</h1>
      <p className="mt-2 text-sm text-blue-100/80">Every work type added here becomes available instantly in Vehicle → RTO Process.</p>
    </section>

    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

    <form onSubmit={submit} className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto] dark:border-slate-800 dark:bg-slate-900">
      <input name="name" required placeholder="e.g. Transfer of Ownership" className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800" />
      <button disabled={saving} className="h-12 rounded-xl bg-blue-700 px-6 font-black text-white disabled:opacity-50">{saving ? 'Saving…' : '+ Add Work Type'}</button>
    </form>

    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 dark:border-slate-800">
        <div><h2 className="font-black">Work Type Master</h2><p className="text-xs text-slate-500">{rows.length} values</p></div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search work type" className="h-10 rounded-xl border px-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800" />
      </div>
      <div className="divide-y dark:divide-slate-800">{visible.map((row) => <div key={row.id} className="flex items-center justify-between px-5 py-4"><span className="font-bold">{row.name}</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase text-emerald-700">Active</span></div>)}</div>
      {!visible.length && <p className="p-10 text-center text-sm text-slate-400">No work types found.</p>}
    </section>
  </main>;
}
