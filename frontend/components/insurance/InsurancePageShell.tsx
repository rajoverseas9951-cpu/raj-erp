'use client';

import type {ReactNode} from 'react';
import {useEffect,useMemo,useState} from 'react';
import {vehicleInsuranceApi,type VehicleInsurancePolicy} from '@/lib/vehicle-insurance';
import PolicyFundingPanel from '@/components/insurance/PolicyFundingPanel';

const isCurrent=(p:VehicleInsurancePolicy)=>!['cancelled','expired'].includes(String(p.status||'').toLowerCase())&&!p.archived_at;

export default function InsurancePageShell({vehicleId,children}:{vehicleId:string;children:ReactNode}){
 const[policies,setPolicies]=useState<VehicleInsurancePolicy[]>([]);const[showEntry,setShowEntry]=useState(false);const[paymentOpen,setPaymentOpen]=useState(false);const[paymentPolicy,setPaymentPolicy]=useState<string>();
 async function reload(){try{setPolicies(await vehicleInsuranceApi.list(vehicleId))}catch{}}
 useEffect(()=>{void reload()},[vehicleId]);
 useEffect(()=>{const click=(e:MouseEvent)=>{const el=(e.target as HTMLElement)?.closest('button');if(!el)return;const text=(el.textContent||'').trim().toLowerCase();if(!text.includes('save policy'))return;const before=policies[0]?.id;window.setTimeout(async()=>{try{const rows=await vehicleInsuranceApi.list(vehicleId);setPolicies(rows);const newest=rows[0];if(newest&&newest.id!==before){setShowEntry(false);setPaymentPolicy(newest.id);setPaymentOpen(true)}}catch{}},1000)};document.addEventListener('click',click,true);return()=>document.removeEventListener('click',click,true)},[vehicleId,policies]);
 useEffect(()=>{const done=(e:Event)=>{const d=(e as CustomEvent<{vehicleId?:string}>).detail;if(!d?.vehicleId||d.vehicleId===vehicleId)void reload()};window.addEventListener('raj:insurance-payment-saved',done);return()=>window.removeEventListener('raj:insurance-payment-saved',done)},[vehicleId]);
 const current=useMemo(()=>policies.find(isCurrent),[policies]);
 return <div className={`insurance-page-shell ${current&&!showEntry?'has-current-policy':''}`}>
  <style jsx global>{`
   .insurance-page-shell.has-current-policy main > section:first-of-type{display:none!important}
   .insurance-page-shell.has-current-policy main > form{display:none!important}
  `}</style>
  {current&&<div className="mx-auto mt-4 max-w-[1500px] rounded-[20px] border border-emerald-200 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,.06)] md:px-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">✓</span><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-700">Current insurance active</p><p className="mt-0.5 truncate text-sm font-black text-slate-900">{current.company_name} · {current.policy_number}</p><p className="mt-0.5 text-xs font-semibold text-slate-500">Expiry {current.expiry_date}</p></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={()=>{setPaymentPolicy(current.id);setPaymentOpen(true)}} className="rounded-xl bg-[#0b2f6b] px-4 py-2.5 text-xs font-black text-white shadow-sm">Company Payment</button><button type="button" onClick={()=>setShowEntry(v=>!v)} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-700">{showEntry?'Close Entry':'Add / Renew Policy'}</button></div></div></div>}
  {children}
  <PolicyFundingPanel vehicleId={vehicleId} open={paymentOpen} onClose={()=>setPaymentOpen(false)} defaultPolicyId={paymentPolicy}/>
 </div>
}
