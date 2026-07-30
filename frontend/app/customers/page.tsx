'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CustomerTable } from '@/components/customers/CustomerTable';
import { Customer, customerApi } from '@/lib/customers';

export default function CustomersPage() {
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('raj_erp_token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    const query = searchParams.toString();
    setLoading(true);
    setError('');

    customerApi
      .list(query ? `?${query}` : '')
      .then((response) => setCustomers(response.data ?? []))
      .catch((requestError) => {
        const message = requestError instanceof Error ? requestError.message : 'Customers load nahi hue.';
        setError(message);
        if (/unauthenticated/i.test(message)) {
          sessionStorage.removeItem('raj_erp_token');
          window.location.href = '/login';
        }
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customer CRM</h1>
          <p className="text-slate-500">Enterprise customer master with insurance, RTO, GST and document context.</p>
        </div>
        <a href="/customers/new" className="rounded-md bg-blue-700 px-4 py-2 text-white">Add Customer</a>
      </div>

      {loading && <div className="rounded-xl border bg-white p-6">Loading customers...</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
      {!loading && !error && <CustomerTable customers={customers} />}
    </main>
  );
}
