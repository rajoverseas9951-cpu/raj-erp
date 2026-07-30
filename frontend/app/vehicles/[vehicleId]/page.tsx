'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Vehicle, vehicleApi } from '@/lib/vehicles';

function tabsFor(v:Vehicle){
 const text=`${v.vehicle_type??''} ${v.vehicle_class??''} ${v.vehicle_category??''}`.toLowerCase();
 if(/hgv|goods|truck|trailer|gt/.test(text)) return ['Overview','Insurance','PUC','Fitness','Permit','National Permit','RTO Work','Tax','Payments','Documents','Timeline'];
 if(/taxi|cab|maxi|passenger/.test(text)) return ['Overview','Insurance','PUC','Fitness','Permit','National Permit','RTO Work','Payments','Documents','Timeline'];
 if(/lgv|pickup|pick up|light goods/.test(text)) return ['Overview','Insurance','PUC','RTO Work','Fitness','Payments','Documents','Timeline'];
 return ['Overview','Insurance','PUC','RTO Work','Payments','Documents','Timeline'];
}

function tabHref(id:string, tab:string){
 const slug=tab.toLowerCase().replaceAll(' ','-');
 if(tab==='Overview') return `/vehicles/${id}`;
 if(tab==='Timeline') return `/vehicles/${id}/timeline`;
 return `/vehicles/${id}/${slug}`;
}

export default function VehicleProfilePage(){
 const params=useParams<{vehicleId:string}>();
 const [v,setVehicle]=useState<Vehicle|null>(null); const [error,setError]=useState('');
 useEffect(()=>{vehicleApi.get(params.vehicleId).then(setVehicle).catch(e=>setError(e instanceof Error?e.message:'Vehicle load nahi hua.'));},[params.vehicleId]);
 if(error)return <main className="p-6"><div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div></main>;
 if(!v)return <main className="p-6">Loading vehicle...</main>;
 const tabs=tabsFor(v);
 return <main className="space-y-6 p-6">
  <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-blue-900 p-7 text-white shadow-xl">
   <div className="flex flex-wrap items-start justify-between gap-5">
    <div><p className="text-sm font-semibold tracking-[.2em] text-blue-200">VEHICLE PROFILE</p><h1 className="mt-2 text-4xl font-black">{v.vehicle_number}</h1><p className="mt-2 text-lg text-slate-200">{v.customer?.first_name} {v.customer?.last_name} · {v.customer?.mobile}</p><p className="mt-1 text-sm text-slate-400">{v.manufacturer} {v.model} {v.variant} · {v.fuel_type}</p></div>
    <div className="flex gap-2"><a className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-900" href={`/vehicles/${v.id}/edit`}>Edit Vehicle</a><a className="rounded-xl border border-white/30 px-5 py-3 font-semibold" href="/vehicles">All Vehicles</a></div>
   </div>
  </section>
  <nav className="flex flex-wrap gap-2 rounded-2xl border bg-white p-3 shadow-sm">{tabs.map(t=><a key={t} href={tabHref(v.id,t)} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${t==='Overview'?'bg-blue-700 text-white':'hover:bg-blue-50 hover:text-blue-700'}`}>{t}</a>)}</nav>
  <section className="grid gap-4 md:grid-cols-5"><Card title="Insurance" value={v.insurance_status}/><Card title="PUC" value={v.puc_status}/>{tabs.includes('Fitness')&&<Card title="Fitness" value={v.fitness_status}/>} {tabs.includes('Permit')&&<Card title="Permit" value={v.permit_status}/>} {tabs.includes('Tax')&&<Card title="Tax" value={v.tax_status}/>}</section>
  <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Vehicle Overview</h2><dl className="mt-5 grid gap-5 md:grid-cols-3"><Info k="Registration Authority" v={v.registration_authority}/><Info k="Vehicle Class" v={v.vehicle_class}/><Info k="Vehicle Type" v={v.vehicle_type}/><Info k="Category" v={v.vehicle_category}/><Info k="Chassis Number" v={v.chassis_number}/><Info k="Engine Number" v={v.engine_number}/><Info k="Manufacturing Year" v={v.manufacturing_year}/><Info k="Colour" v={v.colour}/><Info k="Seating Capacity" v={v.seating_capacity}/><Info k="Financier" v={v.financier}/></dl></section>
 </main>;
}
function Card({title,value}:{title:string;value?:string}){return <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{title}</p><p className="mt-1 text-xl font-bold capitalize">{(value||'Not Added').replaceAll('_',' ')}</p></div>}
function Info({k,v}:{k:string;v?:string|number}){return <div className="rounded-xl bg-slate-50 p-4"><dt className="text-sm text-slate-500">{k}</dt><dd className="mt-1 font-semibold">{v||'—'}</dd></div>}
