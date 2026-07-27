export interface AuditLogEntry {
  tenantId?: string;
  actorId?: string;
  actorType?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface AuditLogger {
  record(entry: AuditLogEntry): Promise<void>;
}
