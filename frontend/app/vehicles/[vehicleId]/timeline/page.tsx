'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import {Vehicle,VehicleTimelineEvent,vehicleApi} from '@/lib/vehicles';

function formatDate(value:string){
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return value||'—';
 return date.toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
function clean(value?:string){return(value||'not added').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}

export default function VehicleTimelinePage(){
 const {vehicleId}=useParams<{vehicleId:string}>();
 const [vehicle,setVehicle]=useState<Vehicle|null>(null);
 const [events,setEvents]=useState<VehicleTimelineEvent[]>([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);

 useEffect(()=>{
  let active=true;
  Promise.all([vehicleApi.get(vehicleId),vehicleApi.timeline(vehicleId)])
   .then(([v,result])=>{
    if(!active)return;
    setVehicle(v);
    const raw=result as unknown;
    if(Array.isArray(raw))setEvents(raw as VehicleTimelineEvent[]);
    else if(raw&&typeof raw==='object'&&'data'in raw&&Array.isArray((raw as {data?:unknown}).data))setEvents((raw as {data:VehicleTimelineEvent[]}).data);
    else setEvents([]);
   })
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'Timeline could not be loaded.')})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[vehicleId]);

 if(loading)return <main className="min-h-screen bg-[#f3f7fc] p-6"><div className="mx-auto max-w-5xl rounded-3xl border bg-white p-8 font-bold text-slate-500">Loading vehicle timeline...</div></main>;
 if(error||!vehicle)return <main className="min-h-screen bg-[#f3f7fc] p-6"><div className="mx-auto max-w-3xl rounded-3xl border border-rose-200 bg-white p-8 shadow-sm"><p className="text-xs font-black uppercase tracking-widest text-rose-500">Timeline Error</p><h1 className="mt-2 text-2xl font-black text-slate-900">Timeline could not be loaded</h1><p className="mt-2 text-sm text-slate-600">{error||'Vehicle data unavailable.'}</p><Link href={`/vehicles/${vehicleId}`} className="mt-5 inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white">Back to Vehicle</Link></div></main>;

 const sorted=[...events].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
 const owner=vehicle.customer?[vehicle.customer.first_name,vehicle.customer.middle_name,vehicle.customer.last_name].filter(Boolean).join(' '):'Customer';
 return <main className="min-h-screen bg-[#f3f7fc] p-4 sm:p-6"><div className="mx-auto max-w-6xl space-y-5">
  <div className="flex justify-end"><Link href={`/vehicles/${vehicleId}`} className="rounded-xl border bg-white px-4 py-2 text-sm font-black text-[#0b2d61]">← Vehicle Profile</Link></div>
  <section className="rounded-[28px] bg-gradient-to-br from-[#06182f] via-[#0d3474] to-[#2367dd] p-7 text-white shadow-xl"><p className="text-[11px] font-black uppercase tracking-[.24em] text-cyan-200">Vehicle Activity Center</p><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-4xl font-black">Timeline</h1><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">{sorted.length} EVENTS</span></div><p className="mt-3 text-2xl font-black">{vehicle.vehicle_number}</p><p className="mt-1 text-sm text-blue-100">{owner}</p></section>
  <section className="grid gap-3 sm:grid-cols-3">{[['Insurance',vehicle.insurance_status],['PUC',vehicle.puc_status],['Fitness',vehicle.fitness_status]].map(([label,status])=><div key={label} className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-[#092654]">{clean(status)}</p></div>)}</section>
  <section className="rounded-[28px] border bg-white p-5 shadow-sm"><div className="mb-5"><p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">Complete History</p><h2 className="text-2xl font-black text-[#071e43]">Vehicle Activity</h2></div>{sorted.length===0?<div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">No activity recorded yet.</div>:<ol className="space-y-3">{sorted.map((event,index)=><li key={event.id||index} className="rounded-2xl border bg-[#fbfdff] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-blue-700">{clean(event.event_type)}</span><span className="text-xs font-bold text-slate-400">{formatDate(event.created_at)}</span></div><h3 className="mt-2 text-lg font-black text-[#092654]">{event.title||clean(event.event_type)}</h3>{event.description&&<p className="mt-1 text-sm leading-6 text-slate-600">{event.description}</p>}</li>)}</ol>}</section>
 </div></main>;
}
