export interface ServiceContext {
  tenantId?: string;
  actorId?: string;
  requestId?: string;
}

export abstract class BaseService {
  protected getTenantId(context: ServiceContext): string {
    if (!context.tenantId) {
      throw new Error('Tenant context is required');
    }

    return context.tenantId;
  }
}
