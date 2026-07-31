'use client';

import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import {VehicleForm} from '@/components/vehicles/VehicleForm';
import {Vehicle,vehicleApi} from '@/lib/vehicles';

export default function EditVehiclePage(){
  const {vehicleId}=useParams<{vehicleId:string}>();
  const [vehicle,setVehicle]=useState<Vehicle>();
  const [error,setError]=useState('');

  useEffect(()=>{
    void vehicleApi.get(vehicleId)
      .then(setVehicle)
      .catch((reason)=>{
        const message=reason instanceof Error?reason.message:'Vehicle load nahi hua.';
        if(/unauthenticated|401/i.test(message)){
          sessionStorage.removeItem('raj_erp_token');
          location.href='/login';
          return;
        }
        setError(message);
      });
  },[vehicleId]);

  if(error)return <main className="p-6"><div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div></main>;
  if(!vehicle)return <main className="p-6">Loading vehicle…</main>;

  return <main className="p-6"><VehicleForm vehicle={vehicle}/></main>;
}
