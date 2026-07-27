'use client'; import {usePathname,useRouter} from 'next/navigation'; import {useEffect} from 'react'; import {hasToken} from '@/lib/api';
export default function AuthGuard({children}:{children:React.ReactNode}){const router=useRouter(),path=usePathname();useEffect(()=>{if(path!='/login'&&!hasToken())router.replace('/login');},[path,router]);return <>{children}</>}
