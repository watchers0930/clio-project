import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

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

    const insertData: Record<string, unknown> = {
      channel_id: channelId,
      sender_id: authUserId,
      content: content.trim(),
    };
    if (documentId) insertData.document_id = documentId;

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
