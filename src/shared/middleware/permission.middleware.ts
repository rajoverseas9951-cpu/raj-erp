import type { Permission } from '../constants';
import { ApplicationException } from '../exceptions';

export interface PermissionContext {
  userId?: string;
  permissions?: string[];
}

export const assertPermission = (context: PermissionContext, requiredPermission: Permission): void => {
  if (!context.permissions?.includes(requiredPermission)) {
    throw new ApplicationException('You do not have permission to perform this action', 'FORBIDDEN', 403, {
      requiredPermission,
      userId: context.userId,
    });
  }
};

export const requirePermission = (requiredPermission: Permission) => {
  return (context: PermissionContext): void => assertPermission(context, requiredPermission);
};
