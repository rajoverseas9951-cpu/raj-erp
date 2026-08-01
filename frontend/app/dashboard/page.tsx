"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/dashboard/Icon";
import { DashboardSummary, getDashboardSummary } from "@/lib/dashboard-api";
import { dashboardSession } from "@/lib/dashboard";
import { BRAND } from "@/config/brand";

const kpis = [
  [
    "customers",
    "Total Customers",
    "customers",
    false,
    "from-cyan-400 to-blue-600",
  ],
  [
    "vehicles",
    "Active Vehicles",
    "vehicle",
    false,
    "from-violet-400 to-indigo-700",
  ],
  [
    "active_policies",
    "Active Policies",
    "shield",
    false,
    "from-emerald-400 to-teal-700",
  ],
  [
    "expiring_policies",
    "Expiring Soon",
    "clock",
    false,
    "from-amber-300 to-orange-600",
  ],
  [
    "outstanding_receivable",
    "Outstanding Receivable",
    "rupee",
    true,
    "from-rose-400 to-pink-700",
  ],
  [
    "monthly_revenue",
    "Monthly Revenue",
    "reports",
    true,
    "from-blue-400 to-indigo-700",
  ],
  [
    "gross_commission",
    "Gross Commission",
    "wallet",
    true,
    "from-fuchsia-400 to-purple-700",
  ],
  [
    "pending_rto",
    "Pending RTO Work",
    "building",
    false,
    "from-sky-400 to-cyan-700",
  ],
] as const;
const quick = [
  ["Add Customer", "/customers/new", "customers", "from-cyan-300 to-blue-600"],
  ["Add Vehicle", "/vehicles/new", "vehicle", "from-blue-400 to-indigo-700"],
  ["Add Policy", "/vehicles", "shield", "from-violet-400 to-purple-700"],
  ["Add Payment", "/accounts", "credit", "from-amber-200 to-amber-500"],
  ["Add RTO Work", "/vehicles", "building", "from-cyan-400 to-teal-600"],
  ["Add Expense", "/accounts", "wallet", "from-indigo-400 to-violet-700"],
  ["Open Masters", "/masters", "grid", "from-blue-300 to-cyan-600"],
];
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    notation: value >= 100000 ? "compact" : "standard",
  }).format(value);
export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary>();
  const [error, setError] = useState("");
  useEffect(() => {
    getDashboardSummary()
      .then(setData)
      .catch((e) => {
        if (e instanceof Error && e.message === "AUTH_REQUIRED") {
          sessionStorage.removeItem("raj_erp_token");
          location.replace("/login?next=/dashboard");
          return;
        }
        setError(e instanceof Error ? e.message : "Dashboard could not load.");
      });
  }, []);
  const date = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return (
    <div className="mx-auto max-w-[1680px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_85%_15%,rgba(35,211,255,.28),transparent_26%),radial-gradient(circle_at_8%_90%,rgba(124,58,237,.25),transparent_30%),linear-gradient(135deg,#030712_0%,#0b153b_48%,#163da4_100%)] p-6 text-white shadow-[0_28px_80px_-32px_rgba(15,47,150,.8)] sm:p-8">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-200">
              {date}
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-[-.04em] sm:text-5xl">
              Your business.
              <br />
              <span className="bg-gradient-to-r from-cyan-300 via-blue-200 to-violet-300 bg-clip-text text-transparent">
                In complete control.
              </span>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-blue-100/70">
              Live policy, revenue, renewal and operations intelligence for {BRAND.productName}.
            </p>
          </div>
          <select
            aria-label="Branch"
            className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold shadow-inner backdrop-blur-xl"
          >
            <option className="text-slate-900">All branches</option>
          </select>
        </div>
      </section>
      <QuickActions />
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
          {error}
        </div>
      )}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([key, label, icon, isMoney, tone]) => {
          const item = data?.kpis[key];
          return (
            <article
              key={key}
              className="group relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_45px_-30px_rgba(15,23,42,.45)] transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
            >
              <div
                className={`absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${tone} opacity-[.08] blur-xl transition group-hover:opacity-20`}
              />
              <div className="relative flex items-center justify-between">
                <span
                  className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-lg`}
                >
                  <Icon name={icon} className="h-5 w-5" />
                </span>
                {item && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-black ${item.growth >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}
                  >
                    {item.growth >= 0 ? "↗" : "↘"} {Math.abs(item.growth)}%
                  </span>
                )}
              </div>
              <p className="relative mt-5 text-xs font-bold uppercase tracking-wider text-slate-400">
                {label}
              </p>
              <p className="relative mt-1 text-2xl font-black tracking-tight">
                {item ? (
                  isMoney ? (
                    money(item.value)
                  ) : (
                    item.value.toLocaleString("en-IN")
                  )
                ) : (
                  <span className="inline-block h-7 w-24 animate-pulse rounded bg-slate-100" />
                )}
              </p>
            </article>
          );
        })}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Revenue overview" copy="Six-month customer-pay trend">
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              ["This month", data?.revenue.current],
              ["Previous", data?.revenue.previous],
              ["Outstanding", data?.revenue.outstanding],
            ].map(([l, v]) => (
              <div
                key={String(l)}
                className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"
              >
                <p className="text-xs text-slate-500">{l}</p>
                <p className="mt-1 font-black">{money(Number(v ?? 0))}</p>
              </div>
            ))}
          </div>
          <Trend rows={data?.revenue.trend ?? []} />
        </Panel>
        <Panel title="Renewal pipeline" copy="Policies requiring attention">
          <div className="mt-5 space-y-3">
            {[
              ["Next 7 days", "7"],
              ["Next 15 days", "15"],
              ["Next 30 days", "30"],
              ["Expired", "expired"],
              ["Renewed", "renewed"],
            ].map(([label, key], i) => (
              <Meter
                key={key}
                label={label}
                value={data?.renewals[key] ?? 0}
                tone={i === 3 ? "rose" : i === 4 ? "emerald" : "blue"}
              />
            ))}
          </div>
        </Panel>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Policy performance"
          copy="Portfolio mix from saved policies"
        >
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries({
              New: "new",
              Renewals: "renewals",
              Comprehensive: "comprehensive",
              "Third party": "third_party",
              "Two-wheeler": "two_wheeler",
              "Private car": "private_car",
              Commercial: "commercial",
            }).map(([label, key]) => (
              <Mini key={key} label={label} value={data?.policies[key] ?? 0} />
            ))}
          </div>
        </Panel>
        <Panel title="Work status" copy="Operational follow-ups">
          <div className="mt-5 grid grid-cols-2 gap-3">
            {Object.entries({
              "PUC due": "puc_due",
              "Fitness due": "fitness_due",
              "Permit due": "permit_due",
              "Payment follow-up": "payment_follow_up",
            }).map(([label, key]) => (
              <Mini key={key} label={label} value={data?.work[key] ?? 0} />
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
function QuickActions() {
  return (
    <section className="-mt-1">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-blue-600">
            Move faster
          </p>
          <h2 className="mt-1 text-xl font-black">Quick actions</h2>
        </div>
        <Link href="/masters" className="text-xs font-bold text-blue-600">
          All tools →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {quick.map(([label, href, icon, tone], index) => (
          <Link
            key={label}
            href={href}
            className="group relative min-h-48 overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,#050816,#0c1430_58%,#111d42)] p-4 text-white shadow-[0_20px_45px_-24px_rgba(2,8,23,.85)] transition duration-300 hover:-translate-y-1.5 hover:border-cyan-300/30 hover:shadow-[0_26px_55px_-25px_rgba(30,64,175,.75)]"
          >
            <span
              className={`absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${tone} opacity-20 blur-2xl transition group-hover:opacity-40`}
            />
            <span
              className={`relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-[0_10px_30px_-10px_rgba(59,130,246,.9)] transition group-hover:scale-110 group-hover:rotate-3`}
            >
              <Icon
                name={icon}
                className={`h-5 w-5 ${index === 3 ? "text-slate-950" : ""}`}
              />
            </span>
            <p className="relative mt-5 text-sm font-black tracking-tight">
              {label}
            </p>
            <span className="relative mt-3 block text-[10px] font-bold uppercase tracking-[.14em] text-slate-500 transition group-hover:text-cyan-300">
              Open workspace →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
function Panel({
  title,
  copy,
  children,
}: {
  title: string;
  copy: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <h2 className="font-black">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{copy}</p>
      {children}
    </article>
  );
}
function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black">{value.toLocaleString("en-IN")}</p>
    </div>
  );
}
function Meter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  const color =
    tone === "rose"
      ? "bg-rose-500"
      : tone === "emerald"
        ? "bg-emerald-500"
        : "bg-blue-600";
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${color}`}
          style={{
            width: `${Math.min(100, value ? Math.max(8, value * 5) : 0)}%`,
          }}
        />
      </div>
    </div>
  );
}
function Trend({ rows }: { rows: { month: string; revenue: number }[] }) {
  const max = Math.max(1, ...rows.map((x) => x.revenue));
  return (
    <div className="mt-6 flex h-44 items-end gap-3">
      {rows.map((row) => (
        <div
          key={row.month}
          className="flex h-full flex-1 flex-col justify-end text-center"
        >
          <div
            title={money(row.revenue)}
            className="min-h-1 rounded-t-lg bg-gradient-to-t from-blue-700 to-cyan-400"
            style={{ height: `${Math.max(3, (row.revenue / max) * 100)}%` }}
          />
          <span className="mt-2 text-[11px] text-slate-400">{row.month}</span>
        </div>
      ))}
    </div>
  );
}
