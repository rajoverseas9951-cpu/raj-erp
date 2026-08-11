"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { customerApi, Customer } from "@/lib/customers";
import { setVehicleBusinessRelationshipDraft, VehicleBusinessRelationshipDraft } from "@/lib/vehicles";

const sourceOptions = [
  ["direct","Direct / Own Customer"],
  ["agent","Agent / Referrer"],
  ["dealer","Dealer"],
  ["fleet","Fleet / Group Owner"],
  ["other","Other Source"],
] as const;

const paymentOptions = [
  ["customer","Customer / Vehicle Owner"],
  ["source","Source Party"],
  ["fleet","Fleet / Group Owner"],
  ["other","Other Party"],
] as const;

export function VehicleBusinessRelationshipCard() {
  const [mount,setMount]=useState<HTMLElement|null>(null);
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [source,setSource]=useState<VehicleBusinessRelationshipDraft["business_source_type"]>("direct");
  const [sourceName,setSourceName]=useState("");
  const [paymentType,setPaymentType]=useState<VehicleBusinessRelationshipDraft["default_payment_party_type"]>("customer");
  const [paymentCustomerId,setPaymentCustomerId]=useState("");
  const [paymentName,setPaymentName]=useState("");

  useEffect(()=>{
    const timer=window.setInterval(()=>{
      const form=document.querySelector('.vehicle-onboarding form, form');
      if(!form||form.querySelector('[data-business-relationship-card]')) return;
      const node=document.createElement('div');
      node.dataset.businessRelationshipCard='true';
      const fixed=Array.from(form.children).find(child=>child.classList.contains('fixed'));
      if(fixed) form.insertBefore(node,fixed); else form.appendChild(node);
      setMount(node); window.clearInterval(timer);
    },80);
    return()=>window.clearInterval(timer);
  },[]);

  useEffect(()=>{ customerApi.list("?per_page=100").then(r=>setCustomers(r.data||[])).catch(()=>setCustomers([])); },[]);

  const draft=useMemo<VehicleBusinessRelationshipDraft>(()=>({
    business_source_type:source,
    business_source_name:source==="direct"||source==="fleet"?"":sourceName.trim(),
    default_payment_party_type:paymentType,
    default_payment_customer_id:paymentType==="customer"?paymentCustomerId||undefined:undefined,
    default_payment_party_name:paymentType==="source"?sourceName.trim():paymentType==="other"?paymentName.trim():"",
  }),[source,sourceName,paymentType,paymentCustomerId,paymentName]);

  useEffect(()=>{ setVehicleBusinessRelationshipDraft(draft); return()=>setVehicleBusinessRelationshipDraft(null); },[draft]);
  useEffect(()=>{
    if(source==="direct"&&paymentType==="source") setPaymentType("customer");
    if(source!=="fleet"&&paymentType==="fleet") setPaymentType("customer");
  },[source,paymentType]);

  if(!mount) return null;

  return createPortal(
    <section className="mb-6 overflow-hidden rounded-[26px] border border-[#dbe6f3] bg-white shadow-[0_18px_48px_rgba(15,23,42,.06)]">
      <div className="flex flex-col gap-2 border-b border-slate-100 bg-gradient-to-r from-[#f7faff] to-white px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.2em] text-blue-600">Business & payment defaults</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-[#0a1d3e]">Who brought this customer, and who usually pays?</h2>
          <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-slate-500">Accounting rule: this section only saves defaults. No receivable is created until an actual policy, RTO work or service is billed.</p>
        </div>
        <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.12em] text-emerald-700">Transaction can override</span>
      </div>

      <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2 text-xs font-extrabold text-slate-600">Business Source
          <select value={source} onChange={e=>setSource(e.target.value as typeof source)} className="min-h-12 w-full rounded-2xl border border-slate-200 bg-[#f7faff] px-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50">
            {sourceOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
          <span className="text-[10px] font-medium text-slate-400">For business/source reporting only.</span>
        </label>

        <label className="grid gap-2 text-xs font-extrabold text-slate-600">Source Party
          <input value={sourceName} onChange={e=>setSourceName(e.target.value)} disabled={source==="direct"||source==="fleet"} placeholder={source==="direct"?"Not required":source==="fleet"?"Uses selected fleet":"Agent / dealer / referrer name"} className="min-h-12 w-full rounded-2xl border border-slate-200 bg-[#f7faff] px-4 text-sm font-semibold text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
          <span className="text-[10px] font-medium text-slate-400">Who referred/brought the business.</span>
        </label>

        <label className="grid gap-2 text-xs font-extrabold text-slate-600">Default Payment Party
          <select value={paymentType} onChange={e=>setPaymentType(e.target.value as typeof paymentType)} className="min-h-12 w-full rounded-2xl border border-slate-200 bg-[#f7faff] px-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50">
            {paymentOptions.filter(([v])=>v!=="source"||source!=="direct").filter(([v])=>v!=="fleet"||source==="fleet").map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
          <span className="text-[10px] font-medium text-slate-400">Default debtor for future billable work.</span>
        </label>

        <label className="grid gap-2 text-xs font-extrabold text-slate-600">Payment Party Detail
          {paymentType==="customer" ? (
            <select value={paymentCustomerId} onChange={e=>setPaymentCustomerId(e.target.value)} className="min-h-12 w-full rounded-2xl border border-slate-200 bg-[#f7faff] px-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50">
              <option value="">Same as vehicle customer</option>
              {customers.map(c=><option key={c.id} value={c.id}>{[c.first_name,c.middle_name,c.last_name].filter(Boolean).join(" ")} · {c.mobile}</option>)}
            </select>
          ) : paymentType==="source" ? (
            <div className="flex min-h-12 items-center rounded-2xl border border-blue-100 bg-blue-50 px-4 text-sm font-bold text-blue-800">{sourceName.trim()||"Enter source party first"}</div>
          ) : paymentType==="fleet" ? (
            <div className="flex min-h-12 items-center rounded-2xl border border-blue-100 bg-blue-50 px-4 text-sm font-bold text-blue-800">Selected Fleet / Group Owner</div>
          ) : (
            <input value={paymentName} onChange={e=>setPaymentName(e.target.value)} placeholder="Party name" className="min-h-12 w-full rounded-2xl border border-slate-200 bg-[#f7faff] px-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
          )}
          <span className="text-[10px] font-medium text-slate-400">Actual transaction can be changed later.</span>
        </label>
      </div>
    </section>, mount
  );
}
