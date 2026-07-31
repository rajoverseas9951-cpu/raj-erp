'use client';

import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect,useState} from 'react';
import {Customer,customerApi} from '@/lib/customers';

const tabs=['Overview','Vehicles','Insurance','RTO','Passport','GST','ITR','Documents','Notes','Timeline'];

export default function CustomerProfilePage(){
 const {customerId}=useParams<{customerId:string}>();
 const [customer,setCustomer]=useState<Customer>();
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  customerApi.get(customerId).then(value=>{if(active)setCustomer(value)}).catch(reason=>{
   if(!active)return;
   const message=reason instanceof Error?reason.message:'Customer profile could not load.';
   if(/unauthenticated|401/i.test(message)){
    sessionStorage.removeItem('raj_erp_token');
    location.replace(`/login?next=${encodeURIComponent(`/customers/${customerId}`)}`);
    return;
   }
   setError(message);
  });
  return()=>{active=false};
 },[customerId]);

 if(error)return <main className="grid min-h-[70vh] place-items-center p-6"><section className="w-full max-w-xl rounded-2xl border border-rose-200 bg-white p-7 text-center shadow-xl"><p className="text-sm font-black uppercase tracking-widest text-rose-500">Customer load failed</p><h1 className="mt-3 text-2xl font-black">This profile could not be opened.</h1><p className="mt-2 text-sm text-slate-500">{error}</p><div className="mt-6 flex justify-center gap-2"><button onClick={()=>location.reload()} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">Try again</button><Link href="/customers" className="rounded-xl border px-5 py-3 text-sm font-bold">All Customers</Link></div></section></main>;
 if(!customer)return <ProfileSkeleton/>;

 const name=[customer.first_name,customer.middle_name,customer.last_name].filter(Boolean).join(' ');
 return <main className="space-y-6 p-4 sm:p-6">
  <section className="relative overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_88%_10%,rgba(34,211,238,.24),transparent_28%),linear-gradient(135deg,#050816,#10245f_58%,#245eea)] p-6 text-white shadow-xl">
   <div className="relative flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">{customer.customer_code}</p><h1 className="mt-2 text-3xl font-black">{name}</h1><p className="mt-2 text-sm text-blue-100/75">{[customer.mobile,customer.email,customer.city].filter(Boolean).join(' · ')}</p></div><div className="flex gap-2"><Link className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold" href="/customers">All Customers</Link><Link className="rounded-xl bg-white px-4 py-3 text-sm font-black text-blue-800" href={`/customers/${customer.id}/edit`}>Edit Customer</Link></div></div>
  </section>
  <nav className="flex flex-wrap gap-2 rounded-2xl border bg-white p-3 shadow-sm">{tabs.map(tab=>{const href=tab==='Timeline'?`/customers/${customer.id}/timeline`:tab==='Overview'?`/customers/${customer.id}`:'#';return <Link key={tab} href={href} aria-disabled={href==='#'} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab==='Overview'?'bg-blue-600 text-white':href==='#'?'cursor-not-allowed text-slate-400':'hover:bg-blue-50 hover:text-blue-700'}`}>{tab}</Link>})}</nav>
  <section className="grid gap-4 md:grid-cols-3"><Card title="Vehicles" value={customer.vehicles_count}/><Card title="Insurance Policies" value={customer.insurance_policies_count}/><Card title="RTO Files" value={customer.rto_files_count}/></section>
  <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Customer Overview</h2><dl className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Info label="GST Number" value={customer.gst_number}/><Info label="Priority" value={customer.priority}/><Info label="Status" value={customer.status}/><Info label="Mobile" value={customer.mobile}/><Info label="Email" value={customer.email}/><Info label="City" value={customer.city}/><Info label="State" value={customer.state}/><Info label="Address" value={customer.current_address}/></dl></section>
 </main>;
}

function Card({title,value}:{title:string;value:number}){return <article className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</p><p className="mt-2 text-3xl font-black">{value.toLocaleString('en-IN')}</p></article>}
function Info({label,value}:{label:string;value?:string|number}){return <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 break-words font-bold capitalize">{value||'—'}</dd></div>}
function ProfileSkeleton(){return <main className="space-y-5 p-6"><div className="h-48 animate-pulse rounded-[28px] bg-slate-200"/><div className="grid gap-4 md:grid-cols-3">{[1,2,3].map(value=><div key={value} className="h-28 animate-pulse rounded-2xl bg-slate-100"/>)}</div><div className="h-64 animate-pulse rounded-2xl bg-slate-100"/></main>}
