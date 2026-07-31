"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Customer, CustomerPagination, customerApi } from "@/lib/customers";

type Props = {
  customers: Customer[];
  meta?: CustomerPagination;
  onChanged: () => void;
};
type IconName =
  | "search"
  | "users"
  | "car"
  | "shield"
  | "file"
  | "star"
  | "location"
  | "phone"
  | "download"
  | "print"
  | "more"
  | "plus"
  | "ledger"
  | "upload"
  | "trash"
  | "assign"
  | "copy";

export function CustomerTable({ customers, meta, onChanged }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [menu, setMenu] = useState<string>();
  const [message, setMessage] = useState("");
  const [term, setTerm] = useState(params.get("search") ?? "");
  const cities = useMemo(
    () =>
      Array.from(
        new Set(
          customers.map((c) => c.city).filter((x): x is string => Boolean(x)),
        ),
      ).sort(),
    [customers],
  );
  const totals = useMemo(
    () => ({
      vehicles: customers.reduce((n, c) => n + c.vehicles_count, 0),
      policies: customers.reduce((n, c) => n + c.insurance_policies_count, 0),
      rto: customers.reduce((n, c) => n + c.rto_files_count, 0),
      active: customers.filter((c) => c.status === "active").length,
      priority: customers.filter((c) => ["high", "urgent"].includes(c.priority))
        .length,
    }),
    [customers],
  );
  const filtersActive = [
    "search",
    "status",
    "city",
    "priority",
    "sort",
    "direction",
  ].some((key) => params.has(key));
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    next.delete("page");
    router.push(`/customers?${next}`);
  }
  function page(value: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(value));
    router.push(`/customers?${next}`);
  }
  async function exportRows(format: "csv" | "pdf") {
    try {
      setBusy(format);
      await customerApi.export(format, params.toString());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy("");
    }
  }
  async function bulkDelete() {
    if (
      !selected.length ||
      !confirm(`Delete ${selected.length} selected customers?`)
    )
      return;
    try {
      setBusy("delete");
      await customerApi.bulkDelete(selected);
      setSelected([]);
      onChanged();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy("");
    }
  }
  async function assign() {
    if (!selected.length) return;
    const id = prompt("Assign to user UUID");
    if (!id) return;
    try {
      setBusy("assign");
      await customerApi.bulkAssign(selected, id);
      setSelected([]);
      onChanged();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Assignment failed.");
    } finally {
      setBusy("");
    }
  }
  function copy(value: string) {
    void navigator.clipboard.writeText(value);
    setMessage("Mobile number copied.");
    setMenu(undefined);
  }
  const allSelected =
    customers.length > 0 && customers.every((c) => selected.includes(c.id));
  return (
    <div className="mx-auto max-w-[1700px] space-y-5">
      <Hero />
      <section
        aria-label="Customer summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
      >
        <Stat
          icon="users"
          label="Total Customers"
          value={meta?.total ?? customers.length}
          tone="blue"
        />
        <Stat
          icon="star"
          label="Active Customers"
          value={totals.active}
          tone="emerald"
        />
        <Stat
          icon="car"
          label="Total Vehicles"
          value={totals.vehicles}
          tone="violet"
        />
        <Stat
          icon="shield"
          label="Insurance Policies"
          value={totals.policies}
          tone="cyan"
        />
        <Stat icon="file" label="RTO Files" value={totals.rto} tone="amber" />
        <Stat
          icon="star"
          label="High Priority"
          value={totals.priority}
          tone="rose"
        />
      </section>
      {message && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span>{message}</span>
          <button onClick={() => setMessage("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
      <section className="rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_55px_-35px_rgba(15,23,42,.45)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          <label className="relative min-w-[240px] flex-1">
            <Icon
              name="search"
              className="absolute left-3 top-3 h-4 w-4 text-slate-400"
            />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") update("search", term);
              }}
              placeholder="Search name, code or mobile"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <Filter
            label="Status"
            value={params.get("status") ?? ""}
            set={(v) => update("status", v)}
            options={["active", "inactive"]}
          />
          <Filter
            label="City"
            value={params.get("city") ?? ""}
            set={(v) => update("city", v)}
            options={cities}
          />
          <Filter
            label="Priority"
            value={params.get("priority") ?? ""}
            set={(v) => update("priority", v)}
            options={["low", "normal", "high", "urgent"]}
          />
          <Filter
            label="Sort"
            value={params.get("sort") ?? ""}
            set={(v) => update("sort", v)}
            options={[
              "created_at",
              "first_name",
              "customer_code",
              "city",
              "priority",
            ]}
          />
          {filtersActive && (
            <button
              onClick={() => {
                setTerm("");
                router.push("/customers");
              }}
              className="rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3 text-xs">
          <span className="mr-auto font-bold text-slate-600">
            {selected.length
              ? `${selected.length} customer${selected.length > 1 ? "s" : ""} selected`
              : `${meta?.total ?? customers.length} total records`}
          </span>
          <Tool
            icon="download"
            label={busy === "csv" ? "Exporting…" : "Export CSV"}
            click={() => void exportRows("csv")}
            disabled={Boolean(busy)}
          />
          <Tool
            icon="file"
            label={busy === "pdf" ? "Exporting…" : "Export PDF"}
            click={() => void exportRows("pdf")}
            disabled={Boolean(busy)}
          />
          <Tool icon="print" label="Print" click={() => window.print()} />
          <Tool
            icon="assign"
            label="Bulk Assign"
            click={() => void assign()}
            disabled={!selected.length || Boolean(busy)}
          />
          <Tool
            icon="trash"
            label="Bulk Delete"
            click={() => void bulkDelete()}
            disabled={!selected.length || Boolean(busy)}
            danger
          />
        </div>
        {customers.length ? (
          <>
            <div className="hidden overflow-auto lg:block">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-950 text-[11px] uppercase tracking-wider text-slate-300">
                  <tr>
                    <th className="p-4">
                      <input
                        aria-label="Select all customers"
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelected(
                            checked ? customers.map((c) => c.id) : [],
                          );
                        }}
                      />
                    </th>
                    {[
                      "Customer",
                      "Mobile",
                      "City",
                      "Vehicles",
                      "Policies",
                      "RTO Files",
                      "GST",
                      "Priority",
                      "Status",
                      "",
                    ].map((h) => (
                      <th key={h} className="px-3 py-4">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer, index) => (
                    <CustomerRow
                      key={customer.id}
                      customer={customer}
                      striped={index % 2 === 1}
                      checked={selected.includes(customer.id)}
                      select={(checked) =>
                        setSelected((current) =>
                          checked
                            ? Array.from(new Set([...current, customer.id]))
                            : current.filter((id) => id !== customer.id),
                        )
                      }
                      menu={menu === customer.id}
                      toggle={() =>
                        setMenu(menu === customer.id ? undefined : customer.id)
                      }
                      copy={copy}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 p-3 lg:hidden">
              {customers.map((c) => (
                <CustomerCard
                  key={c.id}
                  customer={c}
                  checked={selected.includes(c.id)}
                  select={(checked) =>
                    setSelected((current) =>
                      checked
                        ? [...new Set([...current, c.id])]
                        : current.filter((id) => id !== c.id),
                    )
                  }
                />
              ))}
            </div>
          </>
        ) : (
          <Empty filtered={filtersActive} />
        )}
        <Pagination meta={meta} fallback={customers.length} go={page} />
      </section>
    </div>
  );
}

function Hero() {
  return (
    <header className="relative overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_90%_10%,rgba(34,211,238,.25),transparent_28%),linear-gradient(135deg,#050816,#10245f_58%,#245eea)] p-6 text-white shadow-[0_25px_70px_-35px_rgba(29,78,216,.8)] sm:p-8">
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">
            Relationship intelligence
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Customer CRM
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/75">
            Manage customers, vehicles, insurance, RTO work, GST profiles and
            documents from one premium workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/accounts/ledgers"
            className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold backdrop-blur"
          >
            <Icon name="ledger" className="h-4 w-4" />
            Ledger Master
          </Link>
          <button
            type="button"
            disabled
            title="Customer import API is not available yet"
            className="flex cursor-not-allowed items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/50"
          >
            <Icon name="upload" className="h-4 w-4" />
            Import Customers
          </button>
          <Link
            href="/customers/new"
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-blue-800 shadow-lg"
          >
            <Icon name="plus" className="h-4 w-4" />
            Add Customer
          </Link>
        </div>
      </div>
    </header>
  );
}
function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: IconName;
  label: string;
  value: number;
  tone: string;
}) {
  const colors: Record<string, string> = {
    blue: "from-blue-500 to-indigo-700",
    emerald: "from-emerald-400 to-teal-700",
    violet: "from-violet-400 to-purple-700",
    cyan: "from-cyan-400 to-blue-600",
    amber: "from-amber-300 to-orange-600",
    rose: "from-rose-400 to-pink-700",
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span
        className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${colors[tone]} text-white shadow-md`}
      >
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black">
        {value.toLocaleString("en-IN")}
      </p>
    </article>
  );
}
function Filter({
  label,
  value,
  set,
  options,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => set(e.target.value)}
      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold"
    >
      <option value="">All {label}</option>
      {options.map((x) => (
        <option key={x} value={x}>
          {x.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}
function Tool({
  icon,
  label,
  click,
  disabled = false,
  danger = false,
}: {
  icon: IconName;
  label: string;
  click: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={click}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 font-bold disabled:opacity-40 ${danger ? "border-rose-200 text-rose-600" : "border-slate-200 text-slate-600"}`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
function CustomerRow({
  customer,
  striped,
  checked,
  select,
  menu,
  toggle,
  copy,
}: {
  customer: Customer;
  striped: boolean;
  checked: boolean;
  select: (v: boolean) => void;
  menu: boolean;
  toggle: () => void;
  copy: (v: string) => void;
}) {
  const name = [customer.first_name, customer.middle_name, customer.last_name]
      .filter(Boolean)
      .join(" "),
    initials =
      `${customer.first_name[0] ?? ""}${customer.last_name[0] ?? ""}`.toUpperCase();
  return (
    <tr
      tabIndex={0}
      onDoubleClick={() => (location.href = `/customers/${customer.id}`)}
      className={`border-t border-slate-100 transition hover:bg-blue-50/60 focus:bg-blue-50 focus:outline-none ${striped ? "bg-slate-50/40" : ""}`}
    >
      <td className="p-4">
        <input
          aria-label={`Select ${name}`}
          type="checkbox"
          checked={checked}
          onChange={(e) => select(e.target.checked)}
        />
      </td>
      <td className="px-3 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-700 text-xs font-black text-white">
            {initials}
          </span>
          <div>
            <Link
              href={`/customers/${customer.id}`}
              className="font-black text-slate-900 hover:text-blue-700"
            >
              {name}
            </Link>
            <p className="text-xs text-slate-400">{customer.customer_code}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-4">
        <div className="flex items-center gap-2">
          <Icon name="phone" className="h-4 w-4 text-slate-400" />
          <span>{customer.mobile}</span>
          <button
            onClick={() => copy(customer.mobile)}
            aria-label="Copy mobile"
          >
            <Icon name="copy" className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>
      </td>
      <td className="px-3 py-4">
        <span className="flex items-center gap-1.5">
          <Icon name="location" className="h-4 w-4 text-blue-500" />
          {customer.city || "—"}
        </span>
      </td>
      <td className="px-3">
        <Count value={customer.vehicles_count} tone="blue" />
      </td>
      <td className="px-3">
        <Count value={customer.insurance_policies_count} tone="violet" />
      </td>
      <td className="px-3">
        <Count value={customer.rto_files_count} tone="amber" />
      </td>
      <td className="px-3">
        {customer.gst_number ? (
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
            GST
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-3">
        <Badge value={customer.priority} />
      </td>
      <td className="px-3">
        <Badge value={customer.status} />
      </td>
      <td className="relative px-3">
        <button
          onClick={toggle}
          aria-label="Customer actions"
          className="rounded-lg p-2 hover:bg-slate-100"
        >
          <Icon name="more" className="h-5 w-5" />
        </button>
        {menu && <Actions customer={customer} copy={copy} />}
      </td>
    </tr>
  );
}
function Actions({
  customer,
  copy,
}: {
  customer: Customer;
  copy: (v: string) => void;
}) {
  return (
    <div className="absolute right-4 top-12 z-30 w-48 rounded-xl border bg-white p-1.5 shadow-xl">
      {[
        ["View Profile", `/customers/${customer.id}`],
        ["Edit Customer", `/customers/${customer.id}/edit`],
        ["Timeline", `/customers/${customer.id}/timeline`],
        ["Add Vehicle", `/vehicles/new?customer_id=${customer.id}`],
      ].map(([label, href]) => (
        <Link
          key={label}
          href={href}
          className="block rounded-lg px-3 py-2 text-xs font-semibold hover:bg-blue-50"
        >
          {label}
        </Link>
      ))}
      <button
        onClick={() => copy(customer.mobile)}
        className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-blue-50"
      >
        Copy Mobile
      </button>
    </div>
  );
}
function CustomerCard({
  customer,
  checked,
  select,
}: {
  customer: Customer;
  checked: boolean;
  select: (v: boolean) => void;
}) {
  const name = [customer.first_name, customer.middle_name, customer.last_name]
    .filter(Boolean)
    .join(" ");
  return (
    <article className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <input
          aria-label={`Select ${name}`}
          type="checkbox"
          checked={checked}
          onChange={(e) => select(e.target.checked)}
        />
        <div className="min-w-0 flex-1">
          <Link href={`/customers/${customer.id}`} className="font-black">
            {name}
          </Link>
          <p className="text-xs text-slate-400">{customer.customer_code}</p>
        </div>
        <Badge value={customer.status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <span>{customer.mobile}</span>
        <span>{customer.city || "—"}</span>
        <span>Vehicles: {customer.vehicles_count}</span>
        <span>Policies: {customer.insurance_policies_count}</span>
      </div>
      <div className="mt-4 flex gap-2">
        <Link
          href={`/customers/${customer.id}`}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"
        >
          View
        </Link>
        <Link
          href={`/customers/${customer.id}/edit`}
          className="rounded-lg border px-3 py-2 text-xs font-bold"
        >
          Edit
        </Link>
        <Link
          href={`/customers/${customer.id}/timeline`}
          className="rounded-lg border px-3 py-2 text-xs font-bold"
        >
          Timeline
        </Link>
      </div>
    </article>
  );
}
function Count({ value, tone }: { value: number; tone: string }) {
  const color =
    tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : tone === "violet"
        ? "bg-violet-50 text-violet-700"
        : "bg-amber-50 text-amber-700";
  return (
    <span
      className={`inline-grid min-w-8 place-items-center rounded-full px-2 py-1 text-xs font-black ${color}`}
    >
      {value}
    </span>
  );
}
function Badge({ value }: { value: string }) {
  const color =
    value === "active" || value === "normal"
      ? "bg-emerald-50 text-emerald-700"
      : value === "urgent"
        ? "bg-rose-100 text-rose-700"
        : value === "high"
          ? "bg-amber-100 text-amber-800"
          : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black capitalize ${color}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
function Empty({ filtered }: { filtered: boolean }) {
  return (
    <div className="grid place-items-center px-6 py-20 text-center">
      <span className="grid h-20 w-20 place-items-center rounded-[26px] bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700">
        <Icon name="users" className="h-9 w-9" />
      </span>
      <h2 className="mt-5 text-xl font-black">
        {filtered
          ? "No customers match these filters"
          : "Your customer workspace is ready"}
      </h2>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        {filtered
          ? "Clear the filters or try a broader search."
          : "Add the first customer to start managing vehicles, policies, RTO work and documents."}
      </p>
      <div className="mt-5 flex gap-2">
        {filtered && (
          <Link
            href="/customers"
            className="rounded-xl border px-4 py-2 text-sm font-bold"
          >
            Clear Filters
          </Link>
        )}
        <Link
          href="/customers/new"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
        >
          Add First Customer
        </Link>
      </div>
    </div>
  );
}
function Pagination({
  meta,
  fallback,
  go,
}: {
  meta?: CustomerPagination;
  fallback: number;
  go: (p: number) => void;
}) {
  const current = meta?.current_page ?? 1,
    last = meta?.last_page ?? 1,
    total = meta?.total ?? fallback;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
      <p className="text-slate-500">
        Showing {meta?.from ?? (fallback ? 1 : 0)}–{meta?.to ?? fallback} of{" "}
        <strong className="text-slate-800">{total}</strong>
      </p>
      <div className="flex items-center gap-2">
        <button
          disabled={current <= 1}
          onClick={() => go(current - 1)}
          className="rounded-lg border px-3 py-2 font-bold disabled:opacity-40"
        >
          Previous
        </button>
        <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold">
          Page {current} of {last}
        </span>
        <button
          disabled={current >= last}
          onClick={() => go(current + 1)}
          className="rounded-lg border px-3 py-2 font-bold disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
function Icon({ name, className }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0M16 6a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5" />
      </>
    ),
    car: (
      <>
        <path d="M5 17H3v-5l2-5h14l2 5v5h-2M5 17h14M7 17v3M17 17v3M5 12h14" />
      </>
    ),
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    file: (
      <>
        <path d="M6 2h8l4 4v16H6Z" />
        <path d="M14 2v5h5" />
      </>
    ),
    star: (
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />
    ),
    location: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    phone: (
      <path d="M4 3h4l2 5-3 2a15 15 0 0 0 7 7l2-3 5 2v4a2 2 0 0 1-2 2C9 22 2 15 2 5a2 2 0 0 1 2-2Z" />
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M5 21h14" />
      </>
    ),
    print: (
      <>
        <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5h20v5a2 2 0 0 1-2 2h-2M6 14h12v8H6Z" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    ledger: (
      <>
        <path d="M5 3h14v18H5Z" />
        <path d="M8 7h8M8 11h8M8 15h5" />
      </>
    ),
    upload: (
      <>
        <path d="M12 21V9m-5 5 5-5 5 5M5 3h14" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" />
      </>
    ),
    assign: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0M17 9h5m-2-2 2 2-2 2" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V4H4v12h4" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
