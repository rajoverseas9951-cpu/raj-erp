"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authenticatedRequest } from "@/lib/api-client";
import { BAJAJ_MOTOR_REQUIRED_PREP_KEYS } from "@/lib/claim-form-templates/bajaj-motor";

type Claim = {
  id: string;
  policy_number?: string | null;
  claim_number?: string | null;
  customer_name?: string | null;
  customer_mobile?: string | null;
  registration_number?: string | null;
  loss_date?: string | null;
  loss_time?: string | null;
  loss_place?: string | null;
  settlement_amount?: number | null;
  form_data?: Record<string, string> | null;
};

type Field = { key: string; label: string; type?: "text" | "date" | "time" | "textarea" | "select"; options?: string[]; wide?: boolean };
type Section = { title: string; fields: Field[] };

type PdfTextField = { setText: (value: string) => void; setFontSize?: (size: number) => void };
type PdfForm = { getTextField: (name: string) => PdfTextField; updateFieldAppearances: (font?: unknown) => void };
type PdfDoc = { getForm: () => PdfForm; embedFont: (font: string) => Promise<unknown>; save: () => Promise<Uint8Array> };
type PdfLibGlobal = { PDFDocument: { load: (bytes: ArrayBuffer) => Promise<PdfDoc> }; StandardFonts: { Helvetica: string } };
type PdfWindow = Window & { PDFLib?: PdfLibGlobal };

const SECTIONS: Section[] = [
  { title: "Policyholder / KYC", fields: [
    { key: "ckyc_no", label: "CKYC No." }, { key: "pan", label: "PAN" }, { key: "dob", label: "DOB", type: "date" },
    { key: "voter_id", label: "Voter ID" }, { key: "uid_last4", label: "UID last 4 digits" }, { key: "policy_number", label: "Policy Number", wide: true },
    { key: "insured_name", label: "Name of Insured", wide: true }, { key: "mobile", label: "Mobile Number" },
    { key: "address", label: "Address", wide: true }, { key: "city", label: "City" }, { key: "state", label: "State" },
    { key: "pin_code", label: "PIN Code" }, { key: "email", label: "Email ID", wide: true },
  ]},
  { title: "Vehicle & Accident Details", fields: [
    { key: "registration_number", label: "Vehicle Registration No." }, { key: "chassis_number", label: "Chassis Number", wide: true },
    { key: "loss_date", label: "Accident / Loss Date", type: "date" }, { key: "loss_time", label: "Time", type: "time" },
    { key: "occupants", label: "No. of Occupants" }, { key: "police_report", label: "Police Report", type: "select", options: ["", "Yes", "No"] },
    { key: "fir_number", label: "GD / FIR No." }, { key: "police_station", label: "Police Station", wide: true },
    { key: "loss_place", label: "Place of Accident", wide: true },
  ]},
  { title: "Driver Details", fields: [
    { key: "driver_name", label: "Driver Name", wide: true }, { key: "driving_licence", label: "Driving Licence No.", wide: true },
    { key: "issuing_rto", label: "Issuing RTO" }, { key: "driver_mobile", label: "Driver Mobile" },
    { key: "driver_relation", label: "Relation with Insured", type: "select", options: ["", "Self", "Relative", "Friend", "Paid Driver", "Employee"] },
  ]},
  { title: "Accident / Theft Statement", fields: [
    { key: "accident_description", label: "How the accident / theft happened", type: "textarea", wide: true },
    { key: "addon_claim", label: "Claim under Add-on endorsement?", type: "select", options: ["", "Yes", "No"] },
    { key: "addon_details", label: "Add-on details", wide: true },
    { key: "tp_involvement", label: "Third-party involvement?", type: "select", options: ["", "Yes", "No"] },
  ]},
  { title: "Third-party Details", fields: [
    { key: "tp_vehicle_person_1", label: "Vehicle Make & Model / Person", wide: true }, { key: "tp_address_1", label: "Address", wide: true },
    { key: "tp_contact_1", label: "Contact Number" }, { key: "tp_id_1", label: "Vehicle No. / Person ID" },
    { key: "tp_damage_1", label: "Injury / Damage Details", type: "textarea", wide: true },
  ]},
  { title: "Bank / NEFT", fields: [
    { key: "salvage_retain", label: "Retain salvage?", type: "select", options: ["", "Yes", "No"] },
    { key: "account_holder_name", label: "Name on Bank Account", wide: true }, { key: "bank_name", label: "Bank Name", wide: true },
    { key: "bank_branch", label: "Branch" }, { key: "account_number", label: "Account Number", wide: true },
    { key: "account_type", label: "Account Type", type: "select", options: ["", "Savings", "Current", "Cash Credit"] },
    { key: "ifsc_code", label: "IFSC Code" }, { key: "micr_code", label: "MICR Code" },
    { key: "bank_proof", label: "Bank Proof", type: "select", options: ["", "Cancelled Cheque", "Bank passbook copy"] },
  ]},
  { title: "Declaration / Settlement", fields: [
    { key: "signature_name", label: "Insured Name", wide: true }, { key: "signature_date", label: "Declaration Date", type: "date" },
    { key: "claim_number", label: "Claim No." }, { key: "settlement_amount", label: "Settlement Amount" },
    { key: "settlement_amount_words", label: "Settlement Amount in Words", wide: true },
    { key: "issuance_office", label: "Issuance Office / Seal", wide: true },
  ]},
];

const PDF_TEXT_MAP: Array<[string, string]> = [
  ["ckyc_no", "1"], ["pan", "undefined"], ["dob", "undefined_2"], ["voter_id", "2"], ["uid_last4", "undefined_3"],
  ["policy_number", "UID Last 4 Digit I 1"], ["insured_name", "UID Last 4 Digit I 2"], ["mobile", "91"], ["address", "undefined_5"],
  ["city", "undefined_6"], ["state", "undefined_7"], ["pin_code", "ma1 ID"], ["email", "1_2"],
  ["registration_number", "3 Vehicle Loss Details Accident Theft"], ["chassis_number", "Chassis Number I I"], ["loss_date", "undefined_10"],
  ["loss_time", "undefined_11"], ["occupants", "fill_70"], ["fir_number", "undefined_9"], ["police_station", "Name of Police Station 1"],
  ["loss_place", "Name of Police Station 2"], ["driver_name", "Name 1"], ["driving_licence", "Name 2"], ["issuing_rto", "rto"],
  ["driver_mobile", "mobile 1001"], ["tp_vehicle_person_1", "Vehicle Make and Model PersonRow1"], ["tp_address_1", "Inspection AddressRow1"],
  ["tp_contact_1", "Contact NumberRow1"], ["tp_id_1", "Vehicle NumberPerson IDRow1"], ["tp_damage_1", "Description of Injury damageRow1"],
  ["account_holder_name", "Branch"], ["bank_name", "undefined_14"], ["bank_branch", "Account Type D Savings D Current D Cash Credit"],
  ["account_number", "MICRCodeI I I I I I I I I I I"], ["ifsc_code", "In support of bank details Please tick the type of proof submitted D Cancelled Cheque D Bank passbook copy"],
  ["micr_code", "micr"], ["signature_name", "Name 3"], ["signature_date", "date1"], ["claim_number", "claim"],
  ["settlement_amount", "rs"], ["policy_number", "policy"], ["settlement_amount_words", "rs1"], ["issuance_office", "add1"],
];

const s = (value: unknown) => String(value ?? "");

function pdfDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function splitStatement(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return ["", "", ""];
  const max = Math.ceil(clean.length / 3);
  const parts: string[] = [];
  let remaining = clean;
  for (let i = 0; i < 2; i += 1) {
    if (remaining.length <= max) { parts.push(remaining); remaining = ""; continue; }
    let cut = remaining.lastIndexOf(" ", max);
    if (cut < Math.floor(max * 0.6)) cut = max;
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  parts.push(remaining);
  return [parts[0] || "", parts[1] || "", parts[2] || ""];
}

function loadPdfLib(): Promise<PdfLibGlobal> {
  const win = window as PdfWindow;
  if (win.PDFLib) return Promise.resolve(win.PDFLib);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-pdf-lib="1"]');
    const finish = () => {
      const lib = (window as PdfWindow).PDFLib;
      if (lib) resolve(lib); else reject(new Error("PDF engine could not load."));
    };
    if (existing) { existing.addEventListener("load", finish, { once: true }); existing.addEventListener("error", () => reject(new Error("PDF engine could not load.")), { once: true }); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";
    script.async = true;
    script.dataset.pdfLib = "1";
    script.onload = finish;
    script.onerror = () => reject(new Error("PDF engine could not load."));
    document.head.appendChild(script);
  });
}

export default function BajajMotorClaimFormPage() {
  return <Suspense fallback={<Loading />}><ClaimForm /></Suspense>;
}

function ClaimForm() {
  const search = useSearchParams();
  const id = search.get("id") || "";
  const [claim, setClaim] = useState<Claim | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!id) { setMessage("Claim id missing."); setLoading(false); return; }
    authenticatedRequest<Claim>(`/claims/${id}`).then((c) => {
      setClaim(c);
      const f = c.form_data || {};
      setForm({
        ...f,
        policy_number: s(f.policy_number || c.policy_number), claim_number: s(f.claim_number || c.claim_number), insured_name: s(f.insured_name || c.customer_name),
        mobile: s(f.mobile || c.customer_mobile), registration_number: s(f.registration_number || c.registration_number), loss_date: s(f.loss_date || c.loss_date),
        loss_time: s(f.loss_time || c.loss_time), loss_place: s(f.loss_place || c.loss_place), account_holder_name: s(f.account_holder_name || c.customer_name),
        signature_name: s(f.signature_name || c.customer_name), settlement_amount: s(f.settlement_amount || c.settlement_amount),
      });
    }).catch((e) => setMessage(e instanceof Error ? e.message : "Claim could not load.")).finally(() => setLoading(false));
  }, [id]);

  const missing = useMemo(() => BAJAJ_MOTOR_REQUIRED_PREP_KEYS.filter((key) => !s(form[key]).trim()), [form]);

  async function persist(showMessage = true) {
    if (!claim) return;
    const merged = { ...(claim.form_data || {}), ...form, claim_form_insurer_key: "bajaj", claim_form_line: "motor", exact_template_key: "bajaj_motor_v1" };
    await authenticatedRequest(`/claims/${claim.id}`, { method: "PUT", body: JSON.stringify({ form_data: merged }) });
    setClaim({ ...claim, form_data: merged });
    if (showMessage) setMessage("Details saved.");
  }

  async function save() {
    if (!claim) return;
    setSaving(true); setMessage("");
    try { await persist(true); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Details could not save."); }
    finally { setSaving(false); }
  }

  async function downloadFilledPdf() {
    if (!claim) return;
    setDownloading(true); setMessage("");
    try {
      await persist(false);
      const [pdfResponse, pdfLib] = await Promise.all([
        fetch("/api/official-claim-forms/bajaj-motor", { cache: "no-store" }),
        loadPdfLib(),
      ]);
      if (!pdfResponse.ok) throw new Error("Bajaj official PDF could not load.");
      const bytes = await pdfResponse.arrayBuffer();
      const pdfDoc = await pdfLib.PDFDocument.load(bytes);
      const pdfForm = pdfDoc.getForm();

      const values = { ...form };
      for (const [formKey, pdfFieldName] of PDF_TEXT_MAP) {
        let value = s(values[formKey]).trim();
        if (!value) continue;
        if (["dob", "loss_date", "signature_date"].includes(formKey)) value = pdfDate(value);
        try {
          const field = pdfForm.getTextField(pdfFieldName);
          field.setText(value);
          if (field.setFontSize && value.length > 28) field.setFontSize(6.5);
        } catch { /* keep unsupported/ambiguous PDF widgets manual */ }
      }

      const statement = splitStatement(s(values.accident_description));
      [["took place 1", statement[0]], ["took place 2", statement[1]], ["took place 3", statement[2]]].forEach(([name, value]) => {
        if (!value) return;
        try { const field = pdfForm.getTextField(name); field.setText(value); if (field.setFontSize) field.setFontSize(6.5); } catch { /* manual fallback */ }
      });

      const office = s(values.issuance_office).trim();
      if (office.length > 55) {
        try { pdfForm.getTextField("add1").setText(office.slice(0, 55)); pdfForm.getTextField("add2").setText(office.slice(55, 110)); } catch { /* manual fallback */ }
      }

      const font = await pdfDoc.embedFont(pdfLib.StandardFonts.Helvetica);
      pdfForm.updateFieldAppearances(font);
      const filled = await pdfDoc.save();
      const safeBytes = new Uint8Array(filled.byteLength);
      safeBytes.set(filled);
      const blob = new Blob([safeBytes.buffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Bajaj-Motor-Claim-${s(form.registration_number || claim.registration_number || claim.id)}-FILLED.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage("Filled official Bajaj PDF downloaded. Radio buttons / signatures that are still blank can be completed before submission.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Filled PDF could not be generated.");
    } finally { setDownloading(false); }
  }

  if (loading) return <Loading />;
  if (!claim) return <main className="min-h-screen bg-[#eef3f8] p-6 text-rose-700">{message || "Claim not found."}</main>;

  return <main className="min-h-screen bg-[#eef3f8] p-4 text-slate-900 sm:p-6 lg:p-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <section className="rounded-[30px] bg-[linear-gradient(125deg,#06152f,#0b3477_55%,#2878ef)] p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-300">Bajaj General · Motor Claim</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Claim Form</h1><p className="mt-2 text-sm font-semibold text-blue-100/80">ERP details are filled automatically. Complete missing fields, then download the filled official PDF.</p></div>
          <div className="flex flex-wrap gap-2">
            <Link href="/claims" className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-black">← Back</Link>
            <button onClick={() => void save()} disabled={saving || downloading} className="rounded-xl bg-white px-5 py-3 text-sm font-black text-[#0b3477] disabled:opacity-60">{saving ? "Saving…" : "Save Details"}</button>
            <button onClick={() => void downloadFilledPdf()} disabled={saving || downloading} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{downloading ? "Preparing PDF…" : "Download Filled Official PDF ↓"}</button>
          </div>
        </div>
      </section>

      <section className={`rounded-[22px] border p-4 ${missing.length ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}><p className="text-sm font-black">{missing.length ? `${missing.length} important fields still pending` : "Details ready"}</p><p className="mt-1 text-xs font-semibold opacity-75">Yellow fields are missing. You can still download and finish any remaining boxes manually.</p></section>
      {message ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</div> : null}

      {SECTIONS.map((section) => <section key={section.title} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(24,59,110,.05)] sm:p-6"><h2 className="text-lg font-black text-[#0c3c78]">{section.title}</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{section.fields.map((field) => <FieldInput key={field.key} field={field} value={s(form[field.key])} onChange={(value) => setForm((prev) => ({ ...prev, [field.key]: value }))} />)}</div></section>)}
    </div>
  </main>;
}

function FieldInput({ field, value, onChange }: { field: Field; value: string; onChange: (value: string) => void }) {
  const missing = !value.trim();
  const cls = `mt-2 w-full rounded-xl border px-3 text-sm font-semibold outline-none ${missing ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`;
  return <label className={field.wide ? "md:col-span-2" : ""}><span className="text-[10px] font-black uppercase tracking-[.12em] text-slate-500">{field.label}</span>{field.type === "textarea" ? <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={`${cls} p-3`} /> : field.type === "select" ? <select value={value} onChange={(e) => onChange(e.target.value)} className={`${cls} h-12`}>{(field.options || [""]).map((option) => <option key={option || "empty"} value={option}>{option || "Select"}</option>)}</select> : <input type={field.type || "text"} value={value} onChange={(e) => onChange(e.target.value)} className={`${cls} h-12`} />}</label>;
}

function Loading() { return <main className="grid min-h-screen place-items-center bg-[#eef3f8] p-6 text-sm font-bold text-slate-500">Loading Bajaj claim form…</main>; }
