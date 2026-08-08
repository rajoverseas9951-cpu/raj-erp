'use client';

import {useEffect,useMemo,useState} from 'react';
import {useParams,useRouter} from 'next/navigation';
import {Vehicle,vehicleApi} from '@/lib/vehicles';
import {moduleLabels,operationHref,OperationalProfile,VehicleModule,vehicleOperationsApi} from '@/lib/vehicle-operations';
import {isCommercialVehicle} from '@/lib/rc-ocr';

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
 const owner=`${vehicle.customer?.first_name||''} ${vehicle.customer?.last_name||''}`.trim()||'Customer not linked';
 const description=[vehicle.manufacturer,vehicle.model].filter(Boolean).join(' · ')||clean(vehicle.vehicle_category)||'Vehicle';
 const visual=vehicleVisual(vehicle);

 return <main className="min-h-screen bg-[#f5f8fd] text-[#0b1f46]">
  <div className="mx-auto max-w-7xl px-3 py-3 sm:px-5 sm:py-5 md:px-7">
   <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
    <a href="/vehicles" className="inline-flex items-center gap-2 text-base font-black text-[#0b1f46] sm:text-xl">← <span>Vehicle Profile</span></a>
    <div className="flex gap-2"><a href={`/vehicles/${vehicle.id}/edit`} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold shadow-sm">✎ Edit</a><button disabled={mutating} onClick={()=>void archive()} className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-bold text-amber-700 disabled:opacity-50">▣ Archive</button><a href="/vehicles" className="hidden rounded-xl bg-[#082653] px-4 py-2 text-sm font-bold text-white shadow-sm sm:inline-flex">All Vehicles</a></div>
   </header>

   <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(29,55,95,.08)]">
    <div className="grid lg:grid-cols-[230px_1fr_260px] lg:items-stretch">
     <div className="flex items-center justify-center border-b border-slate-100 bg-[linear-gradient(145deg,#fbfdff,#f1f6ff)] p-5 lg:border-b-0 lg:border-r">
      <div className="relative flex min-h-40 w-full max-w-[190px] flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-white px-4 py-5 shadow-sm">
       <div className="text-[72px] leading-none drop-shadow-sm" aria-label={visual.label}>{visual.icon}</div>
       <p className="mt-3 max-w-full truncate text-center text-[11px] font-black uppercase tracking-[.12em] text-slate-500">{visual.label}</p>
       <span className="mt-3 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">Active</span>
      </div>
     </div>

     <div className="p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-black tracking-tight sm:text-4xl">{vehicle.vehicle_number}</h1><span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase text-emerald-700">Active</span></div>
      <div className="mt-6 grid gap-4 text-sm sm:text-base"><Identity icon="♙" value={owner}/><Identity icon="⌕" value={vehicle.customer?.mobile||'Mobile not available'}/><Identity icon={visual.smallIcon} value={`${description}${vehicle.fuel_type?` · ${clean(vehicle.fuel_type)}`:''}`}/></div>
     </div>

     <div className="grid grid-cols-3 border-t border-slate-100 bg-[#fbfcfe] lg:grid-cols-1 lg:border-l lg:border-t-0">
      <MiniFact icon="▣" label="Vehicle Age" value={age===null?'—':`${age} Year${age===1?'':'s'}`}/>
      <MiniFact icon="▦" label="Registration Date" value={formatDate(vehicle.registration_date)}/>
      <MiniFact icon="🏛" label="RTO" value={vehicle.registration_authority||'—'}/>
     </div>
    </div>

    <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2 sm:px-5">
     <Tab href="#overview" label="Overview" active/>
     {availableModules.has('insurance')&&<Tab href={operationHref(vehicle.id,'insurance')} label="Insurance"/>}
     {(availableModules.has('fitness')||availableModules.has('permit')||availableModules.has('puc'))&&<Tab href="#quick-actions" label="Compliance"/>}
     {availableModules.has('rto_process')&&<Tab href={operationHref(vehicle.id,'rto_process')} label="RTO"/>}
     {availableModules.has('payment')&&<Tab href={operationHref(vehicle.id,'payment')} label="Payments"/>}
    </nav>
   </section>

   <section id="overview" className="mt-4 grid grid-cols-3 gap-2 sm:gap-3"><Metric tone="blue" label="Total Billed" value={`₹${profile.balances.billed.toFixed(2)}`} note="All time"/><Metric tone="green" label="Total Received" value={`₹${profile.balances.received.toFixed(2)}`} note="All time"/><Metric tone="red" label="Outstanding" value={`₹${profile.balances.outstanding.toFixed(2)}`} note="Pending balance"/></section>

   {quickModules.length>0&&<section id="quick-actions" className="mt-4 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-black sm:text-xl">Quick Actions</h2><div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">{quickModules.map(module=><QuickAction key={module} label={moduleLabels[module]} href={operationHref(vehicle.id,module)} status={profile.modules[module]?.status}/>)}</div></section>}

   <section className="mt-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 px-4 py-4 sm:px-6"><h2 className="text-lg font-black sm:text-xl">Vehicle Details</h2></div>
    <dl className="grid sm:grid-cols-2">
      <Info icon="🏛" k="Registration Authority" v={vehicle.registration_authority}/><Info icon={visual.smallIcon} k="Vehicle Class" v={vehicle.vehicle_class}/><Info icon="🚚" k="Vehicle Type" v={clean(vehicle.vehicle_type)}/><Info icon="▣" k="Category" v={clean(vehicle.vehicle_category)}/><Info icon="⌘" k="Chassis Number" v={vehicle.chassis_number} mono/><Info icon="⚙" k="Engine Number" v={vehicle.engine_number} mono/><Info icon="▦" k="Manufacturing Year" v={vehicle.manufacturing_year}/><Info icon="●" k="Colour" v={vehicle.colour}/><Info icon="♿" k="Seating Capacity" v={vehicle.seating_capacity}/><Info icon="⚖" k="Unladen Weight (kg)" v={vehicle.unladen_weight}/>{commercial&&<Info icon="⚖" k="Laden / Gross Vehicle Weight (kg)" v={vehicle.gross_weight}/>}<Info icon="₹" k="Financier" v={vehicle.financier}/>
    </dl>
   </section>
  </div>
 </main>;
}

function clean(value?:string){return value?value.replaceAll('_',' ').replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase()):'—'}
function formatDate(value?:string){if(!value)return'—';const d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});}

function vehicleVisual(vehicle:Vehicle){
 const hay=[vehicle.vehicle_type,vehicle.vehicle_category,vehicle.vehicle_class,vehicle.model,vehicle.manufacturer].filter(Boolean).join(' ').toLowerCase();
 if(/ambulance/.test(hay))return{icon:'🚑',smallIcon:'🚑',label:vehicle.model||'Ambulance'};
 if(/tractor/.test(hay))return{icon:'🚜',smallIcon:'🚜',label:vehicle.model||'Tractor'};
 if(/auto|rickshaw|3wn|three wheel|three_wheel/.test(hay))return{icon:'🛺',smallIcon:'🛺',label:vehicle.model||'Auto Rickshaw'};
 if(/bus|school bus|omni bus/.test(hay))return{icon:'🚌',smallIcon:'🚌',label:vehicle.model||'Bus'};
 if(/truck|hgv|goods carrier|goods_carrier|lorry|tipper|dumper/.test(hay))return{icon:'🚛',smallIcon:'🚛',label:vehicle.model||'Goods Vehicle'};
 if(/pickup|pick up|pick_up|lgv|lcv/.test(hay))return{icon:'🛻',smallIcon:'🛻',label:vehicle.model||'Pickup'};
 if(/motor cycle|motorcycle|m-cycle|2wn|two wheel|bike/.test(hay))return{icon:'🏍️',smallIcon:'🏍️',label:vehicle.model||'Motorcycle'};
 if(/scooter|scooty/.test(hay))return{icon:'🛵',smallIcon:'🛵',label:vehicle.model||'Scooter'};
 if(/taxi|cab/.test(hay))return{icon:'🚕',smallIcon:'🚕',label:vehicle.model||'Taxi'};
 if(/van/.test(hay))return{icon:'🚐',smallIcon:'🚐',label:vehicle.model||'Van'};
 return{icon:'🚗',smallIcon:'🚗',label:vehicle.model||'Car'};
}

function Identity({icon,value}:{icon:string;value:string}){return <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-sm">{icon}</span><span className="font-semibold text-slate-700">{value}</span></div>}
function MiniFact({icon,label,value}:{icon:string;label:string;value:string}){return <div className="min-w-0 border-r border-slate-100 p-3 last:border-r-0 lg:border-b lg:border-r-0 lg:p-5 lg:last:border-b-0"><div className="flex items-start gap-2 lg:gap-3"><span className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-sm sm:grid">{icon}</span><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 sm:text-[10px]">{label}</p><p className="mt-1 truncate text-xs font-black text-slate-900 sm:text-sm">{value}</p></div></div></div>}
function Tab({href,label,active=false}:{href:string;label:string;active?:boolean}){return <a href={href} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold ${active?'bg-blue-50 text-blue-700':'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>{label}</a>}
function Metric({label,value,note,tone}:{label:string;value:string;note:string;tone:'blue'|'green'|'red'}){const styles={blue:'border-blue-100 bg-gradient-to-br from-blue-50 to-white',green:'border-emerald-100 bg-gradient-to-br from-emerald-50 to-white',red:'border-rose-100 bg-gradient-to-br from-rose-50 to-white'}[tone];return <div className={`rounded-[18px] border p-3 shadow-sm sm:p-5 ${styles}`}><p className="text-[10px] font-bold text-slate-500 sm:text-sm">{label}</p><p className="mt-1 text-base font-black sm:mt-2 sm:text-2xl">{value}</p><p className="mt-1 hidden text-xs text-slate-400 sm:block">{note}</p></div>}
function QuickAction({label,href,status}:{label:string;href:string;status?:string}){const added=status&&status!=='not_added';return <a href={href} className="group rounded-2xl border border-slate-200 bg-white px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-lg">{actionIcon(label)}</div><p className="mt-2 truncate text-[11px] font-black sm:text-xs">{label}</p><p className={`mt-1 text-[8px] font-black uppercase tracking-wide ${added?'text-emerald-600':'text-slate-400'}`}>{added?'Added':'Not Added'}</p></a>}
function actionIcon(label:string){if(label.toLowerCase().includes('insurance'))return'🛡️';if(label.toLowerCase().includes('puc'))return'🌿';if(label.toLowerCase().includes('fitness'))return'✓';if(label.toLowerCase().includes('permit'))return'📄';if(label.toLowerCase().includes('tax'))return'₹';if(label.toLowerCase().includes('rto'))return'🏛️';return'•'}
function Info({icon,k,v,mono=false}:{icon:string;k:string;v?:string|number;mono?:boolean}){return <div className="flex min-w-0 items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-6"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-sm">{icon}</span><div className="min-w-0"><dt className="text-[10px] font-bold text-slate-400">{k}</dt><dd className={`mt-1 break-words text-sm font-black text-slate-800 ${mono?'font-mono tracking-tight':''}`}>{v===0?0:v||'—'}</dd></div></div>}
