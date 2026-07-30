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

export default function VehicleProfilePage(){
 const params=useParams<{vehicleId:string}>();
 const [v,setVehicle]=useState<Vehicle|null>(null); const [error,setError]=useState('');
 useEffect(()=>{vehicleApi.get(params.vehicleId).then(setVehicle).catch(e=>setError(e instanceof Error?e.message:'Vehicle load nahi hua.'));},[params.vehicleId]);
 if(error)return <main className="p-6"><div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div></main>;
 if(!v)return <main className="p-6">Loading vehicle...</main>;
 const tabs=tabsFor(v);
 return <main className="space-y-6 p-6"><section className="rounded-2xl bg-slate-900 p-6 text-white"><p className="text-sm text-slate-300">{v.vehicle_number}</p><h1 className="text-3xl font-bold">{v.manufacturer} {v.model} {v.variant}</h1><p>{v.customer?.first_name} {v.customer?.last_name} · {v.customer?.mobile} · {v.fuel_type}</p><div className="mt-4 flex gap-2"><a className="rounded-md bg-white px-4 py-2 text-slate-900" href={`/vehicles/${v.id}/edit`}>Edit Vehicle</a><a className="rounded-md border border-white/30 px-4 py-2" href="/vehicles">All Vehicles</a></div></section><nav className="flex flex-wrap gap-2">{tabs.map(t=><a key={t} href={t==='Timeline'?`/vehicles/${v.id}/timeline`:'#'} className="rounded-full border bg-white px-4 py-2 text-sm font-medium">{t}</a>)}</nav><section className="grid gap-4 md:grid-cols-5"><Card title="Insurance" value={v.insurance_status}/><Card title="PUC" value={v.puc_status}/>{tabs.includes('Fitness')&&<Card title="Fitness" value={v.fitness_status}/>} {tabs.includes('Permit')&&<Card title="Permit" value={v.permit_status}/>} {tabs.includes('Tax')&&<Card title="Tax" value={v.tax_status}/>}</section><section className="rounded-xl border bg-white p-6"><h2 className="text-xl font-semibold">Vehicle Overview</h2><dl className="mt-4 grid gap-4 md:grid-cols-3"><Info k="Registration Authority" v={v.registration_authority}/><Info k="Vehicle Class" v={v.vehicle_class}/><Info k="Vehicle Type" v={v.vehicle_type}/><Info k="Category" v={v.vehicle_category}/><Info k="Chassis Number" v={v.chassis_number}/><Info k="Engine Number" v={v.engine_number}/><Info k="Manufacturing Year" v={v.manufacturing_year}/><Info k="Colour" v={v.colour}/><Info k="Seating Capacity" v={v.seating_capacity}/><Info k="Financier" v={v.financier}/></dl></section></main>;
}
function Card({title,value}:{title:string;value?:string}){return <div className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-500">{title}</p><p className="text-xl font-bold capitalize">{value||'Not Added'}</p></div>}
function Info({k,v}:{k:string;v?:string|number}){return <div><dt className="text-sm text-slate-500">{k}</dt><dd className="font-medium">{v||'—'}</dd></div>}
