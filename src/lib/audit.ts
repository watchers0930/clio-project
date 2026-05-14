type AuditClient = {
  from: (table: 'audit_logs') => {
    insert: (payload: Record<string, unknown>) => Promise<unknown>;
  };
};

export interface AuditEventInput {
  userId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown>;
}

export async function recordAuditEvent(client: AuditClient, event: AuditEventInput) {
  const payload = {
    user_id: event.userId ?? null,
    action: event.action,
    target_type: event.targetType ?? null,
    target_id: event.targetId ?? null,
    details: event.details ?? {},
  };

  await client.from('audit_logs').insert(payload).then(() => {}, () => {});
}
