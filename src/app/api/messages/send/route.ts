import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import type { DbMessage } from '@/lib/supabase/types';
import { isChannelMember, notChannelMember } from '@/lib/messages/channel-access';
import { canAccessDocument, getUserRoleInfo } from '@/lib/permissions';
import { uuid } from '@/lib/attendance/date';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const { channelId, content, documentId } = await request.json();

    if (!channelId) return NextResponse.json({ success: false, error: '채널 ID가 필요합니다.' }, { status: 400 });
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ success: false, error: '메시지 내용이 필요합니다.' }, { status: 400 });
    }

    // adminClient로 INSERT (RLS bypass — sender_id가 auth.uid()와 다를 수 있으므로)
    const admin = createAdminSupabaseClient();
    if (!(await isChannelMember(admin, channelId, authUserId))) return notChannelMember();

    // 문서 공유 메시지: 보낸 사람이 볼 수 있는 문서만 (수신자는 메시지의 문서 링크로 열람)
    if (documentId !== undefined && documentId !== null) {
      const roleInfo = uuid(documentId) ? await getUserRoleInfo(supabase, authUserId) : null;
      if (!roleInfo || !(await canAccessDocument(admin, authUserId, roleInfo.role, roleInfo.department_id, documentId))) {
        return NextResponse.json({ success: false, error: '공유할 수 없는 문서입니다.' }, { status: 403 });
      }
    }

    const insertData: Pick<DbMessage, 'channel_id' | 'sender_id' | 'content' | 'document_id'> = {
      channel_id: channelId,
      sender_id: authUserId,
      content: content.trim(),
      document_id: documentId ?? null,
    };

    const { data, error } = await admin.from('messages').insert(insertData).select().single();

    if (error) {
      console.error('[messages/send]', error.message);
      return NextResponse.json({ success: false, error: '메시지 전송 실패: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: '메시지 전송 중 오류' }, { status: 500 });
  }
}
