'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-950">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-rose-600">Application error</p>
        <h1 className="mt-3 text-2xl font-bold">This page could not be displayed.</h1>
        <p className="mt-3 text-sm text-slate-600">
          Please retry the request. If it continues to fail, return to the dashboard.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold hover:bg-slate-50"
          >
            Dashboard
          </a>
        </div>
      </section>
    </main>
  );
}
