export interface ActivityLogEntry {
  tenantId?: string;
  actorId?: string;
  verb: string;
  subjectType: string;
  subjectId?: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface ActivityLogger {
  record(entry: ActivityLogEntry): Promise<void>;
}
