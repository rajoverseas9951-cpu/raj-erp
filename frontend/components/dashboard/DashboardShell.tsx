"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { can } from "@/lib/dashboard";
import type { DashboardPermission, DashboardSession } from "@/lib/dashboard";
import { BRAND } from "@/config/brand";
import { organizationApi } from "@/lib/organization";
import { authenticatedRequest } from "@/lib/api-client";
import { Icon } from "./Icon";

const navigation: {
  label: string;
  href: string;
  icon: string;
  permission?: DashboardPermission;
  badge?: string;
  section?: string;
}[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "dashboard",
    permission: "dashboard.view",
  },
  {
    label: "Customers",
    href: "/customers",
    icon: "customers",
    permission: "customer.view",
  },
  {
    label: "Vehicles",
    href: "/vehicles",
    icon: "vehicle",
    permission: "vehicle.view",
  },
  { label: "Policies", href: "/policies", icon: "shield" },
  { label: "Claims", href: "/claims", icon: "reports" },
  { label: "Accounts", href: "/accounts", icon: "book" },
  {
    label: "Reports",
    href: "/reports",
    icon: "reports",
    permission: "reports.view",
  },
  { label: "Masters", href: "/masters", icon: "settings" },
  {
    label: "Team & Roles",
    href: "/users",
    icon: "users",
    permission: "users.view",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: "settings",
    permission: "settings.manage",
  },
];
const masterGroups = [
  {
    label: "Master Management",
    items: [{ label: "Open Masters Hub", href: "/masters" }],
  },
];
const masterPaths = [
  "/masters",
  "/insurance-companies",
  "/purchase-sources",
  "/vehicle-manufacturers",
  "/vehicle-models",
  "/vehicle-colours",
  "/vehicle-classes",
  "/vehicle-body-types",
  "/fuel-types",
];

export function DashboardShell({
  session,
  children,
}: {
  session: DashboardSession;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [activeSession, setActiveSession] = useState(session);
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [dark, setDark] = useState(false);
  const [profile, setProfile] = useState(false);
  const [notices, setNotices] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(() =>
    masterPaths.some((x) => path.startsWith(x)),
  );
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const rawUser = sessionStorage.getItem("vimawallah_user");
    if (rawUser) {
      try {
        const user = JSON.parse(rawUser) as { id?:string; name?:string; email?:string; role?:string; roles?:Array<{name?:string}> };
        const name = user.name?.trim() || "Signed-in user";
        const initials = name.split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase() || "U";
        setActiveSession(current => ({...current,user:{id:user.id ?? current.user.id,name,email:user.email ?? current.user.email,role:user.role ?? user.roles?.[0]?.name ?? "User",initials}}));
      } catch { sessionStorage.removeItem("vimawallah_user"); }
    }
    organizationApi.get().then(organization => setActiveSession(current => ({...current,tenant:{...current.tenant,id:organization.id,name:organization.name,shortName:(organization.brand_name ?? organization.name).split(/\s+/).map(part=>part[0]).join("").slice(0,3).toUpperCase(),plan:organization.brand_name ?? organization.name,tagline:organization.tagline??undefined,logoUrl:organization.logo_url}}))).catch(() => undefined);
  }, []);
  useEffect(() => {
    const saved = localStorage.getItem("raj-theme");
    const enabled =
      saved === "dark" ||
      (!saved && matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(enabled);
    document.documentElement.classList.toggle("dark", enabled);
  }, []);
  useEffect(() => {
    function outside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProfile(false);
        setNotices(false);
      }
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);
  function theme() {
    const value = !dark;
    setDark(value);
    document.documentElement.classList.toggle("dark", value);
    localStorage.setItem("raj-theme", value ? "dark" : "light");
  }
  const current = masterPaths.some((x) => path.startsWith(x))
    ? navigation.find((n) => n.label === "Masters")
    : navigation.find((n) => path === n.href || path.startsWith(`${n.href}/`));
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      {mobile && (
        <button
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-slate-950 text-slate-300 transition-all duration-300 ${collapsed ? "lg:w-[76px]" : "lg:w-[260px]"} ${mobile ? "translate-x-0 w-[280px]" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
          {activeSession.tenant.logoUrl?<img src={activeSession.tenant.logoUrl} alt="Organization logo" className="h-10 w-10 shrink-0 rounded-xl object-cover"/>:<div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 font-black text-white shadow-lg shadow-blue-900/40">{activeSession.tenant.plan.slice(0,1)}</div>}
          {!collapsed && (
            <div>
              <strong className="block text-lg tracking-tight text-white">
                {activeSession.tenant.plan}
              </strong>
              <span className="block max-w-40 text-[9px] font-bold uppercase leading-snug tracking-[.12em] text-blue-400">
                {activeSession.tenant.tagline ?? BRAND.tagline}
              </span>
            </div>
          )}
          <button
            onClick={() => setMobile(false)}
            className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-white/10 lg:hidden"
            aria-label="Close menu"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <div className="mx-3 mt-5 rounded-xl border border-white/10 bg-white/[.06] p-3">
          {collapsed ? (
            <div className="mx-auto grid h-9 w-9 place-items-center rounded-lg bg-blue-600 font-bold text-white">
              {activeSession.tenant.shortName}
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-600 font-bold text-white">
                {activeSession.tenant.shortName}
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">
                  {activeSession.tenant.name}
                </p>
                <p className="text-xs text-slate-400">
                  {activeSession.tenant.plan}
                </p>
              </div>
              <Icon name="down" className="ml-auto h-4 w-4" />
            </div>
          )}
        </div>
        <nav
          aria-label="Primary navigation"
          className="mt-6 flex-1 space-y-1 overflow-y-auto px-3"
        >
          {!collapsed && (
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-500">
              Workspace
            </p>
          )}
          {navigation
            .filter((n) => can(activeSession, n.permission))
            .map((n) => {
              const master = n.label === "Masters",
                active = master
                  ? masterPaths.some((x) => path.startsWith(x))
                  : path === n.href || path.startsWith(`${n.href}/`);
              return (
                <div key={n.label}>
                  {master ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          collapsed
                            ? setCollapsed(false)
                            : setMastersOpen(!mastersOpen)
                        }
                        title={collapsed ? "Masters" : undefined}
                        className={`group flex h-11 w-full items-center rounded-xl px-3 transition ${active ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30" : "hover:bg-white/[.07] hover:text-white"} ${collapsed ? "justify-center" : ""}`}
                      >
                        <Icon name={n.icon} className="h-5 w-5 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="ml-3 text-sm font-medium">
                              Masters
                            </span>
                            <Icon
                              name="down"
                              className={`ml-auto h-4 w-4 transition ${mastersOpen ? "rotate-180" : ""}`}
                            />
                          </>
                        )}
                      </button>
                      {!collapsed && mastersOpen && (
                        <div className="ml-4 border-l border-white/10 py-2 pl-3">
                          {masterGroups.map((group) => (
                            <div className="mb-3" key={group.label}>
                              <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {group.label}
                              </p>
                              {group.items.map((item) => (
                                <Link
                                  onClick={() => setMobile(false)}
                                  href={item.href}
                                  key={item.href}
                                  className={`block rounded-lg px-2 py-2 text-xs ${path.startsWith(item.href) ? "bg-white/10 font-bold text-white" : "text-slate-400 hover:bg-white/[.06] hover:text-white"}`}
                                >
                                  {item.label}
                                </Link>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      onClick={() => setMobile(false)}
                      title={collapsed ? n.label : undefined}
                      href={n.href}
                      className={`group flex h-11 items-center rounded-xl px-3 transition ${active ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30" : "hover:bg-white/[.07] hover:text-white"} ${collapsed ? "justify-center" : ""}`}
                    >
                      <Icon name={n.icon} className="h-5 w-5 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="ml-3 text-sm font-medium">
                            {n.label}
                          </span>
                          {n.badge && (
                            <span className="ml-auto rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              {n.badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  )}
                </div>
              );
            })}
        </nav>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden h-14 items-center justify-center border-t border-white/10 text-slate-500 transition hover:text-white lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Icon
            name="chevron"
            className={`h-5 w-5 transition ${collapsed ? "" : "rotate-180"}`}
          />
          {!collapsed && (
            <span className="ml-2 text-xs font-semibold">Collapse sidebar</span>
          )}
        </button>
      </aside>
      <div
        className={`transition-all duration-300 ${collapsed ? "lg:pl-[76px]" : "lg:pl-[260px]"}`}
      >
        <header className="sticky top-0 z-20 flex h-20 items-center border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 sm:px-6 lg:px-8">
          <button
            onClick={() => setMobile(true)}
            className="mr-3 rounded-xl border border-slate-200 p-2.5 lg:hidden dark:border-slate-700"
            aria-label="Open menu"
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <div className="hidden items-center text-sm sm:flex">
            <Link
              href="/dashboard"
              className="text-slate-400 hover:text-blue-600"
            >
              Home
            </Link>
            {current && (
              <>
                <Icon name="chevron" className="mx-2 h-3 w-3 text-slate-300" />
                <span className="font-semibold">{current.label}</span>
              </>
            )}
          </div>
          <div
            className="ml-auto flex items-center gap-1.5 sm:gap-3"
            ref={menuRef}
          >
            <label className="relative hidden xl:block">
              <span className="sr-only">Search</span>
              <Icon
                name="search"
                className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
              />
              <input
                className="w-60 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-800"
                placeholder="Search anything…"
              />
              <kbd className="absolute right-2 top-2 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400 dark:border-slate-700">
                ⌘K
              </kbd>
            </label>
            <button
              onClick={theme}
              className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label={dark ? "Use light mode" : "Use dark mode"}
            >
              <Icon name={dark ? "sun" : "moon"} className="h-5 w-5" />
            </button>
            <div className="relative">
              <button
                onClick={() => {
                  setNotices(!notices);
                  setProfile(false);
                }}
                className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Notifications"
              >
                <Icon name="bell" className="h-5 w-5" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-rose-500 dark:border-slate-900" />
              </button>
              {notices && <NotificationMenu />}
            </div>
            <div className="relative">
              <button
                onClick={() => {
                  setProfile(!profile);
                  setNotices(false);
                }}
                className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-expanded={profile}
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-700 text-xs font-bold text-white">
                  {activeSession.user.initials}
                </span>
                <span className="hidden text-left md:block">
                  <strong className="block max-w-36 truncate text-sm">
                    {activeSession.user.name}
                  </strong>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {activeSession.user.role}
                  </span>
                </span>
                <Icon
                  name="down"
                  className="hidden h-4 w-4 text-slate-400 md:block"
                />
              </button>
              {profile && <ProfileMenu session={activeSession} />}
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

function NotificationMenu() {
  return (
    <div className="absolute right-0 top-14 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
        <div>
          <h2 className="font-bold">Notifications</h2>
          <p className="text-xs text-slate-500">Account activity</p>
        </div>
      </div>
      <p className="p-6 text-center text-sm text-slate-500">No notifications available.</p>
    </div>
  );
}
function Notice({
  icon,
  title,
  copy,
  time,
  color,
}: {
  icon: string;
  title: string;
  copy: string;
  time: string;
  color: string;
}) {
  return (
    <button className="flex w-full gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${color}`}
      >
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <strong className="block text-sm">{title}</strong>
        <span className="block truncate text-xs text-slate-500">{copy}</span>
        <span className="mt-1 block text-[11px] text-slate-400">
          {time} ago
        </span>
      </span>
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
    </button>
  );
}
function ProfileMenu({ session }: { session: DashboardSession }) {
  return (
    <div className="absolute right-0 top-14 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-3 py-3 dark:border-slate-800">
        <p className="font-semibold">{session.user.name}</p>
        <p className="truncate text-xs text-slate-500">{session.user.email}</p>
        <p className="mt-1 text-xs text-slate-400">{session.user.role} · {session.tenant.name}</p>
      </div>
      <Link href="/settings/profile" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"><Icon name="profile" className="h-4 w-4"/>My profile</Link>
      <Link href="/settings/organization" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"><Icon name="settings" className="h-4 w-4"/>Organization settings</Link>
      <Link href="/settings/security" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"><Icon name="shield" className="h-4 w-4"/>Security</Link>
      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
      <button onClick={async()=>{try{await authenticatedRequest("/auth/logout",{method:"POST"});}finally{sessionStorage.removeItem("raj_erp_token");sessionStorage.removeItem("vimawallah_user");location.replace("/login");}}} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Icon name="logout" className="h-4 w-4"/>Sign out</button>
    </div>
  );
}
function MenuButton({
  icon,
  text,
  danger = false,
}: {
  icon: string;
  text: string;
  danger?: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${danger ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
    >
      <Icon name={icon} className="h-4 w-4" />
      {text}
    </button>
  );
}
