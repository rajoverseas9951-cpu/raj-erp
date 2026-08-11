"use client";

import { FormEvent, useEffect, useState } from "react";
import { customerApi, Customer } from "@/lib/customers";

type Values = {
  first_name: string; middle_name: string; last_name: string; mobile: string;
  whatsapp: string; email: string; date_of_birth: string; gender: string;
  current_address: string; permanent_address: string; city: string; district: string; state: string; pincode: string;
};

const blank: Values = { first_name:"", middle_name:"", last_name:"", mobile:"", whatsapp:"", email:"", date_of_birth:"", gender:"", current_address:"", permanent_address:"", city:"", district:"", state:"", pincode:"" };

export function InlineCustomerCreator() {
  const [open,setOpen]=useState(false);
  const [values,setValues]=useState<Values>(blank);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [created,setCreated]=useState<Customer|null>(null);

  useEffect(()=>{
    const click=(event:MouseEvent)=>{
      const target=event.target as HTMLElement|null;
      const link=target?.closest('a[href="/customers/new"]');
      if(!link) return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener("click",click);
    return()=>document.removeEventListener("click",click);
  },[]);

  useEffect(()=>{
    if(!created) return;
    const sync=()=>{
      const labels=[...document.querySelectorAll("#vehicle-step-1 label")];
      const label=labels.find((node)=>node.textContent?.trim().startsWith("Customer"));
      const select=label?.querySelector("select") as HTMLSelectElement|null;
      if(!select) return;
      let option=[...select.options].find((o)=>o.value===created.id);
      if(!option){
        option=document.createElement("option");
        option.value=created.id;
        option.textContent=`${created.first_name} ${created.middle_name??""} ${created.last_name} — ${created.mobile}`.replace(/\s+/g," ").trim();
        select.appendChild(option);
      }
      if(select.value!==created.id){
        select.value=created.id;
        select.dispatchEvent(new Event("change",{bubbles:true}));
      }
    };
    sync();
    const observer=new MutationObserver(sync);
    observer.observe(document.body,{childList:true,subtree:true});
    const timer=window.setInterval(sync,500);
    return()=>{observer.disconnect();window.clearInterval(timer)};
  },[created]);

  function set<K extends keyof Values>(key:K,value:Values[K]){ setValues(v=>({...v,[key]:value})); }

  async function submit(event:FormEvent){
    event.preventDefault(); setSaving(true); setError("");
    try{
      const customer=await customerApi.create({...values,tags:[],priority:"normal",status:"active"});
      setCreated(customer);
      setOpen(false);
      setValues(blank);
    }catch(e){ setError(e instanceof Error?e.message:"Customer save nahi hua."); }
    finally{ setSaving(false); }
  }

  if(!open) return null;
  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#06152f]/60 p-3 backdrop-blur-sm sm:p-6">
    <div className="mx-auto max-w-5xl overflow-hidden rounded-[28px] border border-blue-100 bg-white shadow-2xl">
      <div className="flex items-center justify-between bg-gradient-to-r from-[#071a3c] to-[#155bd7] px-6 py-5 text-white">
        <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">Quick customer</p><h2 className="mt-1 text-2xl font-black">Create Customer</h2><p className="mt-1 text-xs text-blue-100">Save here and continue the same vehicle form.</p></div>
        <button type="button" onClick={()=>setOpen(false)} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-black">✕</button>
      </div>
      <form onSubmit={submit} className="space-y-5 p-5 sm:p-6">
        {error&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
        <section><h3 className="mb-4 text-lg font-black text-[#10213f]">Personal Information</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="First Name" required value={values.first_name} onChange={v=>set("first_name",v)}/>
          <Input label="Middle Name" value={values.middle_name} onChange={v=>set("middle_name",v)}/>
          <Input label="Last Name / Surname" required value={values.last_name} onChange={v=>set("last_name",v)}/>
          <Input label="Mobile Number" required value={values.mobile} onChange={v=>set("mobile",v.replace(/\D/g,"").slice(0,10))}/>
          <Input label="WhatsApp" value={values.whatsapp} onChange={v=>set("whatsapp",v.replace(/\D/g,"").slice(0,10))}/>
          <Input label="Email" type="email" value={values.email} onChange={v=>set("email",v)}/>
          <Input label="Date of Birth" type="date" value={values.date_of_birth} onChange={v=>set("date_of_birth",v)}/>
          <label className="text-xs font-black text-slate-600">Gender<select value={values.gender} onChange={e=>set("gender",e.target.value)} className={fieldClass}><option value="">Select Gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
        </div></section>
        <section className="border-t border-slate-100 pt-5"><h3 className="mb-4 text-lg font-black text-[#10213f]">Address</h3><div className="grid gap-4 sm:grid-cols-2">
          <Textarea label="Current Address" value={values.current_address} onChange={v=>set("current_address",v)}/><Textarea label="Permanent Address" value={values.permanent_address} onChange={v=>set("permanent_address",v)}/>
        </div><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="City" value={values.city} onChange={v=>set("city",v)}/><Input label="District" value={values.district} onChange={v=>set("district",v)}/><Input label="State" value={values.state} onChange={v=>set("state",v)}/><Input label="Pincode" value={values.pincode} onChange={v=>set("pincode",v.replace(/\D/g,"").slice(0,6))}/>
        </div></section>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-5"><button type="button" onClick={()=>setOpen(false)} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600">Cancel</button><button disabled={saving} className="min-w-[180px] rounded-2xl bg-gradient-to-r from-[#0b2f6b] to-[#2563eb] px-6 py-3 text-sm font-black text-white disabled:opacity-50">{saving?"Saving…":"✓ Save & Select"}</button></div>
      </form>
    </div>
  </div>;
}

const fieldClass="mt-2 w-full rounded-2xl border border-[#d9e4f1] bg-[#f8fbff] px-4 py-3.5 text-sm font-bold text-[#10213f] outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100/70";
function Input({label,value,onChange,type="text",required=false}:{label:string;value:string;onChange:(v:string)=>void;type?:string;required?:boolean}){return <label className="text-xs font-black text-slate-600">{label}{required&&<span className="text-red-500"> *</span>}<input className={fieldClass} type={type} required={required} value={value} onChange={e=>onChange(e.target.value)}/></label>}
function Textarea({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <label className="text-xs font-black text-slate-600">{label}<textarea rows={3} className={fieldClass} value={value} onChange={e=>onChange(e.target.value)}/></label>}
