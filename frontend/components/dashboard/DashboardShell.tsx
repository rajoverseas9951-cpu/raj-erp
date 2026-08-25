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

type NavItem = { label: string; href: string; icon: string; permission?: DashboardPermission };

const navigation: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard", permission: "dashboard.view" },
  { label: "Customers", href: "/customers", icon: "customers", permission: "customer.view" },
  { label: "Vehicles", href: "/vehicles", icon: "vehicle", permission: "vehicle.view" },
  { label: "Driving Licence", href: "/services/driving-licence", icon: "book" },
  { label: "Passport", href: "/services/passport", icon: "book" },
  { label: "Insurance", href: "/insurance", icon: "shield" },
  { label: "Claims", href: "/claims", icon: "reports" },
  { label: "Accounts", href: "/accounts", icon: "book" },
  { label: "Reports", href: "/reports", icon: "reports", permission: "reports.view" },
  { label: "Masters", href: "/masters", icon: "settings" },
  { label: "Team & Roles", href: "/users", icon: "users", permission: "users.view" },
  { label: "Settings", href: "/settings", icon: "settings", permission: "settings.manage" },
];

const insuranceGroups = [
  {
    label: "Insurance Business",
    items: [
      ["Insurance Overview", "/insurance"],
      ["Motor Insurance", "/insurance/motor"],
      ["Non-Motor / Property", "/insurance/non_motor"],
      ["Health Insurance", "/insurance/health"],
      ["Life Insurance", "/insurance/life"],
    ],
  },
] as const;

const accountGroups = [
  {
    label: "Daily Accounts",
    items: [
      ["Accounts Overview", "/accounts"],
      ["Cash & Bank Entry", "/accounts/cash-bank"],
      ["Party Balance", "/accounts/outstanding"],
      ["Insurance Accounts", "/accounts/insurance"],
    ],
  },
  {
    label: "Account Setup",
    items: [
      ["Account Heads", "/accounts/ledgers"],
      ["Opening Balance & Year Lock", "/accounts/setup"],
    ],
  },
  {
    label: "Yearly Accounts",
    items: [
      ["Profit & Loss", "/reports/profit-loss"],
      ["Balance Sheet", "/reports/balance-sheet"],
    ],
  },
] as const;

const reportGroups = [
  {
    label: "Insurance Reports",
    items: [
      ["Expiry Report", "/reports/expiry"],
      ["Insurance Report", "/reports/insurance"],
      ["Commission Report", "/reports/insurance-commission"],
      ["Insurance Due", "/reports/insurance-due"],
    ],
  },
  {
    label: "RTO Reports",
    items: [
      ["RTO Work Report", "/reports/rto-work"],
      ["RTO Profit Report", "/reports/rto-profit"],
      ["HSRP Report", "/reports/hsrp"],
      ["Agent Work Report", "/reports/agent-work"],
    ],
  },
  {
    label: "General Reports",
    items: [
      ["Agent Report", "/reports/agent"],
      ["Broker Report", "/reports/broker"],
      ["Vehicle Report", "/reports/vehicle"],
    ],
  },
] as const;

const masterGroups = [{ label: "Master Management", items: [["Open Masters Hub", "/masters"]] as const }];
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

export function DashboardShell({ session, children }: { session: DashboardSession; children: React.ReactNode }) {
  const path = usePathname();
  const [activeSession, setActiveSession] = useState(session);
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [dark, setDark] = useState(false);
  const [profile, setProfile] = useState(false);
  const [notices, setNotices] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(() => masterPaths.some((x) => path.startsWith(x)));
  const [reportsOpen, setReportsOpen] = useState(() => path.startsWith("/reports"));
  const [accountsOpen, setAccountsOpen] = useState(() => path.startsWith("/accounts"));
  const [insuranceOpen, setInsuranceOpen] = useState(() => path.startsWith("/insurance") || path.startsWith("/policies"));
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("vimawallah_user");
    if (raw) {
      try {
        const user = JSON.parse(raw) as {
          id?: string;
          name?: string;
          email?: string;
          role?: string;
          roles?: Array<{ name?: string }>;
        };
        const name = user.name?.trim() || "Signed-in user";
        const initials = name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "U";
        setActiveSession((cur) => ({
          ...cur,
          user: {
            id: user.id ?? cur.user.id,
            name,
            email: user.email ?? cur.user.email,
            role: user.role ?? user.roles?.[0]?.name ?? "User",
            initials,
          },
        }));
      } catch {
        sessionStorage.removeItem("vimawallah_user");
      }
    }

    organizationApi
      .get()
      .then((org) =>
        setActiveSession((cur) => ({
          ...cur,
          tenant: {
            ...cur.tenant,
            id: org.id,
            name: org.name,
            shortName: (org.brand_name ?? org.name)
              .split(/\s+/)
              .map((p) => p[0])
              .join("")
              .slice(0, 3)
              .toUpperCase(),
            plan: org.brand_name ?? org.name,
            tagline: org.tagline ?? undefined,
            logoUrl: org.logo_url,
          },
        })),
      )
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("raj-theme");
    const enabled = saved === "dark" || (!saved && matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(enabled);
    document.documentElement.classList.toggle("dark", enabled);
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProfile(false);
        setNotices(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  function theme() {
    const value = !dark;
    setDark(value);
    document.documentElement.classList.toggle("dark", value);
    localStorage.setItem("raj-theme", value ? "dark" : "light");
  }

  const current = path.startsWith("/insurance") || path.startsWith("/policies")
    ? navigation.find((n) => n.label === "Insurance")
    : path.startsWith("/accounts")
      ? navigation.find((n) => n.label === "Accounts")
      : path.startsWith("/reports")
        ? navigation.find((n) => n.label === "Reports")
        : masterPaths.some((x) => path.startsWith(x))
          ? navigation.find((n) => n.label === "Masters")
          : navigation.find((n) => path === n.href || path.startsWith(`${n.href}/`));

  const sidebarWidth = collapsed ? "lg:w-[84px]" : "lg:w-[288px]";
  const contentOffset = collapsed ? "lg:pl-[84px]" : "lg:pl-[288px]";

  return (
    <div className="min-h-screen bg-[#f3f6ff] text-[#17233d] transition-colors dark:bg-[#060914] dark:text-slate-100">
      {mobile && (
        <button
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
          className="fixed inset-0 z-30 bg-[#030714]/70 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-white/10 bg-[#071126] text-slate-300 shadow-[20px_0_60px_rgba(4,12,34,.18)] transition-all duration-300 ${sidebarWidth} ${mobile ? "w-[296px] translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(48,100,255,.26),transparent_24%),radial-gradient(circle_at_110%_38%,rgba(120,73,255,.20),transparent_28%),linear-gradient(180deg,rgba(255,255,255,.02),transparent_35%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />

        <div className="relative flex h-[86px] items-center gap-3 px-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-[17px] bg-blue-400/30 blur-lg" />
            {activeSession.tenant.logoUrl ? (
              <img
                src={activeSession.tenant.logoUrl}
                alt="Organization logo"
                className="relative h-11 w-11 shrink-0 rounded-[15px] border border-white/15 bg-white/10 object-cover shadow-[0_8px_24px_rgba(0,0,0,.24)]"
              />
            ) : (
              <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-gradient-to-br from-[#2f6dff] via-[#5079ff] to-[#8757ff] text-sm font-extrabold text-white shadow-[0_12px_26px_rgba(53,91,255,.36)]">
                {activeSession.tenant.plan.slice(0, 1)}
              </div>
            )}
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-[16px] font-semibold tracking-[-.02em] text-white">{activeSession.tenant.plan}</strong>
              <span className="mt-1 block truncate text-[8px] font-bold uppercase tracking-[.2em] text-cyan-300/75">
                {activeSession.tenant.tagline ?? BRAND.tagline}
              </span>
            </div>
          )}

          <button onClick={() => setMobile(false)} className="ml-auto rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {!collapsed && (
          <div className="relative mx-3 rounded-[20px] border border-white/[.08] bg-white/[.055] p-3.5 shadow-[inset_0_1px_rgba(255,255,255,.035)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-[13px] bg-gradient-to-br from-cyan-400/20 to-blue-500/20 text-[10px] font-bold text-cyan-200 ring-1 ring-white/10">
                {activeSession.tenant.shortName}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-white">{activeSession.tenant.name}</p>
                <p className="mt-0.5 truncate text-[9px] text-slate-500">Live workspace</p>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.9)]" />
            </div>
          </div>
        )}

        <nav className="relative mt-5 flex-1 space-y-1 overflow-y-auto px-3 pb-5 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,.18)_transparent]" aria-label="Primary navigation">
          {!collapsed && <p className="mb-2.5 px-3 text-[8px] font-bold uppercase tracking-[.24em] text-slate-600">Workspace</p>}

          {navigation.filter((n) => can(activeSession, n.permission)).map((n) => {
            const isInsurance = n.label === "Insurance";
            const isAccounts = n.label === "Accounts";
            const isReports = n.label === "Reports";
            const isMasters = n.label === "Masters";
            const active = isInsurance
              ? path.startsWith("/insurance") || path.startsWith("/policies")
              : isAccounts
                ? path.startsWith("/accounts")
                : isReports
                  ? path.startsWith("/reports")
                  : isMasters
                    ? masterPaths.some((x) => path.startsWith(x))
                    : path === n.href || path.startsWith(`${n.href}/`);

            const base = `group relative flex h-[46px] w-full items-center rounded-[15px] px-3 transition-all duration-200 ${collapsed ? "justify-center" : ""}`;
            const state = active
              ? "bg-white/[.10] text-white shadow-[0_10px_26px_rgba(0,0,0,.18)] ring-1 ring-white/[.08]"
              : "text-slate-400 hover:bg-white/[.055] hover:text-white";

            if (isInsurance || isAccounts || isReports || isMasters) {
              const open = isInsurance ? insuranceOpen : isAccounts ? accountsOpen : isReports ? reportsOpen : mastersOpen;
              const groups = isInsurance ? insuranceGroups : isAccounts ? accountGroups : isReports ? reportGroups : masterGroups;

              return (
                <div key={n.label}>
                  <button
                    type="button"
                    onClick={() => {
                      if (collapsed) {
                        setCollapsed(false);
                        return;
                      }
                      if (isInsurance) setInsuranceOpen(!insuranceOpen);
                      else if (isAccounts) setAccountsOpen(!accountsOpen);
                      else if (isReports) setReportsOpen(!reportsOpen);
                      else setMastersOpen(!mastersOpen);
                    }}
                    className={`${base} ${state}`}
                    title={collapsed ? n.label : undefined}
                  >
                    {active && <span className="absolute left-0 h-6 w-[3px] rounded-full bg-gradient-to-b from-cyan-300 to-blue-500 shadow-[0_0_10px_rgba(56,189,248,.7)]" />}
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[11px] transition ${active ? "bg-gradient-to-br from-blue-500/30 to-violet-500/25 text-cyan-100" : "bg-white/[.035] text-slate-500 group-hover:text-blue-200"}`}>
                      <Icon name={n.icon} className="h-[17px] w-[17px]" />
                    </span>
                    {!collapsed && (
                      <>
                        <span className="ml-2.5 text-[12px] font-semibold">{n.label}</span>
                        <Icon name="down" className={`ml-auto h-3.5 w-3.5 text-slate-600 transition ${open ? "rotate-180 text-slate-300" : ""}`} />
                      </>
                    )}
                  </button>

                  {!collapsed && open && (
                    <div className="ml-[28px] border-l border-white/[.075] py-2 pl-3">
                      {groups.map((group) => (
                        <div key={group.label} className="mb-3 last:mb-0">
                          <p className="mb-1 px-2 text-[7px] font-bold uppercase tracking-[.18em] text-slate-650">{group.label}</p>
                          {group.items.map(([label, href]) => (
                            <Link
                              key={`${label}-${href}`}
                              href={href}
                              onClick={() => setMobile(false)}
                              className={`relative block rounded-[10px] px-2.5 py-2 text-[10px] font-medium transition ${path === href ? "bg-blue-500/12 text-cyan-200" : "text-slate-500 hover:bg-white/[.05] hover:text-slate-200"}`}
                            >
                              {path === href && <span className="absolute -left-[14px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,.8)]" />}
                              {label}
                            </Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={n.label}
                onClick={() => setMobile(false)}
                href={n.href}
                title={collapsed ? n.label : undefined}
                className={`${base} ${state}`}
              >
                {active && <span className="absolute left-0 h-6 w-[3px] rounded-full bg-gradient-to-b from-cyan-300 to-blue-500 shadow-[0_0_10px_rgba(56,189,248,.7)]" />}
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[11px] transition ${active ? "bg-gradient-to-br from-blue-500/30 to-violet-500/25 text-cyan-100" : "bg-white/[.035] text-slate-500 group-hover:text-blue-200"}`}>
                  <Icon name={n.icon} className="h-[17px] w-[17px]" />
                </span>
                {!collapsed && <span className="ml-2.5 text-[12px] font-semibold">{n.label}</span>}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="relative hidden h-14 items-center justify-center border-t border-white/[.07] text-slate-600 transition hover:bg-white/[.035] hover:text-white lg:flex"
        >
          <Icon name="chevron" className={`h-4 w-4 transition ${collapsed ? "" : "rotate-180"}`} />
          {!collapsed && <span className="ml-2 text-[9px] font-semibold uppercase tracking-[.13em]">Collapse</span>}
        </button>
      </aside>

      <div className={`transition-all duration-300 ${contentOffset}`}>
        <header className="sticky top-0 z-20 flex h-[72px] items-center border-b border-white/70 bg-[#f3f6ff]/78 px-4 shadow-[0_8px_30px_rgba(43,70,125,.045)] backdrop-blur-2xl dark:border-white/[.06] dark:bg-[#080c18]/75 sm:px-6 lg:px-8">
          <button
            onClick={() => setMobile(true)}
            className="mr-3 grid h-10 w-10 place-items-center rounded-[13px] border border-white/80 bg-white/70 text-[#52627d] shadow-sm lg:hidden dark:border-white/10 dark:bg-white/[.05] dark:text-slate-300"
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>

          <div className="hidden items-center gap-2 sm:flex">
            <Link href="/dashboard" className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#94a2b9] transition hover:text-blue-600">Workspace</Link>
            {current && (
              <>
                <Icon name="chevron" className="h-3 w-3 text-[#c2cada]" />
                <span className="rounded-full bg-white/75 px-3 py-1.5 text-[10px] font-semibold text-[#314462] shadow-sm ring-1 ring-white dark:bg-white/[.06] dark:text-slate-200 dark:ring-white/10">{current.label}</span>
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1.5" ref={menuRef}>
            <button
              onClick={theme}
              className="grid h-10 w-10 place-items-center rounded-[13px] text-[#70809a] transition hover:bg-white hover:text-blue-600 hover:shadow-sm dark:text-slate-400 dark:hover:bg-white/[.07] dark:hover:text-cyan-200"
              aria-label="Toggle theme"
            >
              <Icon name={dark ? "sun" : "moon"} className="h-[18px] w-[18px]" />
            </button>

            <div className="relative">
              <button
                onClick={() => { setNotices(!notices); setProfile(false); }}
                className="relative grid h-10 w-10 place-items-center rounded-[13px] text-[#70809a] transition hover:bg-white hover:text-blue-600 hover:shadow-sm dark:text-slate-400 dark:hover:bg-white/[.07] dark:hover:text-cyan-200"
                aria-label="Notifications"
              >
                <Icon name="bell" className="h-[18px] w-[18px]" />
                <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-cyan-400 ring-2 ring-[#f3f6ff] dark:ring-[#080c18]" />
              </button>

              {notices && (
                <div className="absolute right-0 top-12 w-72 overflow-hidden rounded-[20px] border border-white bg-white/95 p-4 shadow-[0_22px_60px_rgba(24,50,100,.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#101728]/95">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-300"><Icon name="bell" className="h-4 w-4" /></span>
                    <div>
                      <h2 className="text-[12px] font-semibold">Notifications</h2>
                      <p className="text-[9px] text-slate-400">Your workspace updates</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl bg-[#f7f9fd] px-3 py-4 text-center text-[10px] text-slate-400 dark:bg-white/[.04]">No notifications available.</div>
                </div>
              )}
            </div>

            <span className="mx-1 hidden h-7 w-px bg-[#dfe5f0] md:block dark:bg-white/10" />

            <div className="relative">
              <button
                onClick={() => { setProfile(!profile); setNotices(false); }}
                className="flex items-center gap-2.5 rounded-[15px] border border-transparent p-1.5 pr-2 transition hover:border-white hover:bg-white/75 hover:shadow-sm dark:hover:border-white/10 dark:hover:bg-white/[.055]"
              >
                <span className="relative grid h-9 w-9 place-items-center rounded-[13px] bg-gradient-to-br from-[#2563eb] via-[#4f6df5] to-[#7c4dff] text-[10px] font-bold text-white shadow-[0_8px_18px_rgba(72,86,235,.24)]">
                  {activeSession.user.initials}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#f3f6ff] bg-emerald-400 dark:border-[#080c18]" />
                </span>
                <span className="hidden text-left md:block">
                  <strong className="block max-w-40 truncate text-[11px] font-semibold text-[#243652] dark:text-white">{activeSession.user.name}</strong>
                  <span className="mt-0.5 block text-[8px] font-medium uppercase tracking-[.1em] text-[#9aa7bb]">{activeSession.user.role}</span>
                </span>
                <Icon name="down" className="hidden h-3.5 w-3.5 text-[#9ba8bb] md:block" />
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

function ProfileMenu({ session }: { session: DashboardSession }) {
  return (
    <div className="absolute right-0 top-12 w-64 overflow-hidden rounded-[20px] border border-white bg-white/95 p-2 shadow-[0_22px_60px_rgba(24,50,100,.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#101728]/95">
      <div className="rounded-[15px] bg-gradient-to-br from-blue-50 to-violet-50 px-3 py-3 dark:from-blue-950/30 dark:to-violet-950/20">
        <p className="text-[12px] font-semibold text-[#243652] dark:text-white">{session.user.name}</p>
        <p className="mt-1 truncate text-[9px] text-[#8d9bb0]">{session.user.email}</p>
      </div>
      <Link href="/settings/profile" className="mt-1 flex items-center gap-3 rounded-[13px] px-3 py-2.5 text-[11px] font-semibold text-[#4d5e78] transition hover:bg-[#f5f8fd] dark:text-slate-300 dark:hover:bg-white/[.05]">
        <Icon name="profile" className="h-4 w-4" /> My profile
      </Link>
      <Link href="/settings/organization" className="flex items-center gap-3 rounded-[13px] px-3 py-2.5 text-[11px] font-semibold text-[#4d5e78] transition hover:bg-[#f5f8fd] dark:text-slate-300 dark:hover:bg-white/[.05]">
        <Icon name="settings" className="h-4 w-4" /> Organization settings
      </Link>
      <div className="my-1 border-t border-[#edf1f7] dark:border-white/10" />
      <button
        onClick={async () => {
          try {
            await authenticatedRequest("/auth/logout", { method: "POST" });
          } finally {
            sessionStorage.removeItem("raj_erp_token");
            sessionStorage.removeItem("vimawallah_user");
            location.replace("/login");
          }
        }}
        className="flex w-full items-center gap-3 rounded-[13px] px-3 py-2.5 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
      >
        <Icon name="logout" className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}
