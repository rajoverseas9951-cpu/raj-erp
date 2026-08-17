'use client';

import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';

export function BugAgentShortcut(){
 const pathname=usePathname();const [visible,setVisible]=useState(false);
 useEffect(()=>{try{const raw=sessionStorage.getItem('vimawallah_user');const user=raw?JSON.parse(raw):null;setVisible(Boolean(user?.is_admin))}catch{setVisible(false)}},[pathname]);
 if(!visible||pathname.startsWith('/login')||pathname.startsWith('/forgot-password')||pathname.startsWith('/reset-password')||pathname==='/bug-agent')return null;
 return <a href="/bug-agent" className="fixed bottom-5 right-5 z-[90] inline-flex items-center gap-2 rounded-2xl border border-blue-300/40 bg-[#071a3c] px-4 py-3 text-xs font-black text-white shadow-[0_14px_35px_rgba(7,26,60,.28)] transition hover:-translate-y-0.5 hover:bg-[#0b2b62]" title="Open ERP Bug Agent"><span className="text-base">🤖</span><span className="hidden sm:inline">Bug Agent</span></a>;
}
