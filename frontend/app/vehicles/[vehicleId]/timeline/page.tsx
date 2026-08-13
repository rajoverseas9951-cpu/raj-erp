import Link from 'next/link';
import { vehicleApi, VehicleTimelineEvent } from '@/lib/vehicles';

function info(event: VehicleTimelineEvent, vehicleId: string) {
  const type = (event.event_type || '').toLowerCase();
  if (type.includes('insurance') || type.includes('policy')) return { label: 'Insurance', href: `/vehicles/${vehicleId}/insurance`, cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-600' };
  if (type.includes('puc')) return { label: 'PUC', href: `/vehicles/${vehicleId}/operations/puc`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-600' };
  if (type.includes('fitness')) return { label: 'Fitness', href: `/vehicles/${vehicleId}/operations/fitness`, cls: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-600' };
  if (type.includes('rto')) return { label: 'RTO', href: `/vehicles/${vehicleId}/operations/rto_process`, cls: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-600' };
  if (type.includes('payment') || type.includes('receipt')) return { label: 'Payment', href: `/vehicles/${vehicleId}/operations/payment`, cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
  if (type.includes('permit')) return { label: 'Permit', href: `/vehicles/${vehicleId}/operations/permit`, cls: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: 'bg-cyan-600' };
  if (type.includes('tax')) return { label: 'Tax', href: `/vehicles/${vehicleId}/operations/tax`, cls: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' };
  return { label: 'Vehicle', href: `/vehicles/${vehicleId}`, cls: 'bg-slate-50 text-slate-700 border-slate-200', dot: 'bg-slate-500' };
}

function readable(event: VehicleTimelineEvent) {
  return event.title?.trim() || (event.event_type || 'Vehicle activity').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).format(new Date(value));
}

function statusClass(status?: string) {
  const s = (status || 'not_added').toLowerCase();
  if (s === 'active' || s === 'running') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (s.includes('soon') || s.includes('due')) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (s === 'expired' || s === 'inactive') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-500';
}

function niceStatus(status?: string) {
  return (status || 'not_added').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default async function VehicleTimelinePage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  const [vehicle, response] = await Promise.all([vehicleApi.get(vehicleId), vehicleApi.timeline(vehicleId)]);
  const events = [...(response.data || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const owner = vehicle.customer ? [vehicle.customer.first_name, vehicle.customer.middle_name, vehicle.customer.last_name].filter(Boolean).join(' ') : 'Customer';
  const latest = events[0];

  return <main className="min-h-screen bg-[#f3f7fc] p-4 sm:p-6 lg:p-8">
    <div className="mx-auto max-w-[1280px] space-y-5">
      <div className="flex justify-end gap-2">
        <Link href={`/vehicles/${vehicleId}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-[#0b2d61] shadow-sm">← Vehicle Profile</Link>
        <Link href="/vehicles" className="rounded-xl bg-[#0b3477] px-4 py-2 text-sm font-black text-white">All Vehicles</Link>
      </div>

      <section className="rounded-[30px] bg-gradient-to-br from-[#06182f] via-[#0d3474] to-[#2367dd] p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.24em] text-cyan-200">Vehicle Activity Center</p>
            <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-4xl font-black">Timeline</h1><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black">{events.length} EVENTS</span></div>
            <p className="mt-3 text-2xl font-black">{vehicle.vehicle_number}</p>
            <p className="mt-1 text-sm font-semibold text-blue-100/80">{owner} · {[vehicle.manufacturer, vehicle.model, vehicle.vehicle_type].filter(Boolean).join(' · ') || 'Vehicle record'}</p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-100/75">Insurance, PUC, Fitness, RTO work, payments and profile changes — all important activity for this vehicle in one chronological history.</p>
          </div>
          <div className="min-w-[220px] rounded-[22px] border border-white/15 bg-white/10 p-5">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-200">Latest Activity</p>
            <p className="mt-2 text-sm font-black">{latest ? readable(latest) : 'No activity yet'}</p>
            <p className="mt-1 text-xs text-blue-100/70">{latest ? dateTime(latest.created_at) : 'New activity will appear here.'}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[['Insurance', vehicle.insurance_status], ['PUC', vehicle.puc_status], ['Fitness', vehicle.fitness_status]].map(([label, status]) => <div key={label} className={`rounded-[20px] border p-4 shadow-sm ${statusClass(status)}`}>
          <p className="text-[10px] font-black uppercase tracking-[.14em] opacity-70">{label}</p><p className="mt-1 text-lg font-black">{niceStatus(status)}</p>
        </div>)}
      </section>

      <section className="overflow-hidden rounded-[28px] border border-[#dbe6f3] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
          <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">Complete History</p><h2 className="mt-1 text-2xl font-black text-[#071e43]">Vehicle Activity</h2></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">Newest first</span>
        </div>

        {events.length === 0 ? <div className="p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl">↻</div>
          <h3 className="mt-4 text-xl font-black text-[#0b2d61]">No activity recorded yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">As insurance, PUC, Fitness, RTO work, payments and edits are recorded, they will automatically appear here.</p>
        </div> : <div className="p-5 sm:p-6">
          <ol className="relative ml-3 border-l-2 border-slate-200 pl-7 sm:ml-4 sm:pl-8">
            {events.map(event => {
              const meta = info(event, vehicleId);
              return <li key={event.id} className="relative pb-5 last:pb-0">
                <span className={`absolute -left-[34px] top-6 h-3.5 w-3.5 rounded-full ring-4 ring-white sm:-left-[39px] ${meta.dot}`} />
                <article className="rounded-[20px] border border-slate-200 bg-[#fbfdff] p-4 hover:border-blue-200 hover:shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[.1em] ${meta.cls}`}>{meta.label}</span><span className="text-xs font-bold text-slate-400">{dateTime(event.created_at)}</span></div>
                      <h3 className="mt-2 text-lg font-black text-[#092654]">{readable(event)}</h3>
                      {event.description && <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{event.description}</p>}
                    </div>
                    <Link href={meta.href} className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs font-black text-blue-700 shadow-sm hover:bg-blue-50">Open {meta.label} →</Link>
                  </div>
                </article>
              </li>;
            })}
          </ol>
        </div>}
      </section>
    </div>
  </main>;
}
