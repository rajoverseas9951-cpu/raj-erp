export const PERMISSIONS = {
  PLATFORM_ADMIN: 'platform.admin',
  TENANT_ADMIN: 'tenant.admin',
  AUDIT_READ: 'audit.read',
  ACTIVITY_READ: 'activity.read',
  FILE_UPLOAD: 'file.upload',
  NOTIFICATION_SEND: 'notification.send',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
