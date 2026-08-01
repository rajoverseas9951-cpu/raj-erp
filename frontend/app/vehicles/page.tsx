"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { VehicleTable } from "@/components/vehicles/VehicleTable";
import { Vehicle, VehiclePagination, vehicleApi } from "@/lib/vehicles";

export default function VehiclesPage(){return <Suspense fallback={<VehicleSkeleton/>}><VehiclesContent/></Suspense>}

function VehiclesContent(){
 const searchParams=useSearchParams(); const [vehicles,setVehicles]=useState<Vehicle[]>([]); const [meta,setMeta]=useState<VehiclePagination>(); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [reload,setReload]=useState(0);
 const load=useCallback(async()=>{setLoading(true);setError("");try{const query=searchParams.toString();const result=await vehicleApi.list(query?`?${query}`:"");setVehicles(result.data??[]);setMeta(result.meta??(result.current_page!==undefined?{current_page:result.current_page,last_page:result.last_page??1,per_page:result.per_page??result.data.length,total:result.total??result.data.length}:undefined));}catch(caught){setError(caught instanceof Error?caught.message:"Vehicles could not be loaded.");}finally{setLoading(false)}},[searchParams]);
 useEffect(()=>{void load()},[load,reload]);
 const filtered=Boolean(searchParams.get("search")||searchParams.get("fuel_type"));
 return <main className="mx-auto max-w-[1680px] space-y-6 p-4 sm:p-6 lg:p-8"><header className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-6 text-white shadow-xl sm:p-8"><div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Vehicle operations</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Vehicle Master</h1><p className="mt-2 max-w-2xl text-sm text-blue-100/75">Search, review and manage vehicle ownership, compliance, insurance and documents from one workspace.</p></div><Link href="/vehicles/new" className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-5 font-black text-blue-800 shadow-lg transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-cyan-300/40">+ Add Vehicle</Link></div></header>
 {error?<section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700"><h2 className="font-black">Vehicles could not be loaded</h2><p className="mt-1 text-sm">{error}</p><button onClick={()=>setReload(value=>value+1)} className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white">Retry</button></section>:loading&&!vehicles.length?<VehicleSkeleton/>:!vehicles.length?<section className="rounded-[28px] border border-dashed border-slate-300 bg-white p-12 text-center"><h2 className="text-xl font-black">{filtered?"No matching vehicles":"No vehicles yet"}</h2><p className="mt-2 text-sm text-slate-500">{filtered?"Clear or change the current filters.":"Add the first vehicle to begin managing compliance and insurance."}</p>{!filtered&&<Link href="/vehicles/new" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">Add Vehicle</Link>}</section>:<VehicleTable vehicles={vehicles} meta={meta} loading={loading} onChanged={()=>setReload(value=>value+1)}/>} </main>
}
function VehicleSkeleton(){return <main className="mx-auto max-w-[1680px] space-y-4 p-4 sm:p-6 lg:p-8"><div className="h-44 animate-pulse rounded-[28px] bg-slate-200"/><div className="rounded-[28px] border bg-white p-5">{Array.from({length:6}).map((_,index)=><div key={index} className="mb-3 h-16 animate-pulse rounded-xl bg-slate-100"/>)}</div></main>}
