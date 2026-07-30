'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Vehicle, vehicleApi } from '@/lib/vehicles';
import { InsuranceCompany, insuranceAccountingApi } from '@/lib/insurance-accounting';
import { VehicleInsurancePolicy, vehicleInsuranceApi } from '@/lib/vehicle-insurance';

type PurchaseForm = { id:string; name:string; code:string; active:boolean };

const blank = {
  company_id:'', code:'', purchase_form_id:'', policy_number:'', policy_date:'', issue_date:'', expiry_date:'',
  status:'running', insurance_type:'comprehensive', od_premium:'0', tp_premium:'0', addon_premium:'0',
  commission_percent:'0', gst_other_charges:'0', customer_discount:'0', agent:'', agent_commission:'0', remark:''
};

const money=(v:number)=>`₹${Number(v||0).toFixed(2)}`;

export default function VehicleInsurancePage(){
  const {vehicleId}=useParams<{vehicleId:string}>();
  const [vehicle,setVehicle]=useState<Vehicle|null>(null);
  const [companies,setCompanies]=useState<InsuranceCompany[]>([]);
  const [purchaseForms,setPurchaseForms]=useState<PurchaseForm[]>([]);
  const [form,setForm]=useState<Record<string,string>>(blank);
  const [policies,setPolicies]=useState<VehicleInsurancePolicy[]>([]);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [showPurchaseForm,setShowPurchaseForm]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');

  const purchaseKey='raj_erp_purchase_forms';

  useEffect(()=>{
    async function load(){
      setLoading(true); setError('');
      try{
        const [v,c,p]=await Promise.all([vehicleApi.get(vehicleId),insuranceAccountingApi.companies(),vehicleInsuranceApi.list(vehicleId)]);
        setVehicle(v); setCompanies(c.filter(x=>x.status==='active'));
        setPolicies(p);
        const savedForms=localStorage.getItem(purchaseKey); if(savedForms) setPurchaseForms(JSON.parse(savedForms));
      }catch(e){
        const m=e instanceof Error?e.message:'Data load nahi hua.';
        if(/unauthenticated|401/i.test(m)){sessionStorage.removeItem('raj_erp_token');location.href='/login';return;}
        setError(m);
      }finally{setLoading(false)}
    }
    void load();
  },[vehicleId]);

  const n=(k:string)=>Number(form[k]||0);
  const gross=useMemo(()=>n('od_premium')+n('tp_premium')+n('addon_premium')+n('gst_other_charges'),[form]);
  const commission=useMemo(()=>gross*n('commission_percent')/100,[gross,form]);
  const customerPay=useMemo(()=>Math.max(0,gross-n('customer_discount')),[gross,form]);
  const agentCommission=useMemo(()=>Math.min(n('agent_commission'),commission),[commission,form]);
  const set=(k:string,v:string)=>setForm(o=>({...o,[k]:v}));

  function selectCompany(id:string){
    const company=companies.find(c=>c.id===id);
    setForm(o=>({...o,company_id:id,code:company?.short_code??'',commission_percent:String(company?.default_commission_percent??0)}));
  }

  function addPurchaseForm(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); const el=e.currentTarget; const fd=new FormData(el);
    const name=String(fd.get('name')??'').trim().toUpperCase(); const code=String(fd.get('code')??'').trim().toUpperCase();
    if(!name){setError('Purchase form name required hai.');return;}
    const row:PurchaseForm={id:crypto.randomUUID(),name,code,active:true};
    const next=[...purchaseForms,row]; setPurchaseForms(next); localStorage.setItem(purchaseKey,JSON.stringify(next));
    set('purchase_form_id',row.id); setShowPurchaseForm(false); el.reset(); setSuccess('Purchase form add ho gaya.');
  }

  async function submit(e:FormEvent){
    e.preventDefault(); setError(''); setSuccess(''); setSaving(true);
    const company=companies.find(c=>c.id===form.company_id); const purchase=purchaseForms.find(p=>p.id===form.purchase_form_id);
    if(!company){setError('Pehle Insurance Company Master me company add karke select karo.');setSaving(false);return;}
    if(!purchase){setError('Purchase Form select ya add karo.');setSaving(false);return;}
    if(!form.policy_number||!form.issue_date||!form.expiry_date){setError('Policy number, issue date aur expiry date required hain.');setSaving(false);return;}
    const payload={insurance_company_id:company.id,company_name:company.company_name,company_code:company.short_code??'',purchase_from:purchase.name,policy_number:form.policy_number.toUpperCase(),policy_date:form.policy_date||null,issue_date:form.issue_date,expiry_date:form.expiry_date,status:form.status,insurance_type:form.insurance_type,remark:form.remark||null,od_premium:n('od_premium'),tp_premium:n('tp_premium'),addon_premium:n('addon_premium'),gst_other_charges:n('gst_other_charges'),commission_percent:n('commission_percent'),customer_discount:n('customer_discount'),agent:form.agent||null,agent_commission:agentCommission,payment_details:{}};
    try{
      const saved=editingId?await vehicleInsuranceApi.update(vehicleId,editingId,payload):await vehicleInsuranceApi.create(vehicleId,payload);
      setPolicies(old=>editingId?old.map(policy=>policy.id===saved.id?saved:policy):[saved,...old]);
      setForm(blank);setEditingId(null);setSuccess(editingId?'Insurance policy update ho gayi.':'Insurance policy save ho gayi.');
    }catch(e){setError(e instanceof Error?e.message:'Insurance policy save nahi hui.');}
    finally{setSaving(false);}
  }

  function edit(policy:VehicleInsurancePolicy){
    let purchase=purchaseForms.find(row=>row.name===policy.purchase_from);
    if(!purchase){purchase={id:`policy-${policy.id}`,name:policy.purchase_from,code:'',active:true};setPurchaseForms(old=>[...old,purchase!]);}
    setEditingId(policy.id);
    setForm({company_id:policy.insurance_company_id??'',code:policy.company_code??'',purchase_form_id:purchase.id,policy_number:policy.policy_number,policy_date:policy.policy_date??'',issue_date:policy.issue_date,expiry_date:policy.expiry_date,status:policy.status,insurance_type:policy.insurance_type,od_premium:String(policy.od_premium),tp_premium:String(policy.tp_premium),addon_premium:String(policy.addon_premium),commission_percent:String(policy.commission_percent),gst_other_charges:String(policy.gst_other_charges),customer_discount:String(policy.customer_discount),agent:policy.agent??'',agent_commission:String(policy.agent_commission),remark:policy.remark??''});
    window.scrollTo({top:0,behavior:'smooth'});
  }

  async function remove(id:string){if(!confirm('Policy delete karni hai?'))return;try{await vehicleInsuranceApi.remove(vehicleId,id);setPolicies(old=>old.filter(policy=>policy.id!==id));}catch(e){setError(e instanceof Error?e.message:'Policy delete nahi hui.');}}

  if(loading)return <main className="p-6">Loading insurance...</main>;
  if(!vehicle)return <main className="p-6"><div className="rounded-xl bg-red-50 p-4 text-red-700">{error||'Vehicle nahi mila.'}</div></main>;

  return <main className="space-y-6 p-6">
    <section className="rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-blue-700 p-7 text-white shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold tracking-[.24em] text-blue-200">POLICY MANAGEMENT</p><h1 className="mt-2 text-3xl font-black">{vehicle.vehicle_number}</h1><p className="mt-1 text-blue-100">{vehicle.customer?.first_name} {vehicle.customer?.last_name} · {vehicle.customer?.mobile}</p></div><div className="flex gap-2"><a href={`/vehicles/${vehicle.id}`} className="rounded-xl bg-white px-5 py-3 font-bold text-slate-900">Vehicle Profile</a><a href="/accounts/insurance" className="rounded-xl border border-white/30 px-5 py-3 font-bold">Company Master</a></div></div>
    </section>

    <nav className="flex flex-wrap gap-2 rounded-2xl border bg-white p-3 shadow-sm"><a href={`/vehicles/${vehicle.id}`} className="rounded-xl px-4 py-2 font-semibold hover:bg-slate-100">Overview</a><a href={`/vehicles/${vehicle.id}/insurance`} className="rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white">Insurance</a><a href={`/vehicles/${vehicle.id}/puc`} className="rounded-xl px-4 py-2 font-semibold hover:bg-slate-100">PUC</a><a href={`/vehicles/${vehicle.id}/rto-work`} className="rounded-xl px-4 py-2 font-semibold hover:bg-slate-100">RTO Work</a><a href={`/vehicles/${vehicle.id}/payments`} className="rounded-xl px-4 py-2 font-semibold hover:bg-slate-100">Payments</a></nav>

    {error&&<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}{success&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{success}</div>}

    {companies.length===0&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="font-bold text-amber-900">Abhi koi Insurance Company add nahi hai.</p><p className="mt-1 text-sm text-amber-800">Pehle Company Master me company, code aur default commission % add karo.</p><a href="/accounts/insurance" className="mt-3 inline-block rounded-xl bg-amber-700 px-4 py-2 font-bold text-white">Add Insurance Company</a></div>}

    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[.9fr_1.45fr_1.05fr]">
      <Card title="Vehicle Snapshot"><Info label="Vehicle No" value={vehicle.vehicle_number}/><Info label="Party" value={`${vehicle.customer?.first_name??''} ${vehicle.customer?.last_name??''}`}/><Info label="Mobile" value={vehicle.customer?.mobile}/><Info label="Vehicle Type" value={vehicle.vehicle_type?.replaceAll('_',' ')}/><Info label="Chassis No" value={vehicle.chassis_number}/><Info label="Engine No" value={vehicle.engine_number}/><Info label="Seating" value={vehicle.seating_capacity}/><Info label="CC / GVW" value={vehicle.cubic_capacity||vehicle.gross_weight}/></Card>

      <Card title="Policy Details"><div className="grid gap-4 md:grid-cols-2">
        <SelectObjects label="Insurance Company" value={form.company_id} onChange={selectCompany} options={companies.map(c=>({value:c.id,label:c.company_name}))}/>
        <ReadText label="Company Code" value={form.code||'Auto from company master'}/>
        <label className="text-sm font-semibold md:col-span-2">Purchase Form<div className="mt-2 flex gap-2"><select value={form.purchase_form_id} onChange={e=>set('purchase_form_id',e.target.value)} className="w-full rounded-xl border bg-white px-4 py-3 font-normal"><option value="">Select Purchase Form</option>{purchaseForms.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name}{p.code?` (${p.code})`:''}</option>)}</select><button type="button" onClick={()=>setShowPurchaseForm(true)} className="whitespace-nowrap rounded-xl border border-blue-200 bg-blue-50 px-4 font-bold text-blue-700">+ Add</button></div></label>
        <Input label="Policy No" value={form.policy_number} onChange={v=>set('policy_number',v.toUpperCase())}/><Input type="date" label="Policy Date" value={form.policy_date} onChange={v=>set('policy_date',v)}/><Input type="date" label="Issue Date" value={form.issue_date} onChange={v=>set('issue_date',v)}/><Input type="date" label="Expiry Date" value={form.expiry_date} onChange={v=>set('expiry_date',v)}/><Select label="Status" value={form.status} onChange={v=>set('status',v)} options={['running','pending','expired','cancelled']}/><Select label="Insurance Type" value={form.insurance_type} onChange={v=>set('insurance_type',v)} options={['comprehensive','third_party','standalone_od','commercial_package']}/><label className="text-sm font-semibold md:col-span-2">Remark<textarea value={form.remark} onChange={e=>set('remark',e.target.value)} className="mt-2 min-h-24 w-full rounded-xl border p-3 font-normal"/></label>
      </div></Card>

      <Card title="Premium & Earnings"><div className="grid gap-4 md:grid-cols-2">
        <Input type="number" label="OD Premium" value={form.od_premium} onChange={v=>set('od_premium',v)}/><Input type="number" label="TP Premium" value={form.tp_premium} onChange={v=>set('tp_premium',v)}/><Input type="number" label="Add-on Premium" value={form.addon_premium} onChange={v=>set('addon_premium',v)}/><Input type="number" label="GST / Other Charges" value={form.gst_other_charges} onChange={v=>set('gst_other_charges',v)}/><Read label="Gross Premium" value={gross}/><Input type="number" label="Commission %" value={form.commission_percent} onChange={v=>set('commission_percent',v)}/><Read label="Gross Commission" value={commission}/><Input type="number" label="Customer Discount" value={form.customer_discount} onChange={v=>set('customer_discount',v)}/><Read label="Customer Pay" value={customerPay}/><Input label="Agent" value={form.agent} onChange={v=>set('agent',v)}/><Input type="number" label="Agent Commission" value={String(agentCommission)} onChange={v=>set('agent_commission',String(Math.min(Number(v||0),commission)))}/>
      </div><p className="mt-3 text-xs text-slate-500">Agent commission is capped at Gross Commission.</p><button disabled={companies.length===0||saving} className="mt-5 w-full rounded-xl bg-blue-800 px-5 py-3 font-bold text-white disabled:opacity-40">{saving?'Saving Policy...':editingId?'Update Insurance Policy':'Save Insurance Policy'}</button>{editingId&&<button type="button" onClick={()=>{setEditingId(null);setForm(blank)}} className="mt-2 w-full rounded-xl border px-5 py-3 font-bold">Cancel Edit</button>}</Card>
    </form>

    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-xl font-bold">Policy History</h2><p className="text-sm text-slate-500">Current aur previous policies.</p></div><span className="rounded-full bg-blue-50 px-4 py-2 font-bold text-blue-700">{policies.length} Policies</span></div><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-slate-50"><tr>{['Company','Purchase From','Type','Policy No','Issue','Expiry','Gross Premium','Gross Commission','Customer Pay','Status','Action'].map(h=><th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{policies.length===0?<tr><td colSpan={11} className="p-10 text-center text-slate-500">Abhi koi policy add nahi hai.</td></tr>:policies.map(p=><tr key={p.id} className="border-t"><td className="p-4 font-semibold">{p.company_name}</td><td className="p-4">{p.purchase_from}</td><td className="p-4 capitalize">{p.insurance_type.replaceAll('_',' ')}</td><td className="p-4">{p.policy_number}</td><td className="p-4">{p.issue_date}</td><td className="p-4">{p.expiry_date}</td><td className="p-4">{money(p.gross_premium)}</td><td className="p-4">{money(p.gross_commission)}</td><td className="p-4">{money(p.customer_pay)}</td><td className="p-4"><span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold capitalize text-emerald-700">{p.status}</span></td><td className="p-4"><div className="flex gap-2"><button type="button" onClick={()=>edit(p)} className="rounded-lg border border-blue-200 px-3 py-2 text-blue-700">Edit</button><button type="button" onClick={()=>void remove(p.id)} className="rounded-lg border border-red-200 px-3 py-2 text-red-600">Delete</button></div></td></tr>)}</tbody></table></div></section>

    {showPurchaseForm&&<div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><form onSubmit={addPurchaseForm} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Add Purchase Form</h2><button type="button" onClick={()=>setShowPurchaseForm(false)} className="rounded-lg border px-3 py-1">Close</button></div><div className="mt-5 grid gap-4"><label className="text-sm font-semibold">Purchase Form Name<input name="name" required placeholder="Example: RAJ INSURANCE DHANERA" className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"/></label><label className="text-sm font-semibold">Short Code<input name="code" placeholder="Example: RID" className="mt-2 w-full rounded-xl border px-4 py-3 font-normal uppercase"/></label><button className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">Save Purchase Form</button></div></form></div>}
  </main>;
}

function Card({title,children}:{title:string;children:React.ReactNode}){return <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="mb-5 text-xl font-black text-slate-900">{title}</h2>{children}</section>}
function Info({label,value}:{label:string;value?:string|number}){return <div className="border-b py-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-semibold capitalize">{value||'—'}</p></div>}
function Input({label,value,onChange,type='text'}:{label:string;value:string;onChange:(v:string)=>void;type?:string}){return <label className="text-sm font-semibold">{label}<input type={type} value={value} onChange={e=>onChange(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></label>}
function Select({label,value,onChange,options}:{label:string;value:string;onChange:(v:string)=>void;options:string[]}){return <label className="text-sm font-semibold">{label}<select value={value} onChange={e=>onChange(e.target.value)} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal"><option value="">Select</option>{options.map(o=><option key={o} value={o}>{o.replaceAll('_',' ').toUpperCase()}</option>)}</select></label>}
function SelectObjects({label,value,onChange,options}:{label:string;value:string;onChange:(v:string)=>void;options:{value:string;label:string}[]}){return <label className="text-sm font-semibold">{label}<select value={value} onChange={e=>onChange(e.target.value)} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal"><option value="">Select Company</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>}
function Read({label,value}:{label:string;value:number}){return <label className="text-sm font-semibold">{label}<div className="mt-2 rounded-xl border bg-slate-100 px-4 py-3 font-black">{money(value)}</div></label>}
function ReadText({label,value}:{label:string;value:string}){return <label className="text-sm font-semibold">{label}<div className="mt-2 min-h-[50px] rounded-xl border bg-slate-100 px-4 py-3 font-bold text-slate-700">{value}</div></label>}
