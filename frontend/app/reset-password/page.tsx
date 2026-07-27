import {Suspense} from 'react'; import ResetForm from '@/components/auth/ResetForm';
export default function ResetPasswordPage(){return <Suspense fallback={<main className="auth-shell"/>}><ResetForm/></Suspense>}
