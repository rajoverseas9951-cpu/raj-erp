"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedRequest } from "@/lib/api-client";
import { resolveInsurer, type ClaimLine } from "@/lib/claim-form-registry";
import {
  BAJAJ_MOTOR_PDF_CHOICES,
  BAJAJ_MOTOR_PDF_FIELDS,
  BAJAJ_MOTOR_REQUIRED_PREP_KEYS,
  isBajajMotorExactTemplate,
} from "@/lib/claim-form-templates/bajaj-motor";

type Claim = {
  id: string;
  insurance_line?: string | null;
  policy_number?: string | null;
  insurance_company?: string | null;
  customer_name?: string | null;
  customer_mobile?: string | null;
  registration_number?: string | null;
  claim_number?: string | null;
  loss_date?: string | null;
  loss_place?: string | null;
  form_data?: Record<string, unknown> | null;
};

function safeLine(value?: string | null): ClaimLine {
  const n = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (n.includes("non motor") || n.includes("property") || n.includes("fire") || n.includes("marine")) return "non_motor";
  if (n.includes("health") || n.includes("mediclaim")) return "health";
  if (n.includes("life")) return "life";
  if (n.includes("personal accident") || n === "pa") return "personal_accident";
  if (n.includes("motor")) return "motor";
  return "other";
}

const lineName: Record<ClaimLine, string> = {
  motor: "Motor",
  health: "Health",
  non_motor: "Non-Motor",
  life: "Life",
  personal_accident: "Personal Accident",
  other: "Other",
};

function claimValue(claim: Claim, key: string): unknown {
  const form = claim.form_data || {};
  if (String(form[key] ?? "").trim()) return form[key];
  if (key === "policy_number") return claim.policy_number;
  if (key === "insured_name") return claim.customer_name;
  if (key === "mobile") return claim.customer_mobile;
  if (key === "registration_number") return claim.registration_number;
  if (key === "loss_date") return claim.loss_date;
  if (key === "loss_place") return claim.loss_place;
  if (key === "claim_number") return claim.claim_number;
  return null;
}

export default function OfficialClaimFormPage() {
  return <Suspense fallback={<Loading />}><Workspace /></Suspense>;
}

function Workspace() {
  const router = useRouter();
  const search = useSearchParams();
  const id = search.get("id") || "";
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) { setError("Claim id missing."); setLoading(false); return; }
    authenticatedRequest<Claim>(`/claims/${id}`)
      .then(setClaim)
      .catch((e) => setError(e instanceof Error ? e.message : "Claim could not load."))
      .finally(() => setLoading(false));
  }, [id]);

  const line = safeLine(claim?.insurance_line);
  const insurer = resolveInsurer(claim?.insurance_company);
  const officialSource = insurer.officialSources?.find((source) => source.line === line) || null;
  const exactMapped = isBajajMotorExactTemplate(insurer.key, line);

  const readiness = useMemo(() => {
    if (!claim) return { done: 0, total: 5, percent: 0 };
    const keys = exactMapped
      ? [...BAJAJ_MOTOR_REQUIRED_PREP_KEYS]
      : line === "motor"
        ? ["policy_number", "insured_name", "mobile", "registration_number", "loss_date"]
        : ["policy_number", "insured_name", "mobile", "loss_date", "loss_place"];
    const done = keys.filter((key) => String(claimValue(claim, key) || "").trim()).length;
    return { done, total: keys.length, percent: Math.round((done / keys.length) * 100) };
  }, [claim, line, exactMapped]);

  if (loading) return <Loading />;
  if (!claim) return <main className="min-h-screen bg-[#eef3f8] p-6"><button onClick={() => router.back()} className="font-black">← Back</button><p className="mt-5 text-sm font-bold text-rose-700">{error || "Claim not found."}</p></main>;

  return <main className="min-h-screen bg-[#eef3f8] p-4 text-slate-900 sm:p-6 lg:p-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <section className="overflow-hidden rounded-[30px] bg-[linear-gradient(125deg,#06152f,#0b3477_55%,#2878ef)] p-6 text-white shadow-[0_28px_75px_rgba(7,26,60,.22)] sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-300">Claims · Official Form Workspace</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{insurer.displayName}</h1>
            <p className="mt-2 text-sm font-semibold text-blue-100/80">{lineName[line]} claim · Policy {claim.policy_number || "not set"}</p>
          </div>
          <Link href="/claims" className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black">← Claim Desk</Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatusCard title="ERP data readiness" value={`${readiness.percent}%`} copy={`${readiness.done}/${readiness.total} key claim details available before form preparation.`} tone={readiness.percent === 100 ? "good" : "warn"} />
        <StatusCard title="Official insurer source" value={officialSource ? "Available" : "Not mapped"} copy={officialSource ? officialSource.label : "Use ERP data-prep form while the official source is being mapped."} tone={officialSource ? "good" : "neutral"} />
        <StatusCard title="Exact PDF automation" value={exactMapped ? "Field map ready" : "Pending"} copy={exactMapped ? `${BAJAJ_MOTOR_PDF_FIELDS.length} text fields + ${BAJAJ_MOTOR_PDF_CHOICES.length} choice groups mapped on the original fillable PDF.` : "Official source is tracked; exact AcroForm/overlay mapping will be added insurer-by-insurer."} tone={exactMapped ? "good" : "neutral"} />
      </section>

      {exactMapped ? <section className="rounded-[26px] border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
        <p className="text-[10px] font-black uppercase tracking-[.18em]">Bajaj Motor · exact-template implementation</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Fact label="Official PDF" value="2 pages · fillable AcroForm" />
          <Fact label="Mapped fields" value={`${BAJAJ_MOTOR_PDF_FIELDS.length} text + ${BAJAJ_MOTOR_PDF_CHOICES.length} choices`} />
          <Fact label="Current step" value="ERP → official PDF field filling" />
        </div>
        <p className="mt-3 text-xs font-semibold leading-5 text-emerald-800/80">Only verified/high-confidence AcroForm positions are automated first. Ambiguous generated PDF field names stay manual until visually verified, so ERP data is never written into the wrong box.</p>
      </section> : null}

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_40px_rgba(24,59,110,.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Recommended workflow</p>
            <h2 className="mt-2 text-2xl font-black">Prepare data first, submit on the insurer&apos;s official form</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">The ERP preparation form is a data-capture tool. It is not the insurer&apos;s official claim form. When an official insurer source is available, use that source for final submission.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/claims/universal-form?id=${encodeURIComponent(claim.id)}`} className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-black text-blue-700">Prepare / complete ERP data</Link>
            {officialSource ? <a href={officialSource.url} target="_blank" rel="noreferrer" className="rounded-xl bg-[#0c3c78] px-5 py-3 text-sm font-black text-white">Open original insurer form ↗</a> : <span className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-500">Official source not mapped</span>}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[26px] border border-slate-200 bg-white p-6">
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Claim snapshot</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Fact label="Customer" value={claim.customer_name} />
            <Fact label="Mobile" value={claim.customer_mobile} />
            <Fact label="Claim No." value={claim.claim_number || "Not allotted"} />
            <Fact label="Vehicle" value={claim.registration_number || (line === "motor" ? "Missing" : "Not applicable")} />
            <Fact label="Loss date" value={claim.loss_date} />
            <Fact label="Loss place" value={claim.loss_place} />
          </div>
        </div>
        <div className="rounded-[26px] border border-amber-200 bg-amber-50 p-6">
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-700">Submission control</p>
          <div className="mt-4 space-y-3 text-sm font-bold text-amber-900">
            <p>□ ERP data checked against policy / KYC</p>
            <p>□ Missing insurer-form fields completed</p>
            <p>□ Original insurer form used where available</p>
            <p>□ Customer / claimant signature obtained</p>
            <p>□ Signed final form uploaded to claim documents</p>
          </div>
        </div>
      </section>
    </div>
  </main>;
}

function Loading() {
  return <main className="grid min-h-screen place-items-center bg-[#eef3f8] p-6 text-sm font-bold text-slate-500">Loading official claim workspace…</main>;
}

function StatusCard({ title, value, copy, tone }: { title: string; value: string; copy: string; tone: "good" | "warn" | "neutral" }) {
  const cls = tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-800";
  return <div className={`rounded-[24px] border p-5 ${cls}`}><p className="text-[9px] font-black uppercase tracking-[.16em] opacity-60">{title}</p><p className="mt-2 text-2xl font-black">{value}</p><p className="mt-2 text-xs font-semibold leading-5 opacity-70">{copy}</p></div>;
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  return <div className="rounded-xl bg-white/70 p-3"><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-slate-800">{String(value || "Missing")}</p></div>;
}
