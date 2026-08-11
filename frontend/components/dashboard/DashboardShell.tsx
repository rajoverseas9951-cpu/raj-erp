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

type NavItem={label:string;href:string;icon:string;permission?:DashboardPermission};
const navigation:NavItem[]=[
  {label:"Dashboard",href:"/dashboard",icon:"dashboard",permission:"dashboard.view"},
  {label:"Customers",href:"/customers",icon:"customers",permission:"customer.view"},
  {label:"Vehicles",href:"/vehicles",icon:"vehicle",permission:"vehicle.view"},
  {label:"Policies",href:"/policies",icon:"shield"},
  {label:"Claims",href:"/claims",icon:"reports"},
  {label:"Accounts",href:"/accounts",icon:"book"},
  {label:"Reports",href:"/reports",icon:"reports",permission:"reports.view"},
  {label:"Masters",href:"/masters",icon:"settings"},
  {label:"Team & Roles",href:"/users",icon:"users",permission:"users.view"},
  {label:"Settings",href:"/settings",icon:"settings",permission:"settings.manage"},
];

const accountGroups=[
  {label:"Daily Accounts",items:[
    ["Accounts Overview","/accounts"],
    ["Party / Ledger Balance","/accounts/ledgers"],
    ["Cash / Bank Entry","/accounts#voucher"],
    ["Insurance Accounts","/accounts/insurance"],
  ]},
  {label:"Yearly Accounts",items:[
    ["Profit & Loss","/reports/profit-loss"],
    ["Balance Sheet","/reports/balance-sheet"],
  ]},
] as const;

const reportGroups=[
  {label:"Insurance Reports",items:[
    ["Expiry Report","/reports/expiry"],
    ["Insurance Report","/reports/insurance"],
    ["Commission Report","/reports/insurance-commission"],
    ["Insurance Due","/reports/insurance-due"],
  ]},
  {label:"RTO Reports",items:[
    ["RTO Work Report","/reports/rto-work"],
    ["RTO Profit Report","/reports/rto-profit"],
    ["HSRP Report","/reports/hsrp"],
    ["Agent Work Report","/reports/agent-work"],
  ]},
  {label:"General Reports",items:[
    ["Agent Report","/reports/agent"],
    ["Broker Report","/reports/broker"],
    ["Vehicle Report","/reports/vehicle"],
  ]},
] as const;

const masterGroups=[{label:"Master Management",items:[["Open Masters Hub","/masters"]] as const}];
const masterPaths=["/masters","/insurance-companies","/purchase-sources","/vehicle-manufacturers","/vehicle-models","/vehicle-colours","/vehicle-classes","/vehicle-body-types","/fuel-types"];

export function DashboardShell({session,children}:{session:DashboardSession;children:React.ReactNode}){
  const path=usePathname();
  const [activeSession,setActiveSession]=useState(session);
  const [collapsed,setCollapsed]=useState(false); const [mobile,setMobile]=useState(false); const [dark,setDark]=useState(false);
  const [profile,setProfile]=useState(false); const [notices,setNotices]=useState(false);
  const [mastersOpen,setMastersOpen]=useState(()=>masterPaths.some(x=>path.startsWith(x)));
  const [reportsOpen,setReportsOpen]=useState(()=>path.startsWith('/reports'));
  const [accountsOpen,setAccountsOpen]=useState(()=>path.startsWith('/accounts'));
  const menuRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const raw=sessionStorage.getItem("vimawallah_user");
    if(raw){try{const user=JSON.parse(raw) as {id?:string;name?:string;email?:string;role?:string;roles?:Array<{name?:string}>};const name=user.name?.trim()||"Signed-in user";const initials=name.split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase()||'U';setActiveSession(cur=>({...cur,user:{id:user.id??cur.user.id,name,email:user.email??cur.user.email,role:user.role??user.roles?.[0]?.name??'User',initials}}));}catch{sessionStorage.removeItem('vimawallah_user')}}
    organizationApi.get().then(org=>setActiveSession(cur=>({...cur,tenant:{...cur.tenant,id:org.id,name:org.name,shortName:(org.brand_name??org.name).split(/\s+/).map(p=>p[0]).join('').slice(0,3).toUpperCase(),plan:org.brand_name??org.name,tagline:org.tagline??undefined,logoUrl:org.logo_url}}))).catch(()=>undefined);
  },[]);
  useEffect(()=>{const saved=localStorage.getItem('raj-theme');const enabled=saved==='dark'||(!saved&&matchMedia('(prefers-color-scheme: dark)').matches);setDark(enabled);document.documentElement.classList.toggle('dark',enabled)},[]);
  useEffect(()=>{const fn=(e:MouseEvent)=>{if(menuRef.current&&!menuRef.current.contains(e.target as Node)){setProfile(false);setNotices(false)}};document.addEventListener('mousedown',fn);return()=>document.removeEventListener('mousedown',fn)},[]);
  function theme(){const value=!dark;setDark(value);document.documentElement.classList.toggle('dark',value);localStorage.setItem('raj-theme',value?'dark':'light')}
  const current=path.startsWith('/accounts')?navigation.find(n=>n.label==='Accounts'):path.startsWith('/reports')?navigation.find(n=>n.label==='Reports'):masterPaths.some(x=>path.startsWith(x))?navigation.find(n=>n.label==='Masters'):navigation.find(n=>path===n.href||path.startsWith(`${n.href}/`));

  return <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
    {mobile&&<button aria-label="Close navigation" onClick={()=>setMobile(false)} className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"/>}
    <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-[#050a19] text-slate-300 shadow-2xl transition-all duration-300 ${collapsed?'lg:w-[76px]':'lg:w-[280px]'} ${mobile?'w-[290px] translate-x-0':'-translate-x-full lg:translate-x-0'}`}>
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
        {activeSession.tenant.logoUrl?<img src={activeSession.tenant.logoUrl} alt="Organization logo" className="h-10 w-10 shrink-0 rounded-xl object-cover"/>:<div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 font-black text-white">{activeSession.tenant.plan.slice(0,1)}</div>}
        {!collapsed&&<div className="min-w-0"><strong className="block truncate text-lg text-white">{activeSession.tenant.plan}</strong><span className="block truncate text-[9px] font-black uppercase tracking-[.16em] text-blue-400">{activeSession.tenant.tagline??BRAND.tagline}</span></div>}
        <button onClick={()=>setMobile(false)} className="ml-auto rounded-lg p-2 lg:hidden"><Icon name="close" className="h-5 w-5"/></button>
      </div>
      {!collapsed&&<div className="mx-3 mt-4 rounded-2xl border border-white/10 bg-white/[.05] p-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 font-black text-white">{activeSession.tenant.shortName}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{activeSession.tenant.name}</p><p className="truncate text-xs text-slate-500">{activeSession.tenant.plan}</p></div></div></div>}
      <nav className="mt-5 flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Primary navigation">
        {!collapsed&&<p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[.2em] text-slate-600">Workspace</p>}
        {navigation.filter(n=>can(activeSession,n.permission)).map(n=>{
          const isAccounts=n.label==='Accounts',isReports=n.label==='Reports',isMasters=n.label==='Masters';
          const active=isAccounts?path.startsWith('/accounts'):isReports?path.startsWith('/reports'):isMasters?masterPaths.some(x=>path.startsWith(x)):path===n.href||path.startsWith(`${n.href}/`);
          if(isAccounts||isReports||isMasters){
            const open=isAccounts?accountsOpen:isReports?reportsOpen:mastersOpen;
            const groups=isAccounts?accountGroups:isReports?reportGroups:masterGroups;
            return <div key={n.label}>
              <button type="button" onClick={()=>{if(collapsed){setCollapsed(false);return}if(isAccounts)setAccountsOpen(!accountsOpen);else if(isReports)setReportsOpen(!reportsOpen);else setMastersOpen(!mastersOpen)}} className={`group flex h-11 w-full items-center rounded-xl px-3 transition ${active?'bg-blue-600 text-white shadow-lg shadow-blue-950/30':'hover:bg-white/[.07] hover:text-white'} ${collapsed?'justify-center':''}`} title={collapsed?n.label:undefined}><Icon name={n.icon} className="h-5 w-5 shrink-0"/>{!collapsed&&<><span className="ml-3 text-sm font-semibold">{n.label}</span><Icon name="down" className={`ml-auto h-4 w-4 transition ${open?'rotate-180':''}`}/></>}</button>
              {!collapsed&&open&&<div className="ml-4 border-l border-white/10 py-2 pl-3">{groups.map(group=><div key={group.label} className="mb-3"><p className="mb-1 px-2 text-[9px] font-black uppercase tracking-[.14em] text-slate-600">{group.label}</p>{group.items.map(([label,href])=><Link key={`${label}-${href}`} href={href} onClick={()=>setMobile(false)} className={`block rounded-lg px-2.5 py-2 text-xs font-semibold transition ${path===href?'bg-blue-500/20 text-blue-200':'text-slate-400 hover:bg-white/[.06] hover:text-white'}`}>{label}</Link>)}</div>)}</div>}
            </div>
          }
          return <Link key={n.label} onClick={()=>setMobile(false)} href={n.href} title={collapsed?n.label:undefined} className={`group flex h-11 items-center rounded-xl px-3 transition ${active?'bg-blue-600 text-white shadow-lg shadow-blue-950/30':'hover:bg-white/[.07] hover:text-white'} ${collapsed?'justify-center':''}`}><Icon name={n.icon} className="h-5 w-5 shrink-0"/>{!collapsed&&<span className="ml-3 text-sm font-semibold">{n.label}</span>}</Link>
        })}
      </nav>
      <button onClick={()=>setCollapsed(!collapsed)} className="hidden h-14 items-center justify-center border-t border-white/10 text-slate-500 hover:text-white lg:flex"><Icon name="chevron" className={`h-5 w-5 transition ${collapsed?'':'rotate-180'}`}/>{!collapsed&&<span className="ml-2 text-xs font-bold">Collapse sidebar</span>}</button>
    </aside>
    <div className={`transition-all duration-300 ${collapsed?'lg:pl-[76px]':'lg:pl-[280px]'}`}>
      <header className="sticky top-0 z-20 flex h-20 items-center border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 sm:px-6 lg:px-8">
        <button onClick={()=>setMobile(true)} className="mr-3 rounded-xl border border-slate-200 p-2.5 lg:hidden dark:border-slate-700"><Icon name="menu" className="h-5 w-5"/></button>
        <div className="hidden items-center text-sm sm:flex"><Link href="/dashboard" className="text-slate-400 hover:text-blue-600">Home</Link>{current&&<><Icon name="chevron" className="mx-2 h-3 w-3 text-slate-300"/><span className="font-bold">{current.label}</span></>}</div>
        <div className="ml-auto flex items-center gap-2" ref={menuRef}>
          <button onClick={theme} className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><Icon name={dark?'sun':'moon'} className="h-5 w-5"/></button>
          <div className="relative"><button onClick={()=>{setNotices(!notices);setProfile(false)}} className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><Icon name="bell" className="h-5 w-5"/></button>{notices&&<div className="absolute right-0 top-14 w-72 rounded-2xl border bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"><h2 className="font-black">Notifications</h2><p className="mt-2 text-sm text-slate-500">No notifications available.</p></div>}</div>
          <div className="relative"><button onClick={()=>{setProfile(!profile);setNotices(false)}} className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-700 text-xs font-black text-white">{activeSession.user.initials}</span><span className="hidden text-left md:block"><strong className="block max-w-40 truncate text-sm">{activeSession.user.name}</strong><span className="block text-xs text-slate-500">{activeSession.user.role}</span></span><Icon name="down" className="hidden h-4 w-4 text-slate-400 md:block"/></button>{profile&&<ProfileMenu session={activeSession}/>}</div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  </div>
}

function ProfileMenu({session}:{session:DashboardSession}){return <div className="absolute right-0 top-14 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900"><div className="border-b px-3 py-3 dark:border-slate-800"><p className="font-bold">{session.user.name}</p><p className="truncate text-xs text-slate-500">{session.user.email}</p></div><Link href="/settings/profile" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"><Icon name="profile" className="h-4 w-4"/>My profile</Link><Link href="/settings/organization" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"><Icon name="settings" className="h-4 w-4"/>Organization settings</Link><div className="my-1 border-t dark:border-slate-800"/><button onClick={async()=>{try{await authenticatedRequest('/auth/logout',{method:'POST'})}finally{sessionStorage.removeItem('raj_erp_token');sessionStorage.removeItem('vimawallah_user');location.replace('/login')}}} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Icon name="logout" className="h-4 w-4"/>Sign out</button></div>}
