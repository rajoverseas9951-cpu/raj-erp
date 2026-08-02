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
  function sort(field: string) {
    const current = searchParams.get("sort");
    updateQuery({ sort: field, direction: current === field && searchParams.get("direction") === "asc" ? "desc" : "asc", page: "" });
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
    if (!selectedCount || mutating || !confirm(`Delete ${selectedCount} selected vehicle${selectedCount === 1 ? "" : "s"}?`)) return;
    setMutating(true);
    try { await vehicleApi.bulkDelete(selected); setSelected([]); onChanged(); }
    finally { setMutating(false); }
  }
  const exportQuery = useMemo(() => {
    const query = new URLSearchParams(searchParams.toString()); query.delete("page");
    return query.toString();
  }, [searchParams]);

  return <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_-42px_rgba(15,23,42,.5)]">
    <div className="space-y-4 border-b border-slate-100 p-4 sm:p-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_180px_auto]">
        <label className="relative"><span className="sr-only">Search vehicles</span><input value={searchValue} onChange={(event)=>setSearchValue(event.target.value)} placeholder="Search vehicle, owner, mobile or chassis…" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-20 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"/>{searchValue&&<button type="button" onClick={()=>setSearchValue("")} className="absolute right-2 top-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">Clear</button>}</label>
        <label><span className="sr-only">Filter by fuel</span><select value={searchParams.get("fuel_type")??""} onChange={(event)=>updateQuery({fuel_type:event.target.value,page:""})} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"><option value="">All fuel types</option>{["petrol","diesel","cng","lpg","electric","hybrid"].map(value=><option key={value} value={value}>{humanize(value)}</option>)}</select></label>
        <div className="flex flex-wrap gap-2 lg:justify-end"><a className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold hover:border-blue-300 hover:text-blue-700" href={apiUrl(`/vehicles/export${exportQuery?`?${exportQuery}`:""}`)}>Excel</a><a className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold hover:border-blue-300 hover:text-blue-700" href={apiUrl(`/vehicles/export?${exportQuery?`${exportQuery}&`:""}format=pdf`)}>PDF</a><button type="button" onClick={()=>window.print()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold hover:border-blue-300 hover:text-blue-700">Print</button></div>
      </div>
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
        <p className="text-sm font-semibold text-slate-600">{selectedCount ? `${selectedCount} selected` : `${meta?.total ?? vehicles.length} vehicle${(meta?.total ?? vehicles.length) === 1 ? "" : "s"}`}{loading&&<span className="ml-2 text-blue-600">Updating…</span>}</p>
        <div className="flex gap-2"><button type="button" disabled={!selectedCount||mutating} onClick={bulkUpdate} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40">Bulk Update</button><button type="button" disabled={!selectedCount||mutating} onClick={bulkDelete} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Bulk Delete</button></div>
      </div>
    </div>

    <div className="hidden max-h-[68vh] overflow-auto md:block">
      <table className="w-full table-fixed text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-950 text-xs uppercase tracking-wide text-slate-300"><tr><th className="w-12 p-4"><input aria-label="Select all vehicles" type="checkbox" checked={allSelected} onChange={(event)=>setSelected(event.target.checked?vehicles.map(v=>v.id):[])}/></th><SortHead width="w-[16%]" label="Vehicle" field="vehicle_number" onSort={sort}/><SortHead width="w-[19%]" label="Owner" field="owner_name" onSort={sort}/><SortHead width="w-[18%]" label="Vehicle details" field="vehicle_type" onSort={sort}/><SortHead width="w-[12%]" label="Fuel" field="fuel_type" onSort={sort}/><th className="w-[21%] p-4">Compliance</th><th className="w-[14%] p-4 text-right">Actions</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{vehicles.map(vehicle=><tr key={vehicle.id} className="align-top transition hover:bg-blue-50/40"><td className="p-4"><input aria-label={`Select ${vehicle.vehicle_number}`} type="checkbox" checked={selected.includes(vehicle.id)} onChange={(event)=>setSelected(current=>event.target.checked?[...current,vehicle.id]:current.filter(id=>id!==vehicle.id))}/></td><td className="p-4"><Link href={`/vehicles/${vehicle.id}`} className="font-black tracking-wide text-blue-700 hover:underline">{vehicle.vehicle_number}</Link><p className="mt-1 truncate text-xs text-slate-400">{vehicle.registration_authority||"Registration authority not added"}</p></td><td className="p-4"><p className="truncate font-bold text-slate-900">{ownerName(vehicle)}</p>{vehicle.customer?.mobile?<a className="mt-1 block text-xs text-blue-600 hover:underline" href={`tel:${vehicle.customer.mobile}`}>{vehicle.customer.mobile}</a>:<p className="mt-1 text-xs text-slate-400">Mobile not added</p>}</td><td className="p-4"><p className="font-semibold">{humanize(vehicle.vehicle_type)}</p><p className="mt-1 truncate text-xs text-slate-500">{[vehicle.manufacturer,vehicle.model].filter(Boolean).join(" · ")||"Make/model not added"}</p></td><td className="p-4"><StatusBadge value={vehicle.fuel_type}/></td><td className="p-4"><div className="flex flex-wrap gap-1.5"><StatusBadge label="Insurance" value={vehicle.insurance_status}/><StatusBadge label="PUC" value={vehicle.puc_status}/><StatusBadge label="Fitness" value={vehicle.fitness_status}/><StatusBadge label="Permit" value={vehicle.permit_status}/><StatusBadge label="Tax" value={vehicle.tax_status}/></div></td><td className="p-4"><div className="flex flex-wrap justify-end gap-2"><RowLink href={`/vehicles/${vehicle.id}`} label="View"/><RowLink href={`/vehicles/${vehicle.id}/edit`} label="Edit"/><RowLink href={`/vehicles/${vehicle.id}/insurance`} label="Insurance"/><RowLink href={`/vehicles/${vehicle.id}/timeline`} label="Timeline"/></div></td></tr>)}</tbody></table>
    </div>

    <div className="grid gap-3 p-4 md:hidden">{vehicles.map(vehicle=><article key={vehicle.id} className="rounded-2xl border border-slate-200 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><Link href={`/vehicles/${vehicle.id}`} className="text-lg font-black tracking-wide text-blue-700">{vehicle.vehicle_number}</Link><p className="mt-1 font-semibold">{ownerName(vehicle)}</p>{vehicle.customer?.mobile&&<a href={`tel:${vehicle.customer.mobile}`} className="text-sm text-blue-600">{vehicle.customer.mobile}</a>}</div><input aria-label={`Select ${vehicle.vehicle_number}`} type="checkbox" checked={selected.includes(vehicle.id)} onChange={(event)=>setSelected(current=>event.target.checked?[...current,vehicle.id]:current.filter(id=>id!==vehicle.id))}/></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><MobileDetail label="Type" value={humanize(vehicle.vehicle_type)}/><MobileDetail label="Make / Model" value={[vehicle.manufacturer,vehicle.model].filter(Boolean).join(" · ")||"Not Added"}/><MobileDetail label="Fuel" value={humanize(vehicle.fuel_type)}/><div><dt className="text-xs text-slate-400">Insurance</dt><dd className="mt-1"><StatusBadge value={vehicle.insurance_status}/></dd></div></dl><div className="mt-4 flex flex-wrap gap-1.5"><StatusBadge label="PUC" value={vehicle.puc_status}/><StatusBadge label="Fitness" value={vehicle.fitness_status}/><StatusBadge label="Permit" value={vehicle.permit_status}/><StatusBadge label="Tax" value={vehicle.tax_status}/></div><div className="mt-4 grid grid-cols-2 gap-2"><RowLink href={`/vehicles/${vehicle.id}`} label="View"/><RowLink href={`/vehicles/${vehicle.id}/edit`} label="Edit"/></div></article>)}</div>
    <Pagination meta={meta} onPage={(page)=>updateQuery({page:String(page)})}/>
  </section>;
}

function humanize(value?:string){return value?value.replaceAll("_"," ").replace(/\b\w/g,char=>char.toUpperCase()):"Not Added"}
function ownerName(vehicle:Vehicle){return [vehicle.customer?.first_name,vehicle.customer?.middle_name,vehicle.customer?.last_name].filter(Boolean).join(" ")||"Owner not added"}
function tone(value?:string){const key=(value??"not_added").toLowerCase();if(["active","valid","completed","renewed"].includes(key))return "bg-emerald-50 text-emerald-700 ring-emerald-200";if(["due","expiring","pending","in_progress"].includes(key))return "bg-amber-50 text-amber-700 ring-amber-200";if(["expired","missing","cancelled","critical"].includes(key))return "bg-rose-50 text-rose-700 ring-rose-200";return "bg-slate-100 text-slate-600 ring-slate-200"}
function StatusBadge({value,label}:{value?:string;label?:string}){return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ring-1 ring-inset ${tone(value)}`}>{label&&`${label}: `}{humanize(value)}</span>}
function RowLink({href,label}:{href:string;label:string}){return <Link href={href} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-center text-xs font-bold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">{label}</Link>}
function SortHead({label,field,width,onSort}:{label:string;field:string;width:string;onSort:(field:string)=>void}){return <th className={`${width} p-4`}><button type="button" onClick={()=>onSort(field)} className="whitespace-nowrap text-left focus:outline-none focus:ring-2 focus:ring-blue-400">{label} ↕</button></th>}
function MobileDetail({label,value}:{label:string;value:string}){return <div><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>}
function Pagination({meta,onPage}:{meta?:VehiclePagination;onPage:(page:number)=>void}){if(!meta||meta.last_page<=1)return <div className="border-t p-4 text-sm text-slate-500">Showing {meta?.total??0} vehicles</div>;const button="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold hover:border-blue-300 disabled:opacity-40";return <div className="flex items-center justify-between border-t p-4 text-sm"><span>Page {meta.current_page} of {meta.last_page} · {meta.total} vehicles</span><div className="flex gap-2"><button disabled={meta.current_page<=1} onClick={()=>onPage(meta.current_page-1)} className={button}>Previous</button><button disabled={meta.current_page>=meta.last_page} onClick={()=>onPage(meta.current_page+1)} className={button}>Next</button></div></div>}
