"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authenticatedRequest } from "@/lib/api-client";

type Claim = {
  id: string;
  policy_id?: string | null;
  vehicle_id?: string | null;
  insurance_line: string;
  policy_number?: string | null;
  insurance_company?: string | null;
  customer_name: string;
  customer_mobile?: string | null;
  registration_number?: string | null;
  claim_type: string;
  claim_number?: string | null;
  loss_date?: string | null;
  loss_time?: string | null;
  loss_place?: string | null;
  intimation_date?: string | null;
  estimated_loss?: number;
  form_data?: Record<string, string>;
};

type FormState = {
  insured_name: string;
  policy_number: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  registration_number: string;
  chassis_number: string;
  accident_date: string;
  accident_time: string;
  occupants: string;
  police_report: string;
  fir_number: string;
  police_station: string;
  accident_place: string;
  driver_name: string;
  driving_licence: string;
  driver_relation: string;
  issuing_rto: string;
  driver_mobile: string;
  accident_description: string;
  third_party_details: string;
  bank_name: string;
  bank_branch: string;
  account_number: string;
  account_type: string;
  ifsc: string;
  micr: string;
  pan: string;
};

const BAJAJ_FORM_URL = "https://general.bajajallianz.com/Corp/content/claim/Motor_Claim_Form.pdf";

function val(v: unknown) { return String(v ?? ""); }
function niceDate(v?: string | null) {
  if (!v) return "";
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("en-GB");
}

export default function CompanyClaimFormPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = String(params?.id || "");
  const [claim, setClaim] = useState<Claim | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!id) return;
    void authenticatedRequest<Claim>(`/claims/${id}`).then((c) => {
      setClaim(c);
      const f = c.form_data || {};
      setForm({
        insured_name: c.customer_name || "",
        policy_number: c.policy_number || "",
        mobile: c.customer_mobile || "",
        email: val(f.email),
        address: val(f.address),
        city: val(f.city),
        state: val(f.state),
        pincode: val(f.pincode),
        registration_number: c.registration_number || "",
        chassis_number: val(f.chassis_number),
        accident_date: c.loss_date || "",
        accident_time: c.loss_time || "",
        occupants: val(f.occupants),
        police_report: val(f.police_report),
        fir_number: val(f.fir_number),
        police_station: val(f.police_station),
        accident_place: c.loss_place || "",
        driver_name: val(f.driver_name),
        driving_licence: val(f.driver_licence),
        driver_relation: val(f.driver_relation),
        issuing_rto: val(f.issuing_rto),
        driver_mobile: val(f.driver_mobile),
        accident_description: val(f.accident_description),
        third_party_details: val(f.third_party_details),
        bank_name: val(f.bank_name),
        bank_branch: val(f.bank_branch),
        account_number: val(f.account_number),
        account_type: val(f.account_type),
        ifsc: val(f.ifsc),
        micr: val(f.micr),
        pan: val(f.pan),
      });
    }).catch((e) => setMessage(e instanceof Error ? e.message : "Claim could not load.")).finally(() => setLoading(false));
  }, [id]);

  const isBajaj = useMemo(() => /bajaj|allianz/i.test(claim?.insurance_company || ""), [claim?.insurance_company]);
  const insurerTitle = isBajaj ? "Bajaj General Insurance Limited" : (claim?.insurance_company || "Insurance Company");

  function change<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  async function save(e?: FormEvent) {
    e?.preventDefault();
    if (!claim || !form) return;
    setSaving(true); setMessage("");
    try {
      await authenticatedRequest(`/claims/${claim.id}`, {
        method: "PUT",
        body: JSON.stringify({ form_data: { ...(claim.form_data || {}), ...form } }),
      });
      setClaim({ ...claim, form_data: { ...(claim.form_data || {}), ...form } });
      setMessage("Company claim form data saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Form data could not save.");
    } finally { setSaving(false); }
  }

  if (loading) return <main className="min-h-screen bg-slate-100 p-8 text-sm text-slate-500">Loading company claim form…</main>;
  if (!claim || !form) return <main className="min-h-screen bg-slate-100 p-8"><button onClick={() => router.back()}>← Back</button><p className="mt-4 text-rose-600">{message || "Claim not found."}</p></main>;

  return <main className="min-h-screen bg-[#eef2f7] text-slate-900">
    <style>{`@media print{body *{visibility:hidden!important}.claim-print-root,.claim-print-root *{visibility:visible!important}.claim-print-root{position:absolute!important;left:0!important;top:0!important;width:100%!important;background:#fff!important}.no-print{display:none!important}.print-page{box-shadow:none!important;border:0!important;margin:0!important;width:100%!important;max-width:none!important}.print-input{border:0!important;background:transparent!important;padding:0!important;min-height:0!important} @page{size:A4;margin:10mm}}`}</style>
    <div className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Company claim form</p><h1 className="text-lg font-black">{insurerTitle} · {claim.registration_number || claim.policy_number}</h1></div>
        <div className="flex flex-wrap gap-2">
          {isBajaj ? <a href={BAJAJ_FORM_URL} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black">Official Bajaj PDF ↗</a> : null}
          <button onClick={() => void save()} disabled={saving} className="rounded-xl border border-blue-200 px-4 py-2 text-xs font-black text-blue-700">{saving ? "Saving…" : "Save form data"}</button>
          <button onClick={() => window.print()} className="rounded-xl bg-[#0d3d86] px-5 py-2 text-xs font-black text-white">Print / Save PDF</button>
          <button onClick={() => router.back()} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black">Close</button>
        </div>
      </div>
      {message ? <div className="mx-auto mt-2 max-w-6xl rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">{message}</div> : null}
    </div>

    <form onSubmit={save} className="claim-print-root mx-auto max-w-6xl p-4 md:p-7">
      <article className="print-page mx-auto max-w-[210mm] bg-white shadow-[0_25px_80px_-35px_rgba(15,23,42,.35)]">
        <header className="border-b-4 border-[#103c7c] p-7">
          <div className="flex items-start justify-between gap-6">
            <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-blue-700">Motor Insurance Claim Form</p><h2 className="mt-2 text-2xl font-black tracking-[-.03em]">{insurerTitle}</h2><p className="mt-1 text-[11px] text-slate-500">Auto-filled from Vimawallah ERP · Verify all details before insured signature.</p></div>
            <div className="text-right"><p className="text-[9px] font-black uppercase text-slate-400">Claim no.</p><p className="mt-1 text-sm font-black">{claim.claim_number || "To be allotted"}</p></div>
          </div>
        </header>

        <div className="space-y-6 p-7">
          <Section no="1" title="Policy Holder Details">
            <Grid><Input label="Policy Number" value={form.policy_number} set={(v)=>change("policy_number",v)}/><Input label="Name of Insured" value={form.insured_name} set={(v)=>change("insured_name",v)}/><Input label="Mobile Number" value={form.mobile} set={(v)=>change("mobile",v)}/><Input label="Email ID" value={form.email} set={(v)=>change("email",v)}/><Input label="Address" value={form.address} set={(v)=>change("address",v)} span/><Input label="City" value={form.city} set={(v)=>change("city",v)}/><Input label="State" value={form.state} set={(v)=>change("state",v)}/><Input label="Pin Code" value={form.pincode} set={(v)=>change("pincode",v)}/></Grid>
          </Section>
          <Section no="2" title="Vehicle & Loss Details">
            <Grid><Input label="Vehicle Registration No." value={form.registration_number} set={(v)=>change("registration_number",v)}/><Input label="Chassis Number" value={form.chassis_number} set={(v)=>change("chassis_number",v)}/><Input label="Accident / Loss Date" value={form.accident_date} set={(v)=>change("accident_date",v)} type="date"/><Input label="Accident / Loss Time" value={form.accident_time} set={(v)=>change("accident_time",v)} type="time"/><Input label="Place of Accident" value={form.accident_place} set={(v)=>change("accident_place",v)} span/><Input label="No. of Occupants" value={form.occupants} set={(v)=>change("occupants",v)}/><Input label="Police Report (Yes/No)" value={form.police_report} set={(v)=>change("police_report",v)}/><Input label="GD / FIR No." value={form.fir_number} set={(v)=>change("fir_number",v)}/><Input label="Police Station" value={form.police_station} set={(v)=>change("police_station",v)}/></Grid>
          </Section>
          <Section no="3" title="Driver Details">
            <Grid><Input label="Driver Name" value={form.driver_name} set={(v)=>change("driver_name",v)}/><Input label="Driving Licence No." value={form.driving_licence} set={(v)=>change("driving_licence",v)}/><Input label="Relation with Insured" value={form.driver_relation} set={(v)=>change("driver_relation",v)}/><Input label="Issuing RTO" value={form.issuing_rto} set={(v)=>change("issuing_rto",v)}/><Input label="Driver Mobile" value={form.driver_mobile} set={(v)=>change("driver_mobile",v)}/></Grid>
          </Section>
          <Section no="4" title="Accident / Theft Statement">
            <Area label="Circumstances leading to accident / theft" value={form.accident_description} set={(v)=>change("accident_description",v)}/><Area label="Third-party vehicle / injury / property details" value={form.third_party_details} set={(v)=>change("third_party_details",v)}/>
          </Section>
          {isBajaj ? <Section no="5" title="Bank / NEFT Details">
            <Grid><Input label="Bank Name" value={form.bank_name} set={(v)=>change("bank_name",v)}/><Input label="Branch" value={form.bank_branch} set={(v)=>change("bank_branch",v)}/><Input label="Account Number" value={form.account_number} set={(v)=>change("account_number",v)}/><Input label="Account Type" value={form.account_type} set={(v)=>change("account_type",v)}/><Input label="IFSC Code" value={form.ifsc} set={(v)=>change("ifsc",v)}/><Input label="MICR Code" value={form.micr} set={(v)=>change("micr",v)}/><Input label="PAN" value={form.pan} set={(v)=>change("pan",v)}/></Grid>
          </Section> : null}
          <Section no={isBajaj ? "6" : "5"} title="Declaration & Signature">
            <p className="text-[11px] leading-5 text-slate-600">I/We declare that the information stated above is true to the best of my/our knowledge and belief. I/We understand that the insurer may require additional documents or information for claim processing.</p>
            <div className="mt-8 grid grid-cols-2 gap-10"><div className="border-t border-slate-400 pt-2 text-[10px] font-bold">Date / Place</div><div className="border-t border-slate-400 pt-2 text-[10px] font-bold text-right">Signature of Insured</div></div>
          </Section>
          <footer className="border-t border-slate-200 pt-4 text-[9px] leading-4 text-slate-400">Generated from Vimawallah ERP. For Bajaj cases, compare against the current official insurer claim form before final submission. Original insurer form remains authoritative.</footer>
        </div>
      </article>
    </form>
  </main>;
}

function Section({ no, title, children }: { no: string; title: string; children: React.ReactNode }) { return <section><div className="mb-3 flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#103c7c] text-[10px] font-black text-white">{no}</span><h3 className="text-sm font-black uppercase tracking-[.08em] text-[#15355f]">{title}</h3></div><div className="rounded-xl border border-slate-200 p-4">{children}</div></section>; }
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-2 gap-x-5 gap-y-4">{children}</div>; }
function Input({ label, value, set, type="text", span=false }: { label: string; value: string; set: (v:string)=>void; type?:string; span?:boolean }) { return <label className={span ? "col-span-2" : ""}><span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</span><input className="print-input mt-1 h-9 w-full border-b border-slate-300 bg-slate-50 px-2 text-[11px] font-semibold outline-none focus:border-blue-500" type={type} value={value} onChange={(e)=>set(e.target.value)}/></label>; }
function Area({ label, value, set }: { label:string; value:string; set:(v:string)=>void }) { return <label className="mb-4 block last:mb-0"><span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</span><textarea className="print-input mt-1 min-h-20 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] leading-5 outline-none focus:border-blue-500" value={value} onChange={(e)=>set(e.target.value)}/></label>; }
