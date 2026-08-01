import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-950">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">404</p>
        <h1 className="mt-3 text-2xl font-bold">Page not found</h1>
        <p className="mt-3 text-sm text-slate-600">
          The page may have moved, or you may not have access to it.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}
