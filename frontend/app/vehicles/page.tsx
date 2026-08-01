'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { VehicleTable } from '@/components/vehicles/VehicleTable';
import { Vehicle, vehicleApi } from '@/lib/vehicles';

export default function VehiclesPage(){
 return <Suspense fallback={<main className="p-6"><div className="rounded-xl border bg-white p-6">Loading vehicles...</div></main>}><VehiclesContent/></Suspense>;
}

function VehiclesContent(){
 const searchParams=useSearchParams();
 const [vehicles,setVehicles]=useState<Vehicle[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{
  const token=sessionStorage.getItem('raj_erp_token');
  if(!token){window.location.href='/login';return;}
  setLoading(true);setError('');
  const qs=searchParams.toString();
  vehicleApi.list(qs?`?${qs}`:'').then(r=>setVehicles(r.data??[])).catch(e=>{
   const m=e instanceof Error?e.message:'Vehicles load nahi hue.';
   if(/unauthenticated|401/i.test(m)){sessionStorage.removeItem('raj_erp_token');window.location.href='/login';} else setError(m);
  }).finally(()=>setLoading(false));
 },[searchParams]);
 return <main className="space-y-6 p-6"><div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Vehicle Master</h1><p className="text-slate-500">RC, insurance, PUC, fitness, permit, tax, RTO work aur payment tracking.</p></div><a href="/vehicles/new" className="rounded-md bg-blue-700 px-4 py-2 text-white">Add Vehicle</a></div>{loading&&<div className="rounded-xl border bg-white p-6">Loading vehicles...</div>}{error&&<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}{!loading&&!error&&<VehicleTable vehicles={vehicles}/>}</main>;
}
