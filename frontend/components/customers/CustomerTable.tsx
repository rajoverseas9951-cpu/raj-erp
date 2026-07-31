'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Customer, customerApi } from '@/lib/customers';

export function CustomerTable({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState(searchParams.get('search') ?? '');
  const [working, setWorking] = useState(false);

  const stats = useMemo(() => {
    const active = customers.filter((customer) => customer.status === 'active').length;
    const vehicles = customers.reduce((sum, customer) => sum + Number(customer.vehicles_count || 0), 0);
    const policies = customers.reduce(
      (sum, customer) => sum + Number(customer.insurance_policies_count || 0),
      0,
    );

    return { total: customers.length, active, vehicles, policies };
  }, [customers]);

  function submitSearch() {
    const params = new URLSearchParams(searchParams.toString());
    if (searchValue.trim()) params.set('search', searchValue.trim());
    else params.delete('search');
    router.push(`/customers?${params.toString()}`);
  }

  function sort(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    const currentKey = params.get('sort');
    const currentDirection = params.get('direction') ?? 'asc';
    params.set('sort', key);
    params.set(
      'direction',
      currentKey === key && currentDirection === 'asc' ? 'desc' : 'asc',
    );
    router.push(`/customers?${params.toString()}`);
  }

  async function bulkDelete() {
    if (!selected.length) {
      alert('Pehle customer select karo.');
      return;
    }

    if (!confirm(`${selected.length} selected customer delete karne hain?`)) return;

    setWorking(true);
    try {
      await customerApi.bulkDelete(selected);
      setSelected([]);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Customers delete nahi hue.');
    } finally {
      setWorking(false);
    }
  }

  async function bulkAssign() {
    if (!selected.length) {
      alert('Pehle customer select karo.');
      return;
    }

    const assignedTo = prompt('Assign karne wale user ka UUID enter karo');
    if (!assignedTo) return;

    setWorking(true);
    try {
      await customerApi.bulkAssign(selected, assignedTo);
      setSelected([]);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Customers assign nahi hue.');
    } finally {
      setWorking(false);
    }
  }

  const allSelected = customers.length > 0 && selected.length === customers.length;

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Customers" value={stats.total} note="Customer master records" tone="blue" />
        <StatCard label="Active Customers" value={stats.active} note="Currently active accounts" tone="emerald" />
        <StatCard label="Linked Vehicles" value={stats.vehicles} note="Across visible customers" tone="violet" />
        <StatCard label="Insurance Policies" value={stats.policies} note="Policy records linked" tone="amber" />
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)]">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-5 py-5 text-white md:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-300">Customer Intelligence</p>
              <h2 className="mt-1 text-xl font-bold">Customer Directory</h2>
              <p className="mt-1 text-sm text-slate-300">Search, manage and open complete customer records from one place.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href="/customers/ledger" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                Ledger Master
              </a>
              <a href="/customers/new" className="rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400">
                + Add Customer
              </a>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 p-4 lg:flex-row lg:items-center lg:justify-between md:p-5">
          <div className="flex w-full max-w-xl items-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
            <span className="px-4 text-slate-400">⌕</span>
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitSearch();
              }}
              placeholder="Search by name, mobile, city or customer ID..."
              className="min-w-0 flex-1 border-0 bg-transparent px-0 py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button type="button" onClick={submitSearch} className="m-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Search
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <a className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700" href="/api/v1/customers/export">
              Export Excel
            </a>
            <a className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700" href="/api/v1/customers/export?format=pdf">
              Export PDF
            </a>
            <button type="button" onClick={() => window.print()} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700">
              Print
            </button>
          </div>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-col gap-3 border-b border-blue-200 bg-blue-50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-blue-900">{selected.length} customer selected</p>
            <div className="flex flex-wrap gap-2">
              <button disabled={working} onClick={bulkAssign} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Bulk Assign
              </button>
              <button disabled={working} onClick={bulkDelete} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Bulk Delete
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-xs font-bold uppercase tracking-wider text-slate-500">
                <th className="w-14 px-5 py-4">
                  <input
                    aria-label="Select all customers"
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => setSelected(event.currentTarget.checked ? customers.map((customer) => customer.id) : [])}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                </th>
                <SortableHead label="Customer" sortKey="customer_code" onSort={sort} />
                <SortableHead label="Contact" sortKey="mobile" onSort={sort} />
                <SortableHead label="Location" sortKey="city" onSort={sort} />
                <SortableHead label="Vehicles" sortKey="vehicles_count" onSort={sort} centered />
                <SortableHead label="Policies" sortKey="insurance_policies_count" onSort={sort} centered />
                <SortableHead label="RTO Files" sortKey="rto_files_count" onSort={sort} centered />
                <SortableHead label="GST" sortKey="gst_number" onSort={sort} />
                <SortableHead label="Status" sortKey="status" onSort={sort} />
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {customers.map((customer) => {
                const fullName = [customer.first_name, customer.middle_name, customer.last_name].filter(Boolean).join(' ');
                const initials = [customer.first_name, customer.last_name]
                  .filter(Boolean)
                  .map((name) => String(name).charAt(0).toUpperCase())
                  .join('')
                  .slice(0, 2);
                const isSelected = selected.includes(customer.id);

                return (
                  <tr key={customer.id} className={`group transition ${isSelected ? 'bg-blue-50/80' : 'bg-white hover:bg-slate-50/80'}`}>
                    <td className="px-5 py-4">
                      <input
                        aria-label={`Select ${fullName}`}
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked;
                          setSelected((current) => checked ? [...new Set([...current, customer.id])] : current.filter((id) => id !== customer.id));
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-bold text-white shadow-sm">
                          {initials || 'CU'}
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-[260px] truncate font-bold text-slate-900">{fullName || 'Unnamed Customer'}</p>
                          <p className="mt-0.5 font-mono text-xs text-slate-500">{customer.customer_code}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">{customer.mobile || '—'}</p>
                      <p className="mt-0.5 max-w-[180px] truncate text-xs text-slate-400">{customer.email || 'No email added'}</p>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-700">{customer.city || '—'}</p>
                      <p className="mt-0.5 text-xs text-slate-400">Customer location</p>
                    </td>

                    <MetricCell value={customer.vehicles_count} />
                    <MetricCell value={customer.insurance_policies_count} />
                    <MetricCell value={customer.rto_files_count} />

                    <td className="px-5 py-4">
                      <span className="max-w-[160px] truncate font-mono text-xs text-slate-600">{customer.gst_number || '—'}</span>
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={customer.status} />
                    </td>

                    <td className="px-5 py-4 text-right">
                      <a href={`/customers/${customer.id}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50">
                        View Profile <span aria-hidden>→</span>
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!customers.length && (
          <div className="px-6 py-20 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl">👤</div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">No customers found</h3>
            <p className="mt-1 text-sm text-slate-500">Search badlo ya naya customer add karo.</p>
            <a href="/customers/new" className="mt-5 inline-flex rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white">Add First Customer</a>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p><span className="font-bold text-slate-900">{customers.length}</span> customer records visible</p>
          <p>Use column headings to sort records</p>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, note, tone }: { label: string; value: number; note: string; tone: 'blue' | 'emerald' | 'violet' | 'amber' }) {
  const tones = {
    blue: 'from-blue-600 to-indigo-700 shadow-blue-200/60',
    emerald: 'from-emerald-500 to-teal-700 shadow-emerald-200/60',
    violet: 'from-violet-600 to-purple-700 shadow-violet-200/60',
    amber: 'from-amber-500 to-orange-600 shadow-amber-200/60',
  };

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${tones[tone]} p-5 text-white shadow-xl`}>
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
      <div className="absolute -bottom-12 right-8 h-24 w-24 rounded-full bg-white/10" />
      <p className="relative text-sm font-semibold text-white/80">{label}</p>
      <p className="relative mt-2 text-3xl font-black tracking-tight">{value.toLocaleString('en-IN')}</p>
      <p className="relative mt-2 text-xs text-white/70">{note}</p>
    </div>
  );
}

function SortableHead({ label, sortKey, onSort, centered = false }: { label: string; sortKey: string; onSort: (key: string) => void; centered?: boolean }) {
  return (
    <th className={`px-5 py-4 ${centered ? 'text-center' : ''}`}>
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1.5 transition hover:text-blue-700">
        {label} <span className="text-slate-300">↕</span>
      </button>
    </th>
  );
}

function MetricCell({ value }: { value: number }) {
  return (
    <td className="px-5 py-4 text-center">
      <span className="inline-flex min-w-9 items-center justify-center rounded-xl bg-slate-100 px-2.5 py-1.5 font-bold text-slate-700">{Number(value || 0)}</span>
    </td>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = String(status || 'inactive').toLowerCase();
  const styles = normalized === 'active'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : normalized === 'blocked'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-slate-200 bg-slate-100 text-slate-600';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${styles}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {normalized}
    </span>
  );
}
