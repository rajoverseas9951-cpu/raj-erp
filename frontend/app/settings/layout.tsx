import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { dashboardSession } from "@/lib/dashboard";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell session={dashboardSession}><div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8"><div className="mb-6"><p className="text-xs font-black uppercase tracking-[.18em] text-blue-600">Administration</p><h1 className="mt-1 text-3xl font-black">Settings</h1><nav className="mt-5 flex flex-wrap gap-2"><Link className="rounded-xl border bg-white px-4 py-2 text-sm font-bold" href="/settings/organization">Organization</Link><Link className="rounded-xl border bg-white px-4 py-2 text-sm font-bold" href="/settings/modules">Modules</Link><Link className="rounded-xl border bg-white px-4 py-2 text-sm font-bold" href="/settings/profile">Profile</Link><Link className="rounded-xl border bg-white px-4 py-2 text-sm font-bold" href="/settings/security">Security</Link></nav></div>{children}</div></DashboardShell>;
}
