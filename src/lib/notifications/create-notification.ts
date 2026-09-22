import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationType =
  | 'document_comment'
  | 'chat_request'
  | 'document_shared'
  | 'file_shared'
  | 'comment_reflected'
  | 'approval_requested'
  | 'approval_approved'
  | 'approval_rejected';

interface CreateNotificationsParams {
  recipientIds: string[];
  actorId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
}

/**
 * 수신자들에게 알림을 생성한다(서버 전용, admin/service_role 클라이언트 사용).
 * - 발신자 본인은 제외, 중복 수신자는 1건으로 합침.
 * - best-effort: 알림 저장 실패가 주 액션(댓글·채팅)을 막지 않도록 예외를 삼킨다.
 *
 * @returns 생성된 알림 수(실패 시 0)
 */
export async function createNotifications(
  admin: SupabaseClient,
  params: CreateNotificationsParams,
): Promise<number> {
  const recipients = [...new Set(params.recipientIds)].filter(
    (id) => Boolean(id) && id !== params.actorId,
  );
  if (recipients.length === 0) return 0;

  const rows = recipients.map((recipientId) => ({
    recipient_id: recipientId,
    actor_id: params.actorId,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
  }));

  try {
    const { error } = await admin.from('notifications').insert(rows);
    if (error) {
      console.error('[createNotifications]', error.message);
      return 0;
    }
    return rows.length;
  } catch (e) {
    console.error('[createNotifications]', e);
    return 0;
  }
}
