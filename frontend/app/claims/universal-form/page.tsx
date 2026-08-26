"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedRequest } from "@/lib/api-client";
import { getClaimFormProfile, isVerifiedOfficialTemplate, resolveClaimLine, resolveInsurer, type ClaimLine } from "@/lib/claim-form-registry";

type Claim = {
  id: string;
  insurance_line?: string | null;
  policy_number?: string | null;
  insurance_company?: string | null;
  customer_name: string;
  customer_mobile?: string | null;
  registration_number?: string | null;
  claim_number?: string | null;
  loss_date?: string | null;
  loss_time?: string | null;
  loss_place?: string | null;
  estimated_loss?: number | null;
  approved_amount?: number | null;
  settlement_amount?: number | null;
  form_data?: Record<string, string>;
};

type FieldType = "text" | "date" | "time" | "number" | "textarea" | "select";
type FieldDef = { key: string; label: string; type?: FieldType; span?: number; options?: string[] };
type SectionDef = { title: string; fields: FieldDef[] };

type FormValues = Record<string, string>;

const COMMON: SectionDef[] = [
  { title: "Policy & Claim Details", fields: [
    { key: "policy_number", label: "Policy Number", span: 2 },
    { key: "claim_number", label: "Claim Number" },
    { key: "insured_name", label: "Insured / Policyholder Name", span: 2 },
    { key: "mobile", label: "Mobile Number" },
    { key: "email", label: "Email ID" },
    { key: "pan", label: "PAN" },
    { key: "ckyc_no", label: "CKYC No." },
    { key: "address", label: "Address", span: 3 },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "pin_code", label: "PIN Code" },
  ]},
];

const MOTOR: SectionDef[] = [
  { title: "Vehicle & Loss Details", fields: [
    { key: "registration_number", label: "Registration Number" },
    { key: "chassis_number", label: "Chassis Number", span: 2 },
    { key: "loss_date", label: "Loss Date", type: "date" },
    { key: "loss_time", label: "Loss Time", type: "time" },
    { key: "loss_place", label: "Loss Place", span: 2 },
    { key: "occupants", label: "No. of Occupants" },
    { key: "police_report", label: "Police Report", type: "select", options: ["", "Yes", "No"] },
    { key: "fir_number", label: "FIR / GD Number" },
    { key: "police_station", label: "Police Station" },
  ]},
  { title: "Driver Details", fields: [
    { key: "driver_name", label: "Driver Name" },
    { key: "driving_licence", label: "Driving Licence Number" },
    { key: "issuing_rto", label: "Issuing RTO" },
    { key: "driver_mobile", label: "Driver Mobile" },
    { key: "driver_relation", label: "Relation with Insured", type: "select", options: ["", "Self", "Relative", "Friend", "Paid Driver", "Employee"] },
  ]},
  { title: "Accident / Theft Statement", fields: [
    { key: "accident_description", label: "How accident / loss happened", type: "textarea", span: 3 },
    { key: "third_party_details", label: "Third Party / Injury / Property Details", type: "textarea", span: 3 },
    { key: "garage_name", label: "Garage / Repairer Name", span: 2 },
    { key: "repair_estimate", label: "Repair Estimate", type: "number" },
    { key: "addon_claim", label: "Add-on Claim?", type: "select", options: ["", "Yes", "No"] },
    { key: "addon_details", label: "Add-on Details", span: 2 },
    { key: "salvage_retain", label: "Retain Salvage?", type: "select", options: ["", "Yes", "No"] },
  ]},
];

const HEALTH: SectionDef[] = [
  { title: "Patient & Hospitalisation", fields: [
    { key: "patient_name", label: "Patient Name", span: 2 },
    { key: "patient_relation", label: "Relation with Insured" },
    { key: "patient_dob", label: "Patient DOB", type: "date" },
    { key: "hospital_name", label: "Hospital Name", span: 2 },
    { key: "hospital_city", label: "Hospital City" },
    { key: "tpa_name", label: "TPA Name" },
    { key: "admission_date", label: "Admission Date", type: "date" },
    { key: "discharge_date", label: "Discharge Date", type: "date" },
    { key: "room_category", label: "Room Category" },
  ]},
  { title: "Diagnosis & Treatment", fields: [
    { key: "diagnosis", label: "Diagnosis", span: 2 },
    { key: "treatment", label: "Treatment / Procedure", type: "textarea", span: 3 },
    { key: "doctor_name", label: "Treating Doctor" },
    { key: "hospitalisation_reason", label: "Reason for Hospitalisation", span: 2 },
    { key: "pre_existing", label: "Pre-existing Disease?", type: "select", options: ["", "Yes", "No"] },
    { key: "cashless_or_reimbursement", label: "Claim Mode", type: "select", options: ["", "Cashless", "Reimbursement"] },
  ]},
  { title: "Expense Details", fields: [
    { key: "hospital_bill", label: "Hospital Bill", type: "number" },
    { key: "pre_hospitalisation", label: "Pre-Hospitalisation", type: "number" },
    { key: "post_hospitalisation", label: "Post-Hospitalisation", type: "number" },
    { key: "medicine_bill", label: "Medicine Bill", type: "number" },
    { key: "diagnostic_bill", label: "Diagnostic Bill", type: "number" },
    { key: "claim_amount", label: "Total Claim Amount", type: "number" },
  ]},
];

const NON_MOTOR: SectionDef[] = [
  { title: "Risk / Property Details", fields: [
    { key: "risk_type", label: "Risk Type", type: "select", options: ["", "Fire", "Shop", "Property", "Marine", "Burglary", "Liability", "Engineering", "Other"] },
    { key: "risk_address", label: "Risk / Property Address", span: 2 },
    { key: "sum_insured", label: "Sum Insured", type: "number" },
    { key: "loss_date", label: "Loss Date", type: "date" },
    { key: "loss_time", label: "Loss Time", type: "time" },
    { key: "loss_place", label: "Loss Place", span: 2 },
  ]},
  { title: "Loss Event", fields: [
    { key: "cause_of_loss", label: "Cause of Loss", span: 2 },
    { key: "loss_description", label: "Complete Loss / Damage Description", type: "textarea", span: 3 },
    { key: "police_station", label: "Police Station" },
    { key: "fir_number", label: "FIR / GD Number" },
    { key: "fire_brigade_report", label: "Fire Brigade Report", type: "select", options: ["", "Yes", "No", "Not Applicable"] },
    { key: "surveyor_name", label: "Surveyor Name" },
    { key: "estimated_loss", label: "Estimated Loss", type: "number" },
    { key: "salvage_details", label: "Salvage Details", span: 2 },
  ]},
];

const LIFE: SectionDef[] = [
  { title: "Life Assured & Claimant", fields: [
    { key: "life_assured_name", label: "Life Assured Name", span: 2 },
    { key: "life_assured_dob", label: "Life Assured DOB", type: "date" },
    { key: "claimant_name", label: "Claimant / Nominee Name", span: 2 },
    { key: "claimant_relation", label: "Relation with Life Assured" },
    { key: "claimant_mobile", label: "Claimant Mobile" },
    { key: "nominee_name", label: "Nominee Name" },
    { key: "nominee_share", label: "Nominee Share %", type: "number" },
  ]},
  { title: "Event Details", fields: [
    { key: "event_date", label: "Date of Death / Event", type: "date" },
    { key: "event_place", label: "Place of Event" },
    { key: "cause_of_event", label: "Cause of Death / Event", span: 2 },
    { key: "hospital_name", label: "Hospital / Doctor" },
    { key: "death_certificate_no", label: "Death Certificate Number" },
    { key: "police_station", label: "Police Station" },
    { key: "fir_number", label: "FIR / Inquest Number" },
    { key: "event_description", label: "Event Description", type: "textarea", span: 3 },
  ]},
];

const PA: SectionDef[] = [
  { title: "Accident & Injury", fields: [
    { key: "accident_date", label: "Accident Date", type: "date" },
    { key: "accident_time", label: "Accident Time", type: "time" },
    { key: "accident_place", label: "Accident Place" },
    { key: "accident_description", label: "Accident Description", type: "textarea", span: 3 },
    { key: "injury_details", label: "Injury Details", type: "textarea", span: 3 },
    { key: "disability_type", label: "Disability Type" },
    { key: "disability_percent", label: "Disability %", type: "number" },
    { key: "hospital_name", label: "Hospital Name" },
  ]},
];

const OTHER: SectionDef[] = [
  { title: "Loss / Event Details", fields: [
    { key: "loss_date", label: "Loss / Event Date", type: "date" },
    { key: "loss_place", label: "Loss / Event Place" },
    { key: "loss_description", label: "Claim / Loss Description", type: "textarea", span: 3 },
    { key: "claim_amount", label: "Claim Amount", type: "number" },
  ]},
];

const BANK: SectionDef[] = [
  { title: "Bank / NEFT Details", fields: [
    { key: "bank_name", label: "Bank Name" },
    { key: "bank_branch", label: "Branch" },
    { key: "account_number", label: "Account Number" },
    { key: "account_type", label: "Account Type", type: "select", options: ["", "Savings", "Current", "Cash Credit"] },
    { key: "ifsc_code", label: "IFSC Code" },
    { key: "micr_code", label: "MICR Code" },
    { key: "account_holder_name", label: "Account Holder Name", span: 2 },
  ]},
];

const DOCS: Record<ClaimLine, string[]> = {
  motor: ["Signed claim form", "Policy copy", "RC", "Driving licence", "Repair estimate", "FIR / Panchanama where applicable", "Repair invoice", "KYC", "Bank proof"],
  health: ["Signed claim form", "Policy / health card", "Hospital discharge summary", "Final hospital bill", "Payment receipts", "Prescriptions", "Diagnostic reports", "KYC", "Bank proof"],
  non_motor: ["Signed claim form", "Policy copy", "Loss photographs", "Police / Fire Brigade report where applicable", "Purchase invoices / stock records", "Repair / replacement estimate", "Survey documents", "KYC", "Bank proof"],
  life: ["Signed claim form", "Policy document", "Death / event certificate", "Claimant KYC", "Nominee / legal heir proof", "Medical records where applicable", "Police / post-mortem documents where applicable", "Bank proof"],
  personal_accident: ["Signed claim form", "Policy copy", "Accident proof / FIR where applicable", "Medical records", "Disability certificate where applicable", "KYC", "Bank proof"],
  other: ["Signed claim form", "Policy copy", "Loss proof", "Supporting invoices / reports", "KYC", "Bank proof"],
};

const s = (v: unknown) => String(v ?? "");

function lineSections(line: ClaimLine): SectionDef[] {
  if (line === "motor") return MOTOR;
  if (line === "health") return HEALTH;
  if (line === "non_motor") return NON_MOTOR;
  if (line === "life") return LIFE;
  if (line === "personal_accident") return PA;
  return OTHER;
}

export default function UniversalCompanyFormPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-100 p-8 text-sm text-slate-500">Loading insurer claim form…</main>}><UniversalForm /></Suspense>;
}

function UniversalForm() {
  const router = useRouter();
  const search = useSearchParams();
  const id = search.get("id") || "";
  const [claim, setClaim] = useState<Claim | null>(null);
  const [form, setForm] = useState<FormValues>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!id) { setMessage("Claim id missing."); setLoading(false); return; }
    void authenticatedRequest<Claim>(`/claims/${id}`).then((c) => {
      setClaim(c);
      const f = c.form_data || {};
      setForm({
        ...f,
        policy_number: s(f.policy_number || c.policy_number),
        claim_number: s(f.claim_number || c.claim_number),
        insured_name: s(f.insured_name || c.customer_name),
        mobile: s(f.mobile || c.customer_mobile),
        registration_number: s(f.registration_number || c.registration_number),
        loss_date: s(f.loss_date || f.accident_date || c.loss_date),
        loss_time: s(f.loss_time || f.accident_time || c.loss_time),
        loss_place: s(f.loss_place || f.accident_place || c.loss_place),
        accident_date: s(f.accident_date || c.loss_date),
        accident_time: s(f.accident_time || c.loss_time),
        accident_place: s(f.accident_place || c.loss_place),
        estimated_loss: s(f.estimated_loss || c.estimated_loss),
        claim_amount: s(f.claim_amount || c.estimated_loss),
        life_assured_name: s(f.life_assured_name || c.customer_name),
        patient_name: s(f.patient_name || c.customer_name),
        account_holder_name: s(f.account_holder_name || c.customer_name),
      });
    }).catch((e) => setMessage(e instanceof Error ? e.message : "Claim could not load.")).finally(() => setLoading(false));
  }, [id]);

  const line = resolveClaimLine(claim?.insurance_line);
  const profile = getClaimFormProfile(claim?.insurance_line);
  const insurer = resolveInsurer(claim?.insurance_company);
  const verified = isVerifiedOfficialTemplate(claim?.insurance_company, claim?.insurance_line);
  const sections = useMemo(() => [...COMMON, ...lineSections(line), ...BANK], [line]);
  const requiredKeys = useMemo(() => sections.flatMap((section) => section.fields).filter((field) => !["claim_number", "ckyc_no", "micr_code"].includes(field.key)).map((field) => field.key), [sections]);
  const missing = useMemo(() => requiredKeys.filter((key) => !s(form[key]).trim()).length, [form, requiredKeys]);

  function change(key: string, value: string) { setForm((prev) => ({ ...prev, [key]: value })); }

  async function save() {
    if (!claim) return;
    setSaving(true); setMessage("");
    try {
      await authenticatedRequest(`/claims/${claim.id}`, { method: "PUT", body: JSON.stringify({ form_data: { ...(claim.form_data || {}), ...form, claim_form_line: line, claim_form_insurer_key: insurer.key } }) });
      setClaim({ ...claim, form_data: { ...(claim.form_data || {}), ...form } });
      setMessage("Claim form details saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Form details could not save.");
    } finally { setSaving(false); }
  }

  if (loading) return <main className="min-h-screen bg-slate-100 p-8 text-sm text-slate-500">Loading insurer claim form…</main>;
  if (!claim) return <main className="min-h-screen bg-slate-100 p-8"><button onClick={() => router.back()}>← Back</button><p className="mt-4 text-rose-600">{message || "Claim not found."}</p></main>;

  return <main className="min-h-screen bg-[#e9eef5] text-slate-900">
    <style>{`@page{size:A4;margin:7mm}@media print{html,body{background:#fff!important}body *{visibility:hidden!important}.claim-print-root,.claim-print-root *{visibility:visible!important}.claim-print-root{position:absolute!important;left:0!important;top:0!important;width:100%!important;margin:0!important;padding:0!important}.no-print{display:none!important}.print-page{width:196mm!important;min-height:276mm!important;margin:0 auto!important;box-shadow:none!important;border:0!important;break-after:page!important}.print-page:last-child{break-after:auto!important}input,select,textarea{background:transparent!important;color:#111827!important}.missing-field{background:transparent!important}}`}</style>

    <div className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Universal Claim Form Engine</p>
          <h1 className="mt-1 text-lg font-black">{insurer.displayName} · {profile.title}</h1>
          <p className="mt-1 text-xs font-semibold text-slate-500"><span className="text-amber-600">{missing} fields pending.</span> ERP data auto-filled hai; amber fields manually complete karo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-xl px-3 py-2 text-[10px] font-black ${verified ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{verified ? "VERIFIED COMPANY TEMPLATE" : "UNIVERSAL INSURER TEMPLATE"}</span>
          <button onClick={() => router.back()} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black">← Claim desk</button>
          <button onClick={() => void save()} disabled={saving} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-black text-blue-700 disabled:opacity-50">{saving ? "Saving…" : "Save details"}</button>
          <button onClick={() => window.print()} className="rounded-xl bg-[#0c3c78] px-5 py-2.5 text-xs font-black text-white">Print / Save PDF</button>
        </div>
      </div>
      {message ? <div className="mx-auto mt-2 max-w-6xl rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{message}</div> : null}
    </div>

    <div className="claim-print-root mx-auto max-w-[210mm] space-y-5 py-6">
      <article className="print-page bg-white p-6 shadow-[0_25px_80px_-35px_rgba(15,23,42,.45)]">
        <header>
          <div className="flex items-start justify-between gap-5">
            <div><p className="text-[8px] font-semibold text-slate-500">Insurer claim submission</p><h2 className="mt-1 text-[16px] font-black text-[#153c70]">{insurer.displayName}</h2></div>
            <div className="text-right"><p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Claim No.</p><p className="mt-1 text-[11px] font-black">{claim.claim_number || "To be allotted"}</p></div>
          </div>
          <div className="mt-3 bg-[#0876b8] py-2 text-center text-[12px] font-black tracking-wide text-white">{profile.title.toUpperCase()}</div>
          <p className="mt-1 text-center text-[7px] font-semibold text-slate-500">{profile.subtitle}</p>
        </header>

        <div className="mt-4 space-y-4">
          {sections.map((section, index) => <FormSection key={section.title} number={String(index + 1)} title={section.title}>
            <div className="grid grid-cols-3 gap-x-4 gap-y-3">
              {section.fields.map((field) => <DynamicField key={field.key} def={field} value={s(form[field.key])} onChange={(value) => change(field.key, value)} />)}
            </div>
          </FormSection>)}

          <FormSection number={String(sections.length + 1)} title="Declaration & Signature">
            <p className="text-[8px] leading-4 text-slate-600">I/We confirm that the information provided in this claim form is true to the best of my/our knowledge and that the insurer may verify the information and request additional documents before settlement.</p>
            <div className="mt-8 grid grid-cols-3 gap-6"><DynamicField def={{ key: "signature_place", label: "Place" }} value={s(form.signature_place)} onChange={(value) => change("signature_place", value)} /><DynamicField def={{ key: "signature_date", label: "Date", type: "date" }} value={s(form.signature_date)} onChange={(value) => change("signature_date", value)} /><div className="flex items-end"><div className="w-full border-t border-slate-400 pt-1 text-right text-[8px] font-bold">Signature of Insured / Claimant</div></div></div>
          </FormSection>
        </div>
        <p className="mt-4 border-t border-slate-200 pt-2 text-[6.5px] leading-3 text-slate-400">Generated by Vimawallah ERP. Employee and claimant must verify all entries before signature. Where an insurer-specific verified original template is available, that template should be preferred for final submission.</p>
      </article>

      <article className="print-page bg-white p-7 shadow-[0_25px_80px_-35px_rgba(15,23,42,.45)]">
        <h2 className="text-center text-[16px] font-black text-[#0876b8]">Claim Document Checklist</h2>
        <p className="mt-1 text-center text-[8px] font-semibold text-slate-500">{insurer.displayName} · {profile.title}</p>
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          {DOCS[line].map((item, index) => <div key={item} className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 last:border-b-0"><span className="grid h-5 w-5 place-items-center border border-slate-400 text-[8px]">□</span><span className="text-[9px] font-semibold">{index + 1}. {item}</span></div>)}
        </div>
        <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-wide text-blue-700">Employee submission check</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-[8px] font-semibold text-slate-600"><span>□ Form verified with policy details</span><span>□ Missing fields completed</span><span>□ Customer / claimant signature obtained</span><span>□ Required documents attached</span><span>□ Signed form uploaded to ERP</span><span>□ Insurer / TPA submission recorded</span></div>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-12"><div className="border-t border-slate-400 pt-2 text-[8px] font-bold">Employee Name / Signature</div><div className="border-t border-slate-400 pt-2 text-right text-[8px] font-bold">Customer / Claimant Signature</div></div>
      </article>
    </div>
  </main>;
}

function FormSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return <section><div className="mb-2 flex items-center gap-2 border-b border-[#9bc8e2] pb-1"><span className="text-[8px] font-black text-[#0876b8]">{number}.</span><h3 className="text-[9px] font-black uppercase tracking-wide text-[#0876b8]">{title}</h3></div>{children}</section>;
}

function DynamicField({ def, value, onChange }: { def: FieldDef; value: string; onChange: (value: string) => void }) {
  const missing = !value.trim();
  const span = Math.min(Math.max(def.span || 1, 1), 3);
  const style = { gridColumn: span > 1 ? `span ${span} / span ${span}` : undefined };
  const base = `mt-1 w-full border-b px-1 text-[9px] font-semibold outline-none ${missing ? "missing-field border-amber-400 bg-amber-50" : "border-slate-300 bg-white"}`;
  return <label style={style} className="block"><span className="block text-[6.5px] font-black uppercase tracking-wide text-slate-500">{def.label}</span>{def.type === "textarea" ? <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={`${base} resize-none py-1 leading-4`} /> : def.type === "select" ? <select value={value} onChange={(e) => onChange(e.target.value)} className={`${base} h-[28px]`}>{(def.options || [""]).map((option) => <option key={option || "empty"} value={option}>{option || "Select"}</option>)}</select> : <input type={def.type || "text"} value={value} onChange={(e) => onChange(e.target.value)} className={`${base} h-[28px]`} />}</label>;
}
