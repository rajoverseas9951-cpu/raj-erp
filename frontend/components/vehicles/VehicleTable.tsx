"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Vehicle, VehiclePagination, vehicleApi } from "@/lib/vehicles";
import { apiUrl } from "@/lib/api-url";

type Props = { vehicles: Vehicle[]; meta?: VehiclePagination; loading?: boolean; onChanged: () => void };
const statusFields = ["insurance_status", "fitness_status", "permit_status", "tax_status", "puc_status"] as const;

export function VehicleTable({ vehicles, meta, loading = false, onChanged }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState(searchParams.get("search") ?? "");
  const [mutating, setMutating] = useState(false);
  const selectedCount = selected.length;
  const allSelected = vehicles.length > 0 && vehicles.every((vehicle) => selected.includes(vehicle.id));

  useEffect(() => setSearchValue(searchParams.get("search") ?? ""), [searchParams]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchValue !== (searchParams.get("search") ?? "")) updateQuery({ search: searchValue, page: "" });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchValue]);
  useEffect(() => setSelected((current) => current.filter((id) => vehicles.some((vehicle) => vehicle.id === id))), [vehicles]);

  function updateQuery(values: Record<string, string>) {
    const query = new URLSearchParams(searchParams.toString());
    Object.entries(values).forEach(([key, value]) => value ? query.set(key, value) : query.delete(key));
    router.replace(`/vehicles${query.size ? `?${query}` : ""}`);
  }
  async function bulkUpdate() {
    if (!selectedCount || mutating) return;
    const field = prompt(`Status field (${statusFields.join(", ")})`);
    if (!field || !statusFields.includes(field as typeof statusFields[number])) return;
    const value = prompt("New status value");
    if (!value) return;
    setMutating(true);
    try { await vehicleApi.bulkUpdate(selected, { [field]: value }); setSelected([]); onChanged(); }
    finally { setMutating(false); }
  }
  async function bulkDelete() {
    if (!selectedCount || mutating || !confirm(`Archive ${selectedCount} selected vehicle${selectedCount === 1 ? "" : "s"}? Historical records will remain available.`)) return;
    setMutating(true);
    try { await vehicleApi.bulkDelete(selected); setSelected([]); onChanged(); }
    finally { setMutating(false); }
  }
  const exportQuery = useMemo(() => { const query = new URLSearchParams(searchParams.toString()); query.delete("page"); return query.toString(); }, [searchParams]);

  return <section className="space-y-4">
    <div className="overflow-hidden rounded-[28px] border border-[#dbe5f2] bg-white shadow-[0_18px_55px_rgba(15,40,86,.08)]">
      <div className="grid gap-3 bg-gradient-to-r from-white via-[#f8fbff] to-[#eef5ff] p-4 sm:p-5 xl:grid-cols-[minmax(320px,1fr)_180px_auto]">
        <label className="relative"><span className="sr-only">Search vehicles</span><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-blue-500">⌕</span><input value={searchValue} onChange={(event)=>setSearchValue(event.target.value)} placeholder="Search vehicle, owner, mobile or chassis…" className="h-14 w-full rounded-2xl border border-[#d7e3f1] bg-white pl-12 pr-20 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"/>{searchValue&&<button type="button" onClick={()=>setSearchValue("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black uppercase text-slate-500">Clear</button>}</label>
        <select value={searchParams.get("fuel_type")??""} onChange={(event)=>updateQuery({fuel_type:event.target.value,page:""})} className="h-14 rounded-2xl border border-[#d7e3f1] bg-white px-4 text-sm font-black text-slate-700 shadow-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"><option value="">All fuel types</option>{["petrol","diesel","cng","lpg","electric","hybrid"].map(value=><option key={value} value={value}>{humanize(value)}</option>)}</select>
        <div className="flex flex-wrap gap-2 xl:justify-end"><ExportButton href={apiUrl(`/vehicles/export${exportQuery?`?${exportQuery}`:""}`)} label="Excel"/><ExportButton href={apiUrl(`/vehicles/export?${exportQuery?`${exportQuery}&`:""}format=pdf`)} label="PDF"/><button type="button" onClick={()=>window.print()} className="rounded-2xl border border-[#d7e3f1] bg-white px-4 py-3 text-xs font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700">Print</button></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-blue-50 bg-[#f8fbff] px-4 py-3 sm:px-5"><div className="flex items-center gap-3"><input aria-label="Select all vehicles" type="checkbox" checked={allSelected} onChange={(event)=>setSelected(event.target.checked?vehicles.map(v=>v.id):[])} className="h-4 w-4 accent-blue-700"/><p className="text-sm font-bold text-slate-600">{selectedCount ? <><span className="text-blue-700">{selectedCount}</span> selected</> : <><span className="text-blue-700">{meta?.total ?? vehicles.length}</span> vehicle{(meta?.total ?? vehicles.length) === 1 ? "" : "s"}</>}{loading&&<span className="ml-2 text-blue-600">Updating…</span>}</p></div><div className="flex gap-2"><button type="button" disabled={!selectedCount||mutating} onClick={bulkUpdate} className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wide text-blue-700 disabled:opacity-35">Bulk Update</button><button type="button" disabled={!selectedCount||mutating} onClick={bulkDelete} className="rounded-xl bg-amber-500 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white shadow-sm disabled:opacity-35">Archive Selected</button></div></div>
    </div>

    <div className="grid gap-4">
      {vehicles.map(vehicle=>{
        const services = applicableServices(vehicle);
        return <article key={vehicle.id} className="group overflow-hidden rounded-[28px] border border-[#dbe5f2] bg-white shadow-[0_14px_40px_rgba(15,40,86,.07)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,40,86,.12)]">
        <div className="grid gap-0 lg:grid-cols-[270px_minmax(0,1fr)_330px]">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#071a3c] via-[#0b2c68] to-[#1556b8] p-5 text-white">
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-cyan-300/10 blur-xl"/><div className="absolute -bottom-14 -left-10 h-36 w-36 rounded-full bg-blue-300/10 blur-2xl"/>
            <div className="relative flex h-full min-h-[185px] flex-col justify-between"><div className="flex items-start justify-between gap-3"><div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/10 text-3xl backdrop-blur">{vehicleIcon(vehicle.vehicle_type)}</div><input aria-label={`Select ${vehicle.vehicle_number}`} type="checkbox" checked={selected.includes(vehicle.id)} onChange={(event)=>setSelected(current=>event.target.checked?[...current,vehicle.id]:current.filter(id=>id!==vehicle.id))} className="h-4 w-4 accent-cyan-300"/></div><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-cyan-300">Vehicle profile</p><Link href={`/vehicles/${vehicle.id}`} className="mt-1 block text-2xl font-black tracking-tight hover:text-cyan-200">{vehicle.vehicle_number}</Link><p className="mt-2 text-xs font-semibold text-blue-100/80">{vehicle.registration_authority||"RTO not added"}</p></div></div>
          </div>

          <div className="p-5 sm:p-6"><div className="grid gap-5 xl:grid-cols-2"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-blue-500">Owner</p><h3 className="mt-1 truncate text-xl font-black text-[#0b1f44]">{ownerName(vehicle)}</h3>{vehicle.customer?.mobile?<a className="mt-1 inline-block text-sm font-bold text-blue-600 hover:underline" href={`tel:${vehicle.customer.mobile}`}>{vehicle.customer.mobile}</a>:<p className="mt-1 text-sm text-slate-400">Mobile not added</p>}</div><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-blue-500">Vehicle</p><p className="mt-1 text-base font-black text-slate-900">{humanize(vehicle.vehicle_type)}</p><p className="mt-1 text-sm font-semibold text-slate-500">{[vehicle.manufacturer,vehicle.model].filter(Boolean).join(" · ")||"Make/model not added"}</p></div></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3"><MiniFact label="Fuel" value={humanize(vehicle.fuel_type)}/><MiniFact label="Class" value={humanize(vehicle.vehicle_class)}/><MiniFact label="Category" value={humanize(vehicle.vehicle_category)}/></div></div>

          <div className="border-t border-slate-100 bg-[#f8fbff] p-5 lg:border-l lg:border-t-0"><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-blue-500">Compliance</p><p className="mt-1 text-sm font-black text-slate-800">Current service status</p></div><span className="rounded-full bg-white px-3 py-1 text-[9px] font-black uppercase text-slate-400 shadow-sm">Live</span></div><div className="mt-4 grid grid-cols-2 gap-2"><ServiceChip label="Insurance" value={vehicle.insurance_status}/><ServiceChip label="PUC" value={vehicle.puc_status}/>{services.fitness&&<ServiceChip label="Fitness" value={vehicle.fitness_status}/>} {services.permit&&<ServiceChip label="Permit" value={vehicle.permit_status}/>} {services.tax&&<ServiceChip label="Tax" value={vehicle.tax_status}/>}</div><div className="mt-5 grid grid-cols-2 gap-2"><RowLink href={`/vehicles/${vehicle.id}`} label="Open Vehicle" primary/><RowLink href={`/vehicles/${vehicle.id}/edit`} label="Edit"/><RowLink href={`/vehicles/${vehicle.id}/insurance`} label="Insurance"/><RowLink href={`/vehicles/${vehicle.id}/timeline`} label="Timeline"/></div></div>
        </div>
      </article>})}
    </div>
    <Pagination meta={meta} onPage={(page)=>updateQuery({page:String(page)})}/>
  </section>;
}

function applicableServices(vehicle: Vehicle){
  const text=[vehicle.vehicle_type,vehicle.vehicle_class,vehicle.vehicle_category,vehicle.manufacturer,vehicle.model].filter(Boolean).join(" ").toUpperCase();
  const twoWheeler=/TWO.?WHEEL|2W|2WN|M.?CYCLE|MOTOR.?CYCLE|SCOOTER|SCOOTY|BIKE/.test(text);
  const privateCar=/PRIVATE|MOTOR.?CAR|LMV.?NT|NON[- ]?TRANSPORT|HATCHBACK|SEDAN|SUV/.test(text)&&!/TAXI|CAB|PASSENGER|LPV|PSV/.test(text);
  const pickup=/\bLGV\b|\bLCV\b|PICK.?UP|PICKUP|BOLERO.?PICKUP|GOODS.?CARRIER.?LGV/.test(text)&&!/\bHGV\b|\bHGVT\b|HEAVY/.test(text);
  const passengerCommercial=/\bLPV\b|TAXI|CAB|PASSENGER|PSV|MAXI|BUS/.test(text);
  const explicitHeavy=/\bHGV\b|\bHGVT\b|\bGT\b|HEAVY|TRUCK|LORRY|TIPPER|DUMPER|TRAILER/.test(text);
  const weight=Number(vehicle.gross_weight??0);
  const heavyCommercial=!pickup&&!twoWheeler&&!privateCar&&(explicitHeavy||weight>3500);
  const fullCommercial=passengerCommercial||heavyCommercial;
  return {
    fitness: pickup||fullCommercial,
    permit: fullCommercial&&!pickup&&!twoWheeler&&!privateCar,
    tax: fullCommercial,
  };
}

function humanize(value?:string){return value?value.replaceAll("_"," ").replace(/\b\w/g,char=>char.toUpperCase()):"Not Added"}
function ownerName(vehicle:Vehicle){return [vehicle.customer?.first_name,vehicle.customer?.middle_name,vehicle.customer?.last_name].filter(Boolean).join(" ")||"Owner not added"}
function vehicleIcon(type?:string){const v=(type??"").toLowerCase();if(v.includes("two"))return "🏍";if(v.includes("hgv")||v.includes("truck"))return "🚚";if(v.includes("lgv")||v.includes("pickup"))return "🛻";if(v.includes("taxi"))return "🚕";return "🚘"}
function tone(value?:string){const key=(value??"not_added").toLowerCase();if(["active","valid","completed","renewed","added"].includes(key))return "bg-emerald-50 text-emerald-700 ring-emerald-200";if(["due","expiring","expiring_soon","pending","in_progress"].includes(key))return "bg-amber-50 text-amber-800 ring-amber-200";if(["expired","missing","cancelled","critical"].includes(key))return "bg-rose-50 text-rose-700 ring-rose-200";return "bg-slate-100 text-slate-600 ring-slate-200"}
function ServiceChip({value,label}:{value?:string;label:string}){return <div className={`rounded-2xl px-3 py-3 ring-1 ring-inset ${tone(value)}`}><p className="text-[9px] font-black uppercase tracking-wide opacity-70">{label}</p><p className="mt-1 text-xs font-black">{humanize(value)}</p></div>}
function MiniFact({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3"><p className="text-[8px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 truncate text-sm font-black text-slate-800">{value}</p></div>}
function RowLink({href,label,primary=false}:{href:string;label:string;primary?:boolean}){return <Link href={href} className={`rounded-2xl px-3 py-2.5 text-center text-[10px] font-black transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${primary?"bg-gradient-to-r from-[#0b2f6b] to-[#1f64d6] text-white shadow-[0_8px_22px_rgba(31,100,214,.24)] hover:-translate-y-0.5":"border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700"}`}>{label}</Link>}
function ExportButton({href,label}:{href:string;label:string}){return <a className="rounded-2xl border border-[#d7e3f1] bg-white px-4 py-3 text-xs font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700" href={href}>{label}</a>}
function Pagination({meta,onPage}:{meta?:VehiclePagination;onPage:(page:number)=>void}){if(!meta||meta.last_page<=1)return <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm font-semibold text-slate-500">Showing {meta?.total??0} vehicles</div>;const button="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black hover:border-blue-300 disabled:opacity-40";return <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 text-sm"><span className="font-semibold text-slate-500">Page {meta.current_page} of {meta.last_page} · {meta.total} vehicles</span><div className="flex gap-2"><button disabled={meta.current_page<=1} onClick={()=>onPage(meta.current_page-1)} className={button}>Previous</button><button disabled={meta.current_page>=meta.last_page} onClick={()=>onPage(meta.current_page+1)} className={button}>Next</button></div></div>}
