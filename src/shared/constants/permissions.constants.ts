export const PERMISSIONS = {
  PLATFORM_ADMIN: 'platform.admin',
  TENANT_ADMIN: 'tenant.admin',
  AUDIT_READ: 'audit.read',
  ACTIVITY_READ: 'activity.read',
  FILE_UPLOAD: 'file.upload',
  NOTIFICATION_SEND: 'notification.send',
  CUSTOMER_VIEW: 'customer.view',
  CUSTOMER_CREATE: 'customer.create',
  CUSTOMER_UPDATE: 'customer.update',
  CUSTOMER_DELETE: 'customer.delete',
  CUSTOMER_BULK: 'customer.bulk',
  CUSTOMER_EXPORT: 'customer.export',
  VEHICLE_VIEW: 'vehicle.view',
  VEHICLE_CREATE: 'vehicle.create',
  VEHICLE_UPDATE: 'vehicle.update',
  VEHICLE_DELETE: 'vehicle.delete',
  VEHICLE_BULK: 'vehicle.bulk',
  VEHICLE_EXPORT: 'vehicle.export',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
