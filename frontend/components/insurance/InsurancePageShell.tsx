'use client';

import type {ReactNode} from 'react';
import {useEffect,useMemo,useState} from 'react';
import {vehicleInsuranceApi,type VehicleInsurancePolicy} from '@/lib/vehicle-insurance';
import PolicyFundingPanel from '@/components/insurance/PolicyFundingPanel';

const isCurrent=(p:VehicleInsurancePolicy)=>!['cancelled','expired'].includes(String(p.status||'').toLowerCase());

export default function InsurancePageShell({vehicleId,children}:{vehicleId:string;children:ReactNode}){
 const[policies,setPolicies]=useState<VehicleInsurancePolicy[]>([]);const[showEntry,setShowEntry]=useState(false);const[refreshKey,setRefreshKey]=useState(0);
 async function reload(){try{setPolicies(await vehicleInsuranceApi.list(vehicleId))}catch{}}
 useEffect(()=>{void reload()},[vehicleId]);
 useEffect(()=>{const click=(e:MouseEvent)=>{const el=(e.target as HTMLElement)?.closest('button');if(!el)return;const text=(el.textContent||'').trim().toLowerCase();if(text.includes('save policy')){const before=policies[0]?.id;window.setTimeout(async()=>{try{const rows=await vehicleInsuranceApi.list(vehicleId);setPolicies(rows);const newest=rows[0];if(newest&&newest.id!==before){setShowEntry(false);setRefreshKey(x=>x+1)}}catch{}},900)}};document.addEventListener('click',click,true);return()=>document.removeEventListener('click',click,true)},[vehicleId,policies]);
 const current=useMemo(()=>policies.find(isCurrent),[policies]);
 return <div className={`insurance-page-shell ${current&&!showEntry?'has-current-policy':''}`}>
  <style jsx global>{`
   .insurance-page-shell.has-current-policy main > section:first-of-type{display:none!important}
   .insurance-page-shell.has-current-policy main > form{display:none!important}
  `}</style>
  {current&&<div className="mx-auto mt-4 max-w-[1500px] rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 shadow-sm md:px-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-700">Current insurance active</p><p className="mt-1 text-sm font-black text-slate-900">{current.company_name} · {current.policy_number}</p><p className="mt-0.5 text-xs font-semibold text-slate-500">Expiry {current.expiry_date}. Existing policy entry is collapsed to keep this page clean.</p></div><button type="button" onClick={()=>setShowEntry(v=>!v)} className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-black text-emerald-800 shadow-sm">{showEntry?'Close entry form':'Add / Renew Policy'}</button></div></div>}
  {children}
  <PolicyFundingPanel key={refreshKey} vehicleId={vehicleId}/>
 </div>
}
