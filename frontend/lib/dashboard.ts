export type DashboardPermission =
  | 'dashboard.view' | 'customer.view' | 'customer.create'
  | 'vehicle.view' | 'vehicle.create' | 'activity.read'
  | 'users.view' | 'reports.view' | 'settings.manage';

export interface DashboardSession {
  tenant: { id: string; name: string; plan: string; shortName: string };
  user: { id: string; name: string; email: string; role: string; initials: string };
  permissions: DashboardPermission[];
}

export const dashboardSession: DashboardSession = {
  tenant: {
    id: process.env.RAJ_ERP_TENANT_ID ?? '00000000-0000-4000-8000-000000000001',
    name: process.env.RAJ_ERP_TENANT_NAME ?? 'Raj Motors & Services',
    shortName: 'RM',
    plan: 'Enterprise',
  },
  user: { id: 'current-user', name: 'Arjun Sharma', email: 'arjun@rajmotors.in', role: 'Tenant Admin', initials: 'AS' },
  permissions: ['dashboard.view','customer.view','customer.create','vehicle.view','vehicle.create','activity.read','users.view','reports.view','settings.manage'],
};

export const can = (session: DashboardSession, permission?: DashboardPermission) =>
  !permission || session.permissions.includes(permission);
