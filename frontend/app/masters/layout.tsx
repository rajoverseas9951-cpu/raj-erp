import {DashboardShell} from '@/components/dashboard/DashboardShell';
import {dashboardSession} from '@/lib/dashboard';
export default function MastersLayout({children}:{children:React.ReactNode}){return <DashboardShell session={dashboardSession}>{children}</DashboardShell>}
