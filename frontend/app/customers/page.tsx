"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CustomerTable } from "@/components/customers/CustomerTable";
import { Customer, CustomerPagination, customerApi } from "@/lib/customers";

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <main className="p-6">
          <div className="rounded-xl border bg-white p-6">
            Loading customers...
          </div>
        </main>
      }
    >
      <CustomersContent />
    </Suspense>
  );
}

function CustomersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meta, setMeta] = useState<CustomerPagination>();
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = sessionStorage.getItem("raj_erp_token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    const query = searchParams.toString();
    setLoading(true);
    setError("");

    customerApi
      .list(query ? `?${query}` : "")
      .then((response) => {
        setCustomers(response.data ?? []);
        setMeta(response.meta);
      })
      .catch((requestError) => {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Customers load nahi hue.";
        setError(message);
        if (/unauthenticated/i.test(message)) {
          sessionStorage.removeItem("raj_erp_token");
          window.location.href = "/login";
        }
      })
      .finally(() => setLoading(false));
  }, [searchParams, reload]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8 lg:pb-28">
      {loading && (
        <div className="rounded-xl border bg-white p-6">
          Loading customers...
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}
      {!loading && !error && (
        <CustomerTable
          customers={customers}
          meta={meta}
          onChanged={() => setReload((value) => value + 1)}
        />
      )}

      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        className="fixed bottom-6 right-6 z-[70] inline-flex items-center gap-3 rounded-[22px] border border-[#dbe5f2] bg-white px-5 py-4 text-sm font-black text-[#173b76] shadow-[0_18px_50px_rgba(7,26,60,.18)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(7,26,60,.22)]"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#0b2f6b] to-[#2563eb] text-white">←</span>
        Dashboard
      </button>
    </main>
  );
}
