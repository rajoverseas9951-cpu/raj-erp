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
 const description=[vehicle.manufacturer,vehicle.model].filter(Boolean).join(' · ')||'Vehicle';
 return <main className="min-h-screen bg-[#f5f7fb] text-slate-950">
  <div className="mx-auto max-w-7xl px-3 py-3 sm:px-5 sm:py-5 md:px-7">
   <div className="mb-3 flex items-center justify-between gap-3 sm:mb-5">
    <a href="/vehicles" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm">← <span className="hidden sm:inline">Vehicles</span></a>
    <div className="flex items-center gap-2"><a href={`/vehicles/${vehicle.id}/edit`} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold shadow-sm">Edit</a><button disabled={mutating} onClick={()=>void archive()} className="rounded-xl bg-slate-950 px-3.5 py-2 text-sm font-bold text-white disabled:opacity-50">Archive</button></div>
   </div>

   <section className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(135deg,#07152f_0%,#0b2e6f_55%,#1d4ed8_100%)] p-5 text-white shadow-[0_22px_60px_rgba(15,40,95,.24)] sm:p-7">
    <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl"/>
    <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
     <div>
      <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em]">Vehicle Profile</span><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-200">● Active</span></div>
      <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">{vehicle.vehicle_number}</h1>
      <p className="mt-2 text-base font-bold text-white/90">{owner}</p>
      <p className="mt-1 text-sm text-blue-100">{description}{vehicle.fuel_type?` · ${vehicle.fuel_type}`:''}</p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-blue-50"><Pill>{vehicle.vehicle_class||'Class —'}</Pill><Pill>{vehicle.vehicle_category||vehicle.vehicle_type||'Type —'}</Pill>{vehicle.manufacturing_year&&<Pill>{vehicle.manufacturing_year}</Pill>}</div>
     </div>
     <div className="grid grid-cols-2 gap-2 sm:min-w-[300px]">
      <HeroFact label="Vehicle Age" value={age===null?'—':`${age} yr`}/><HeroFact label="Registration" value={formatDate(vehicle.registration_date)}/><HeroFact label="Mobile" value={vehicle.customer?.mobile||'—'}/><HeroFact label="RTO" value={vehicle.registration_authority||'—'}/>
     </div>
    </div>
   </section>

   <section className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3"><Metric label="Billed" value={`₹${profile.balances.billed.toFixed(0)}`}/><Metric label="Received" value={`₹${profile.balances.received.toFixed(0)}`}/><Metric label="Outstanding" value={`₹${profile.balances.outstanding.toFixed(0)}`} attention={profile.balances.outstanding>0}/></section>

   {quickModules.length>0&&<section className="mt-3 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm sm:mt-4 sm:p-5"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">Services</p><h2 className="mt-1 text-lg font-black sm:text-xl">Quick Actions</h2></div><span className="text-xs font-semibold text-slate-400">Tap to open</span></div><div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">{quickModules.map(module=><QuickAction key={module} label={moduleLabels[module]} href={operationHref(vehicle.id,module)} status={profile.modules[module]?.status}/>)}</div></section>}

   <section className="mt-3 rounded-[22px] border border-slate-200 bg-white shadow-sm sm:mt-4">
    <div className="border-b border-slate-100 px-4 py-4 sm:px-5"><p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">RC Snapshot</p><div className="mt-1 flex items-center justify-between gap-3"><h2 className="text-lg font-black sm:text-xl">Vehicle Details</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{commercial?'Commercial':'Private'}</span></div></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3">
      <Info k="Registration Authority" v={vehicle.registration_authority}/><Info k="Vehicle Class" v={vehicle.vehicle_class}/><Info k="Vehicle Type" v={clean(vehicle.vehicle_type)}/><Info k="Category" v={clean(vehicle.vehicle_category)}/><Info k="Chassis Number" v={vehicle.chassis_number} mono/><Info k="Engine Number" v={vehicle.engine_number} mono/><Info k="Manufacturing Year" v={vehicle.manufacturing_year}/><Info k="Colour" v={vehicle.colour}/><Info k="Seating Capacity" v={vehicle.seating_capacity}/><Info k="Unladen Weight" v={vehicle.unladen_weight?`${vehicle.unladen_weight} kg`:'—'}/>{commercial&&<Info k="Laden / GVW" v={vehicle.gross_weight?`${vehicle.gross_weight} kg`:'—'}/>}<Info k="Financier" v={vehicle.financier}/>
    </div>
   </section>
  </div>
 </main>;
}

function clean(value?:string){return value?value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase()):'—'}
function formatDate(value?:string){if(!value)return'—';const d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});}
function Pill({children}:{children:React.ReactNode}){return <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur">{children}</span>}
function HeroFact({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm"><p className="text-[9px] font-black uppercase tracking-[.15em] text-blue-200">{label}</p><p className="mt-1 truncate text-sm font-black text-white">{value}</p></div>}
function Metric({label,value,attention=false}:{label:string;value:string;attention?:boolean}){return <div className={`rounded-2xl border p-3.5 shadow-sm sm:p-4 ${attention?'border-amber-200 bg-amber-50':'border-slate-200 bg-white'}`}><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-lg font-black sm:text-xl ${attention?'text-amber-700':'text-slate-950'}`}>{value}</p></div>}
function QuickAction({label,href,status}:{label:string;href:string;status?:string}){const added=status&&status!=='not_added';return <a href={href} className="group rounded-2xl border border-slate-200 bg-white px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><div className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-base">{actionIcon(label)}</div><p className="mt-2 truncate text-[11px] font-black sm:text-xs">{label}</p><p className={`mt-1 text-[8px] font-black uppercase tracking-wide ${added?'text-emerald-600':'text-slate-400'}`}>{added?'Added':'Open'}</p></a>}
function actionIcon(label:string){if(label.toLowerCase().includes('insurance'))return'🛡️';if(label.toLowerCase().includes('puc'))return'🌿';if(label.toLowerCase().includes('fitness'))return'✓';if(label.toLowerCase().includes('permit'))return'📄';if(label.toLowerCase().includes('tax'))return'₹';if(label.toLowerCase().includes('rto'))return'🏛️';return'•'}
function Info({k,v,mono=false}:{k:string;v?:string|number;mono?:boolean}){return <div className="min-w-0 border-b border-slate-100 px-4 py-4 sm:border-r sm:px-5"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{k}</dt><dd className={`mt-1 break-words text-sm font-black text-slate-800 ${mono?'font-mono tracking-tight':''}`}>{v===0?0:v||'—'}</dd></div>}
