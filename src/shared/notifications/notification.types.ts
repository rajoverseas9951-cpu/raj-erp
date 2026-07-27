export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';
export type NotificationStatus = 'queued' | 'sent' | 'failed' | 'cancelled';

export interface NotificationPayload {
  tenantId?: string;
  recipientId: string;
  channel: NotificationChannel;
  templateKey: string;
  data: Record<string, unknown>;
  scheduledAt?: Date;
}

export interface NotificationProvider {
  send(payload: NotificationPayload): Promise<{ status: NotificationStatus; providerMessageId?: string }>;
}
