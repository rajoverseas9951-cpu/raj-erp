"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { VehicleMaster, VehicleMasterType, vehicleMasterApi } from "@/lib/vehicle-masters";

const labels: Record<VehicleMasterType, string> = {
  manufacturers: "Vehicle Makes / Manufacturers",
  models: "Vehicle Models",
  variants: "Vehicle Variants",
  colours: "Vehicle Colours",
  vehicle_types: "Vehicle Types",
  vehicle_classes: "Vehicle Classes",
  body_types: "Body Types / Categories",
  fuel_types: "Fuel Types",
  rto_offices: "RTO Offices",
};

export function VehicleMasterPage({ type }: { type: VehicleMasterType }) {
  const [rows, setRows] = useState<VehicleMaster[]>([]);
  const [parents, setParents] = useState<VehicleMaster[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<VehicleMaster>();
  const [viewing, setViewing] = useState<VehicleMaster>();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const parentType: VehicleMasterType | undefined = type === "models" ? "manufacturers" : type === "variants" ? "models" : undefined;
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [result, parentRows] = await Promise.all([
        vehicleMasterApi.page(type, page, search),
        parentType ? vehicleMasterApi.list(parentType) : Promise.resolve([]),
      ]);
      setRows(result.data);
      setPages(Math.max(1, result.last_page));
      setTotal(result.total);
      setParents(parentRows.filter((row) => row.status === "active"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Masters could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [page, parentType, search, type]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, type]);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("add") === "1") { setEditing(undefined); setOpen(true); }
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) { setOpen(false); setViewing(undefined); } };
    addEventListener("keydown", close);
    return () => removeEventListener("keydown", close);
  }, [saving]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const body = {
      name: data.get("name"), code: data.get("code"), notes: data.get("notes"),
      parent_id: parentType ? data.get("parent_id") : null,
      status: editing?.status ?? "active",
    };
    try {
      if (editing) await vehicleMasterApi.update(type, editing.id, body);
      else await vehicleMasterApi.create(type, body);
      setOpen(false);
      setEditing(undefined);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Master could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: VehicleMaster) {
    if (!confirm(`Delete ${row.name}? This is allowed only when it is not in use.`)) return;
    setError("");
    try { await vehicleMasterApi.remove(type, row.id); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Master could not be deleted."); }
  }

  return <main className="space-y-5 p-4 md:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-blue-700">Masters / Vehicle Masters</p><h1 className="text-3xl font-black">{labels[type]}</h1><p className="text-sm text-slate-500">{total} records</p></div><button onClick={() => { setEditing(undefined); setOpen(true); }} className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">+ Add</button></header>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${labels[type].toLowerCase()}`} className="w-full rounded-xl border bg-white px-4 py-3" />
    <section className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50"><tr>{["Name", "Code", ...(parentType ? [parentType === "manufacturers" ? "Manufacturer" : "Model"] : []), "Status", "Actions"].map((heading) => <th className="p-4" key={heading}>{heading}</th>)}</tr></thead><tbody>
      {loading && <tr><td className="p-8 text-center text-slate-500" colSpan={parentType ? 5 : 4}>Loading...</td></tr>}
      {!loading && !rows.length && <tr><td className="p-8 text-center text-slate-500" colSpan={parentType ? 5 : 4}>No records found.</td></tr>}
      {rows.map((row) => <tr className="border-t" key={row.id}><td className="p-4 font-bold">{row.name}</td><td>{row.code || "—"}</td>{parentType && <td>{row.parent_name || "—"}</td>}<td><span className={`rounded-full px-3 py-1 font-semibold ${row.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{row.status === "active" ? "Active" : "Inactive"}</span></td><td><div className="flex flex-wrap gap-2"><button onClick={() => setViewing(row)} className="rounded-lg border px-3 py-2">View</button><button onClick={() => { setEditing(row); setOpen(true); }} className="rounded-lg border px-3 py-2">Edit</button><button onClick={() => void vehicleMasterApi.update(type, row.id, { status: row.status === "active" ? "inactive" : "active" }).then(load).catch((caught) => setError(caught instanceof Error ? caught.message : "Status update failed."))} className="rounded-lg border px-3 py-2">{row.status === "active" ? "Deactivate" : "Activate"}</button><button onClick={() => void remove(row)} className="rounded-lg border border-red-200 px-3 py-2 text-red-700">Delete</button></div></td></tr>)}
    </tbody></table></section>
    <div className="flex items-center justify-between"><button disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Previous</button><span className="text-sm text-slate-500">Page {page} of {pages}</span><button disabled={page >= pages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Next</button></div>
    {open && <Modal title={`${editing ? "Edit" : "Add"} ${labels[type]}`} saving={saving} close={() => setOpen(false)}><form onSubmit={save} className="grid gap-4 md:grid-cols-2"><Field name="name" label="Name" defaultValue={editing?.name} required /><Field name="code" label="Code" defaultValue={editing?.code} />{parentType && <label className="text-sm font-semibold">{parentType === "manufacturers" ? "Manufacturer" : "Model"}<select name="parent_id" required defaultValue={editing?.parent_id ?? ""} className="mt-2 w-full rounded-xl border bg-white px-4 py-3"><option value="">Select</option>{parents.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}<Field name="notes" label="Notes" defaultValue={editing?.notes} /><div className="flex justify-end gap-2 md:col-span-2"><button type="button" disabled={saving} onClick={() => setOpen(false)} className="rounded-xl border px-5 py-3">Cancel</button><button disabled={saving} className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">{saving ? "Saving..." : "Save"}</button></div></form></Modal>}
    {viewing && <Modal title={viewing.name} saving={false} close={() => setViewing(undefined)}><dl className="grid gap-3 md:grid-cols-2">{Object.entries(viewing).filter(([key]) => !["id", "type"].includes(key)).map(([key, value]) => <div key={key} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-400">{key.replaceAll("_", " ")}</dt><dd className="font-semibold">{String(value ?? "—")}</dd></div>)}</dl></Modal>}
  </main>;
}

function Modal({ title, children, close, saving }: { title: string; children: React.ReactNode; close: () => void; saving: boolean }) { return <div onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) close(); }} className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4"><section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex justify-between"><h2 className="text-xl font-black">{title}</h2><button type="button" disabled={saving} onClick={close} aria-label="Close">×</button></div>{children}</section></div>; }
function Field({ name, label, defaultValue = "", required = false }: { name: string; label: string; defaultValue?: string; required?: boolean }) { return <label className="text-sm font-semibold">{label}<input name={name} required={required} defaultValue={defaultValue} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>; }
