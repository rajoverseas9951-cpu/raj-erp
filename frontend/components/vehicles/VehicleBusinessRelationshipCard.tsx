"use client";

import { useEffect, useMemo, useState } from "react";
import { customerApi, Customer } from "@/lib/customers";
import { setVehicleBusinessRelationshipDraft, VehicleBusinessRelationshipDraft } from "@/lib/vehicles";

const sourceOptions = [
  ["direct","Direct / Own Business"],
  ["agent","Agent"],
  ["broker","Broker"],
  ["dealer","Dealer"],
  ["fleet","Fleet"],
  ["other","Other"],
] as const;

const paymentOptions = [
  ["customer","Customer / Vehicle Owner"],
  ["source","Source Party / Agent"],
  ["fleet","Fleet / Group Owner"],
  ["other","Other Party"],
] as const;

export function VehicleBusinessRelationshipCard() {
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [source,setSource]=useState<VehicleBusinessRelationshipDraft["business_source_type"]>("direct");
  const [sourceName,setSourceName]=useState("");
  const [paymentType,setPaymentType]=useState<VehicleBusinessRelationshipDraft["default_payment_party_type"]>("customer");
  const [paymentCustomerId,setPaymentCustomerId]=useState("");
  const [paymentName,setPaymentName]=useState("");

  useEffect(()=>{ customerApi.list("?per_page=100").then(r=>setCustomers(r.data||[])).catch(()=>setCustomers([])); },[]);

  const draft=useMemo<VehicleBusinessRelationshipDraft>(()=>({
    business_source_type:source,
    business_source_name:source==="direct"?"":sourceName.trim(),
    default_payment_party_type:paymentType,
    default_payment_customer_id:paymentType==="customer"?paymentCustomerId||undefined:undefined,
    default_payment_party_name:paymentType==="source"?sourceName.trim():paymentType==="other"?paymentName.trim():"",
  }),[source,sourceName,paymentType,paymentCustomerId,paymentName]);

  useEffect(()=>{ setVehicleBusinessRelationshipDraft(draft); return()=>setVehicleBusinessRelationshipDraft(null); },[draft]);

  useEffect(()=>{
    if(source==="direct" && paymentType==="source") setPaymentType("customer");
    if(source!=="fleet" && paymentType==="fleet") setPaymentType("customer");
  },[source,paymentType]);

  return (
    <section className="mx-auto mb-5 max-w-[1500px] rounded-[24px] border border-slate-200 bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,.06)] sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-[520px]">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#09285a] to-[#2563eb] text-white shadow-lg">₹</span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.19em] text-blue-600">Business & accounting defaults</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">Who brought the work, and who normally pays?</h2>
            </div>
          </div>
          <p className="mt-3 text-xs font-medium leading-5 text-slate-500">This does not create any receivable. It only sets defaults for future insurance/RTO/service transactions, where the payment party can still be changed.</p>
        </div>

        <div className="grid flex-1 gap-3 md:grid-cols-2 xl:max-w-[830px] xl:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[.11em] text-slate-500">Business Source</span>
            <select value={source} onChange={e=>setSource(e.target.value as typeof source)} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-400 focus:bg-white">
              {sourceOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[.11em] text-slate-500">Source Party</span>
            <input value={sourceName} onChange={e=>setSourceName(e.target.value)} disabled={source==="direct"||source==="fleet"} placeholder={source==="direct"?"Not required":source==="fleet"?"Uses Fleet mapping":"Agent / broker / dealer name"} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:border-blue-400 focus:bg-white" />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[.11em] text-slate-500">Default Payment Party</span>
            <select value={paymentType} onChange={e=>setPaymentType(e.target.value as typeof paymentType)} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-400 focus:bg-white">
              {paymentOptions.filter(([v])=>v!=="source"||source!=="direct").filter(([v])=>v!=="fleet"||source==="fleet").map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[.11em] text-slate-500">Party Detail</span>
            {paymentType==="customer" ? (
              <select value={paymentCustomerId} onChange={e=>setPaymentCustomerId(e.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-400 focus:bg-white">
                <option value="">Same as vehicle customer</option>
                {customers.map(c=><option key={c.id} value={c.id}>{[c.first_name,c.middle_name,c.last_name].filter(Boolean).join(" ")} · {c.mobile}</option>)}
              </select>
            ) : paymentType==="source" ? (
              <div className="flex h-12 items-center rounded-2xl border border-blue-100 bg-blue-50 px-3 text-sm font-bold text-blue-800">{sourceName.trim()||"Enter source party"}</div>
            ) : paymentType==="fleet" ? (
              <div className="flex h-12 items-center rounded-2xl border border-blue-100 bg-blue-50 px-3 text-sm font-bold text-blue-800">Uses selected Fleet</div>
            ) : (
              <input value={paymentName} onChange={e=>setPaymentName(e.target.value)} placeholder="Payment party name" className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-400 focus:bg-white" />
            )}
          </label>
        </div>
      </div>
    </section>
  );
}
