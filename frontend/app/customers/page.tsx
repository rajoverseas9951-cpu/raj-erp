"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
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
    </main>
  );
}
