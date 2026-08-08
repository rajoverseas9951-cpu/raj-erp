'use client';

import {useEffect,useMemo,useState} from 'react';
import {useParams,useRouter} from 'next/navigation';
import {Vehicle,vehicleApi} from '@/lib/vehicles';
import {moduleLabels,operationHref,OperationalProfile,VehicleModule,vehicleOperationsApi} from '@/lib/vehicle-operations';
import {isCommercialVehicle} from '@/lib/rc-ocr';

const groupLabels={core:'Core',compliance:'Compliance',operations:'Operations',finance:'Finance'};
const quickOrder:VehicleModule[]=['insurance','puc','fitness','permit','tax','rto_process'];

export default function VehicleProfilePage(){
 const {vehicleId}=useParams<{vehicleId:string}>();
 const router=useRouter();
 const [vehicle,setVehicle]=useState<Vehicle|null>(null);
 const [profile,setProfile]=useState<OperationalProfile|null>(null);
 const [error,setError]=useState('');
 const [mutating,setMutating]=useState(false);
 useEffect(()=>{Promise.all([vehicleApi.get(vehicleId),vehicleOperationsApi.profile(vehicleId)]).then(([v,p])=>{setVehicle(v);setProfile(p)}).catch(e=>setError(e instanceof Error?e.message:'Vehicle profile could not be loaded.'))},[vehicleId]);
 const age=useMemo(()=>vehicle?.manufacturing_year?Math.max(0,new Date().getFullYear()-vehicle.manufacturing_year):null,[vehicle]);
 if(error)return <main className="p-4 md:p-6"><div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div></main>;
 if(!vehicle||!profile)return <main className="p-6 text-sm text-slate-500">Loading vehicle profile...</main>;
 const commercial=isCommercialVehicle(vehicle);
 const availableModules=new Set(Object.values(profile.applicability.groups).flat());
 const quickModules=quickOrder.filter(module=>availableModules.has(module));
 async function archive(){if(!confirm('Archive this vehicle? History will remain available.'))return;setMutating(true);try{await vehicleApi.archive(vehicle!.id);router.push('/vehicles');router.refresh()}catch(e){setError(e instanceof Error?e.message:'Vehicle could not be archived.')}finally{setMutating(false)}}
 return <main className="min-h-screen bg-[#f4f7fb] p-3 text-slate-950 sm:p-5 md:p-7">
  <div className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
   <header className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
    <div className="flex items-center gap-3"><a href="/vehicles" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-xl shadow-sm" aria-label="Back to vehicles">←</a><div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-600">Vehicle workspace</p><h1 className="text-xl font-black sm:text-2xl">Vehicle Profile</h1></div></div>
    <div className="flex gap-2"><a className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold shadow-sm hover:bg-slate-50" href={`/vehicles/${vehicle.id}/edit`}>Edit</a><button disabled={mutating} onClick={()=>void archive()} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700 disabled:opacity-50">Archive</button><a className="hidden rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm sm:inline-flex" href="/vehicles">All Vehicles</a></div>
   </header>

   <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,.08)]">
    <div className="grid gap-0 lg:grid-cols-[220px_1fr_220px]">
     <div className="flex min-h-44 items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-6 lg:min-h-56"><div className="relative grid h-28 w-40 place-items-center rounded-3xl border border-white bg-white shadow-lg"><span className="text-5xl">🚘</span><span className="absolute -bottom-3 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">Active</span></div></div>
     <div className="p-5 sm:p-7"><div className="flex flex-wrap items-center gap-3"><h2 className="text-3xl font-black tracking-tight sm:text-4xl">{vehicle.vehicle_number}</h2><span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">Active</span></div><div className="mt-5 grid gap-3 text-sm sm:text-base"><Identity icon="👤" value={`${vehicle.customer?.first_name||''} ${vehicle.customer?.last_name||''}`.trim()||'Customer not linked'}/><Identity icon="☎" value={vehicle.customer?.mobile||'Mobile not available'}/><Identity icon="🚚" value={[vehicle.manufacturer,vehicle.model,vehicle.fuel_type].filter(Boolean).join(' · ')||'Vehicle description not available'}/></div></div>
     <div className="grid grid-cols-2 border-t border-slate-100 bg-slate-50/70 lg:grid-cols-1 lg:border-l lg:border-t-0"><MiniFact label="Vehicle Age" value={age===null?'—':`${age} Year${age===1?'':'s'}`}/><MiniFact label="Registration Date" value={formatDate(vehicle.registration_date)}/></div>
    </div>
    <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2 sm:px-5"><Tab href="#overview" label="Overview" active/><Tab href={availableModules.has('insurance')?operationHref(vehicle.id,'insurance'):'#'} label="Insurance"/><Tab href="#services" label="Compliance"/><Tab href={availableModules.has('rto_process')?operationHref(vehicle.id,'rto_process'):'#'} label="RTO"/><Tab href={availableModules.has('payment')?operationHref(vehicle.id,'payment'):'#'} label="Payments"/><Tab href="#services" label="More"/></nav>
   </section>

   <section id="overview" className="grid gap-3 sm:grid-cols-3"><Metric tone="blue" label="Total Billed" value={`₹${profile.balances.billed.toFixed(2)}`} note="All time"/><Metric tone="green" label="Total Received" value={`₹${profile.balances.received.toFixed(2)}`} note="All time"/><Metric tone="red" label="Outstanding" value={`₹${profile.balances.outstanding.toFixed(2)}`} note="Pending balance"/></section>

   {quickModules.length>0&&<section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-600">Do it faster</p><h2 className="mt-1 text-xl font-black">Quick Actions</h2></div><a href="#services" className="text-sm font-bold text-blue-600">All services ↓</a></div><div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">{quickModules.map(module=><QuickAction key={module} label={moduleLabels[module]} href={operationHref(vehicle.id,module)} status={profile.modules[module]?.status}/>)}</div></section>}

   <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-5"><p className="text-xs font-black uppercase tracking-[.16em] text-blue-600">RC snapshot</p><h2 className="mt-1 text-xl font-black">Vehicle Details</h2></div><dl className="grid gap-x-8 sm:grid-cols-2"><Info icon="🏛" k="Registration Authority" v={vehicle.registration_authority}/><Info icon="🚘" k="Vehicle Class" v={vehicle.vehicle_class}/><Info icon="🚚" k="Vehicle Type" v={vehicle.vehicle_type}/><Info icon="▣" k="Category" v={vehicle.vehicle_category}/><Info icon="⌘" k="Chassis Number" v={vehicle.chassis_number}/><Info icon="⚙" k="Engine Number" v={vehicle.engine_number}/><Info icon="▦" k="Manufacturing Year" v={vehicle.manufacturing_year}/><Info icon="◉" k="Colour" v={vehicle.colour}/><Info icon="♿" k="Seating Capacity" v={vehicle.seating_capacity}/><Info icon="⚖" k="Unladen Weight (kg)" v={vehicle.unladen_weight}/>{commercial&&<Info icon="⚖" k="Laden / Gross Vehicle Weight (kg)" v={vehicle.gross_weight}/>}<Info icon="₹" k="Financier" v={vehicle.financier}/></dl></section>

   <section id="services" className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-5"><p className="text-xs font-black uppercase tracking-[.16em] text-blue-600">All records</p><h2 className="mt-1 text-xl font-black">Services & Compliance</h2></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(profile.applicability.groups).map(([group,modules])=><article key={group} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><h3 className="text-[11px] font-black uppercase tracking-[.16em] text-slate-500">{groupLabels[group as keyof typeof groupLabels]}</h3><nav className="mt-3 grid gap-2">{modules.map(module=>{const summary=profile.modules[module];return <a key={module} href={operationHref(vehicle.id,module)} className="flex items-center justify-between rounded-xl bg-white px-3 py-3 text-sm font-bold shadow-[0_1px_4px_rgba(15,23,42,.05)] transition hover:-translate-y-.5 hover:text-blue-700"><span>{moduleLabels[module]}</span>{summary&&<Status value={summary.status}/>}</a>})}</nav></article>)}</div></section>
  </div>
 </main>;
}

function formatDate(value?:string){if(!value)return'—';const d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});}
function Identity({icon,value}:{icon:string;value:string}){return <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-sm">{icon}</span><span className="font-semibold text-slate-700">{value}</span></div>}
function MiniFact({label,value}:{label:string;value:string}){return <div className="p-5 sm:p-6"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-lg font-black text-slate-900">{value}</p></div>}
function Tab({href,label,active=false}:{href:string;label:string;active?:boolean}){return <a href={href} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold ${active?'bg-blue-50 text-blue-700':'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>{label}</a>}
function Status({value}:{value:string}){const tone=value==='EXPIRED'?'bg-red-100 text-red-700':value==='EXPIRING_SOON'?'bg-amber-100 text-amber-800':value==='ACTIVE'?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-600';return <span className={`rounded-full px-2 py-1 text-[9px] font-black ${tone}`}>{value.replaceAll('_',' ')}</span>}
function Metric({label,value,note,tone}:{label:string;value:string;note:string;tone:'blue'|'green'|'red'}){const styles={blue:'border-blue-100 bg-gradient-to-br from-blue-50 to-white',green:'border-emerald-100 bg-gradient-to-br from-emerald-50 to-white',red:'border-rose-100 bg-gradient-to-br from-rose-50 to-white'}[tone];return <div className={`rounded-[22px] border p-5 shadow-sm ${styles}`}><p className="text-sm font-bold text-slate-600">{label}</p><p className="mt-2 text-2xl font-black">{value}</p><p className="mt-2 text-xs font-semibold text-slate-400">{note}</p></div>}
function QuickAction({label,href,status}:{label:string;href:string;status?:string}){return <a href={href} className="group rounded-2xl border border-slate-100 bg-slate-50/60 p-3 text-center transition hover:-translate-y-1 hover:border-blue-100 hover:bg-blue-50"><div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-white text-xl shadow-sm group-hover:shadow">{actionIcon(label)}</div><p className="mt-2 truncate text-xs font-black sm:text-sm">{label}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">{status?status.replaceAll('_',' '):'Open'}</p></a>}
function actionIcon(label:string){if(label.toLowerCase().includes('insurance'))return'🛡';if(label.toLowerCase().includes('puc'))return'🌿';if(label.toLowerCase().includes('fitness'))return'✓';if(label.toLowerCase().includes('permit'))return'📄';if(label.toLowerCase().includes('tax'))return'₹';if(label.toLowerCase().includes('rto'))return'🏛';return'•'}
function Info({k,v,icon}:{k:string;v?:string|number;icon:string}){return <div className="flex gap-3 border-b border-slate-100 py-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 font-black text-blue-700">{icon}</span><div className="min-w-0"><dt className="text-xs font-semibold text-slate-500">{k}</dt><dd className="mt-1 break-words font-black text-slate-800">{v===0?0:v||'—'}</dd></div></div>}
