"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { authenticatedRequest } from "@/lib/api-client";

type Claim = {
  id: string; insurance_line: string; business_channel: "retail" | "wholesale"; policy_number?: string | null;
  insurance_company?: string | null; customer_name: string; customer_mobile?: string | null; registration_number?: string | null;
  claim_type: string; claim_number?: string | null; loss_date?: string | null; loss_time?: string | null; loss_place?: string | null;
  intimation_date?: string | null; status: string; surveyor_name?: string | null; garage_name?: string | null;
  estimated_loss: number; approved_amount: number; settlement_amount: number; next_follow_up_at?: string | null;
  form_data?: Record<string, string>; remarks?: string | null; created_at: string;
};

type ClaimResponse = Claim[];

const statuses = [
  "intimated","documents_pending","surveyor_assigned","survey_done","approval_pending","approved",
  "repair_in_progress","invoice_submitted","settlement_pending","settled","closed","rejected",
] as const;

const stages = [
  ["Intimation", "intimated"], ["Documents", "documents_pending"], ["Surveyor", "surveyor_assigned"],
  ["Survey", "survey_done"], ["Approval", "approval_pending"], ["Repair", "repair_in_progress"],
  ["Invoice", "invoice_submitted"], ["Settlement", "settlement_pending"], ["Closed", "closed"],
] as const;

const money = (n = 0) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n || 0));
const label = (s: string) => s.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("open");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Claim | null>(null);

  const load = async () => {
    setLoading(true); setError("");
    try { setClaims(await authenticatedRequest<ClaimResponse>("/claims")); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load claims."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => claims.filter((c) => {
    const open = !["settled","closed","rejected"].includes(c.status);
    if (status === "open" && !open) return false;
    if (status !== "all" && status !== "open" && c.status !== status) return false;
    const hay = `${c.customer_name} ${c.customer_mobile ?? ""} ${c.policy_number ?? ""} ${c.claim_number ?? ""} ${c.registration_number ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }), [claims, q, status]);

  const openCount = claims.filter((c) => !["settled","closed","rejected"].includes(c.status)).length;
  const followUps = claims.filter((c) => c.next_follow_up_at && new Date(c.next_follow_up_at) <= new Date() && !["settled","closed","rejected"].includes(c.status)).length;
  const settled = claims.reduce((s, c) => s + Number(c.settlement_amount || 0), 0);

  return <main className="min-h-screen bg-[#f4f7fb] p-4 text-slate-900 md:p-6 dark:bg-[#070b14] dark:text-white">
    <div className="mx-auto max-w-[1540px] space-y-5">
      <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#07182f] via-[#0c3270] to-[#246ce4] p-6 text-white shadow-[0_26px_70px_-34px_rgba(22,76,180,.55)] md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200">Claims Operating System</p><h1 className="mt-2 text-4xl font-black tracking-[-.04em] md:text-5xl">Claim se closure tak, one guided flow.</h1><p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-blue-100/75">Employee ko guess nahi karna padega. Intimation, documents, surveyor, approval, repair, invoice, settlement aur closure ek hi case timeline me.</p></div>
          <button onClick={() => setCreating(true)} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#12356e] shadow-xl">+ New claim</button>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-3"><Stat label="Open claims" value={String(openCount)} /><Stat label="Follow-up due" value={String(followUps)} warn /><Stat label="Settled value" value={money(settled)} /></div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[.04]">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row dark:border-white/10">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search claim no, policy, customer, mobile, vehicle…" className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/[.05]" />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold dark:border-white/10 dark:bg-[#111827]"><option value="open">Open claims</option><option value="all">All claims</option>{statuses.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
          </div>
          {error && <div className="m-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
          <div className="divide-y divide-slate-100 dark:divide-white/10">
            {loading ? <div className="p-8 text-sm text-slate-500">Loading claims…</div> : filtered.length ? filtered.map((c) => <button key={c.id} onClick={() => setSelected(c)} className="grid w-full gap-3 p-4 text-left transition hover:bg-blue-50/40 md:grid-cols-[1.4fr_.8fr_.7fr_.7fr_auto] md:items-center dark:hover:bg-white/[.04]">
              <div><p className="text-sm font-black text-slate-900 dark:text-white">{c.customer_name}</p><p className="mt-1 text-[11px] text-slate-500">{c.registration_number || c.policy_number || "Policy details pending"} · {c.insurance_company || label(c.insurance_line)}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Claim no.</p><p className="mt-1 text-xs font-bold">{c.claim_number || "Not received"}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</p><span className="mt-1 inline-block rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">{label(c.status)}</span></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Follow-up</p><p className="mt-1 text-xs font-bold">{c.next_follow_up_at ? new Date(c.next_follow_up_at).toLocaleDateString("en-IN") : "Not set"}</p></div>
              <span className="text-xl text-blue-600">›</span>
            </button>) : <div className="p-10 text-center text-sm text-slate-500">No claims found.</div>}
          </div>
        </div>

        <aside className="self-start rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[.04]">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">Employee playbook</p><h2 className="mt-2 text-2xl font-black">Har claim me yahi flow.</h2>
          <div className="mt-5 space-y-2">{stages.map(([name], i) => <div key={name} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/[.04]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#102c57] text-[10px] font-black text-white">{i + 1}</span><span className="text-xs font-bold">{name}</span></div>)}</div>
          <p className="mt-4 text-[11px] leading-5 text-slate-500">Claim form ko ERP me fill karo, print/PDF nikalo, sign lo, phir company/surveyor communication case timeline me note karo.</p>
        </aside>
      </section>
    </div>

    {creating && <ClaimModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void load(); }} />}
    {selected && <ClaimDrawer claim={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); void load(); }} />}
  </main>;
}

function Stat({ label: l, value, warn = false }: { label: string; value: string; warn?: boolean }) { return <div className="rounded-2xl border border-white/10 bg-white/[.08] p-4"><p className="text-[9px] font-black uppercase tracking-[.16em] text-white/45">{l}</p><p className={`mt-2 text-2xl font-black ${warn ? "text-amber-300" : "text-white"}`}>{value}</p></div>; }

function ClaimModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setErr(""); const f = new FormData(e.currentTarget);
    const formData = { driver_name: String(f.get("driver_name") || ""), driver_licence: String(f.get("driver_licence") || ""), accident_description: String(f.get("accident_description") || ""), third_party_details: String(f.get("third_party_details") || ""), police_station: String(f.get("police_station") || ""), fir_number: String(f.get("fir_number") || "") };
    const body = Object.fromEntries(f.entries()); delete body.driver_name; delete body.driver_licence; delete body.accident_description; delete body.third_party_details; delete body.police_station; delete body.fir_number;
    try { await authenticatedRequest("/claims", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, form_data: formData }) }); onSaved(); }
    catch (x) { setErr(x instanceof Error ? x.message : "Unable to save claim."); } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-3 backdrop-blur-sm"><div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[28px] bg-white shadow-2xl dark:bg-[#101722]">
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-[#101722]/95"><div><p className="text-[9px] font-black uppercase tracking-[.17em] text-blue-600">New claim intimation</p><h2 className="mt-1 text-2xl font-black">Fill once. Follow the case till closure.</h2></div><button onClick={onClose} className="rounded-xl bg-slate-100 px-3 py-2 font-black dark:bg-white/10">×</button></div>
    <form onSubmit={submit} className="p-5">
      {err && <div className="mb-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{err}</div>}
      <Section title="Policy & customer"><Grid><Field name="customer_name" label="Customer name" required/><Field name="customer_mobile" label="Mobile"/><Field name="policy_number" label="Policy number"/><Field name="insurance_company" label="Insurance company"/><Field name="registration_number" label="Vehicle number"/><Select name="insurance_line" label="Insurance line" options={["motor","health","life","non_motor"]}/><Select name="business_channel" label="Business channel" options={["retail","wholesale"]}/><Select name="claim_type" label="Claim type" options={["own_damage","third_party","theft","total_loss","health","life","property","other"]}/></Grid></Section>
      <Section title="Accident / loss details"><Grid><Field name="loss_date" label="Loss date" type="date"/><Field name="loss_time" label="Loss time" type="time"/><Field name="loss_place" label="Loss place"/><Field name="intimation_date" label="Intimation date" type="date"/><Field name="driver_name" label="Driver name"/><Field name="driver_licence" label="Driving licence"/><Field name="police_station" label="Police station"/><Field name="fir_number" label="FIR / GD number"/></Grid><Area name="accident_description" label="How accident / loss happened"/><Area name="third_party_details" label="Third-party details, if any"/></Section>
      <Section title="Survey, garage & follow-up"><Grid><Field name="claim_number" label="Claim number"/><Field name="surveyor_name" label="Surveyor name"/><Field name="surveyor_mobile" label="Surveyor mobile"/><Field name="garage_name" label="Garage / hospital / service provider"/><Field name="garage_mobile" label="Contact number"/><Field name="estimated_loss" label="Estimated loss" type="number"/><Field name="next_follow_up_at" label="Next follow-up" type="datetime-local"/><Select name="status" label="Current status" options={statuses as unknown as string[]}/></Grid><Area name="remarks" label="Internal remarks"/></Section>
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-black dark:border-white/10">Cancel</button><button disabled={saving} className="rounded-xl bg-[#1768ff] px-6 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Create claim"}</button></div>
    </form>
  </div></div>;
}

function ClaimDrawer({ claim, onClose, onSaved }: { claim: Claim; onClose: () => void; onSaved: () => void }) {
  const [note, setNote] = useState(""); const [status, setStatus] = useState(claim.status); const [follow, setFollow] = useState(claim.next_follow_up_at?.slice(0,16) || ""); const [saving, setSaving] = useState(false);
  const progress = Math.max(0, stages.findIndex(([, s]) => s === claim.status));
  const printForm = () => window.print();
  async function save() { if (!note.trim()) return; setSaving(true); try { await authenticatedRequest(`/claims/${claim.id}/updates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note, status, follow_up_at: follow || null }) }); onSaved(); } finally { setSaving(false); } }
  return <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm"><div className="ml-auto h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl dark:bg-[#0d1420]">
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 p-5 backdrop-blur dark:border-white/10 dark:bg-[#0d1420]/95"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-blue-600">Claim case</p><h2 className="mt-1 text-2xl font-black">{claim.customer_name}</h2><p className="mt-1 text-xs text-slate-500">{claim.claim_number || "Claim number pending"} · {claim.registration_number || claim.policy_number || label(claim.insurance_line)}</p></div><button onClick={onClose} className="rounded-xl bg-slate-100 px-3 py-2 text-lg font-black dark:bg-white/10">×</button></div>
    <div className="space-y-5 p-5">
      <div className="overflow-x-auto"><div className="flex min-w-[760px] items-center gap-1">{stages.map(([name], i) => <div key={name} className="flex-1"><div className={`h-2 rounded-full ${i <= progress ? "bg-blue-600" : "bg-slate-200 dark:bg-white/10"}`}/><p className={`mt-2 text-[8px] font-black uppercase ${i <= progress ? "text-blue-700 dark:text-blue-300" : "text-slate-400"}`}>{name}</p></div>)}</div></div>
      <div className="grid gap-3 sm:grid-cols-3"><Info l="Policy" v={claim.policy_number || "—"}/><Info l="Company" v={claim.insurance_company || "—"}/><Info l="Channel" v={label(claim.business_channel)}/><Info l="Loss date" v={claim.loss_date || "—"}/><Info l="Surveyor" v={claim.surveyor_name || "Not assigned"}/><Info l="Garage" v={claim.garage_name || "Not assigned"}/></div>
      <div className="rounded-[22px] border border-slate-200 p-4 dark:border-white/10"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-violet-600">Fillable claim form</p><h3 className="mt-1 text-lg font-black">Ready for print / signature</h3></div><button onClick={printForm} className="rounded-xl bg-[#102c57] px-4 py-2 text-xs font-black text-white">Print form</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{Object.entries(claim.form_data || {}).map(([k,v]) => <Info key={k} l={label(k)} v={v || "—"}/>)}</div></div>
      <div className="rounded-[22px] bg-[#0d2b55] p-4 text-white"><p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-300">Financial snapshot</p><div className="mt-3 grid grid-cols-3 gap-3"><Money l="Estimated" v={claim.estimated_loss}/><Money l="Approved" v={claim.approved_amount}/><Money l="Settled" v={claim.settlement_amount}/></div></div>
      <div className="rounded-[22px] border border-slate-200 p-4 dark:border-white/10"><h3 className="font-black">Add follow-up update</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><select value={status} onChange={(e)=>setStatus(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm dark:border-white/10 dark:bg-[#111827]">{statuses.map(s=><option key={s} value={s}>{label(s)}</option>)}</select><input type="datetime-local" value={follow} onChange={(e)=>setFollow(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm dark:border-white/10 dark:bg-[#111827]"/></div><textarea value={note} onChange={(e)=>setNote(e.target.value)} placeholder="What happened? Company / surveyor / garage update…" className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10 dark:bg-[#111827]"/><button onClick={save} disabled={saving || !note.trim()} className="mt-3 rounded-xl bg-[#1768ff] px-5 py-2.5 text-sm font-black text-white disabled:opacity-40">Save update</button></div>
    </div>
  </div></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mb-6 rounded-[22px] border border-slate-200 p-4 dark:border-white/10"><h3 className="mb-4 text-sm font-black text-[#173861] dark:text-blue-200">{title}</h3>{children}</section>; }
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>; }
function Field({ name, label: l, type="text", required=false }: { name:string; label:string; type?:string; required?:boolean }) { return <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{l}<input name={name} type={type} required={required} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/[.05]"/></label>; }
function Select({ name, label: l, options }: { name:string; label:string; options:string[] }) { return <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{l}<select name={name} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-[#111827]">{options.map(o=><option key={o} value={o}>{label(o)}</option>)}</select></label>; }
function Area({ name, label: l }: { name:string; label:string }) { return <label className="mt-3 block text-[10px] font-bold text-slate-600 dark:text-slate-300">{l}<textarea name={name} className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/[.05]"/></label>; }
function Info({ l, v }: { l:string; v:string }) { return <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/[.04]"><p className="text-[8px] font-black uppercase tracking-wider text-slate-400">{l}</p><p className="mt-1 text-xs font-bold break-words">{v}</p></div>; }
function Money({ l, v }: { l:string; v:number }) { return <div><p className="text-[8px] font-black uppercase tracking-wider text-white/45">{l}</p><p className="mt-1 text-sm font-black">{money(v)}</p></div>; }
