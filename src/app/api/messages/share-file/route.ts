import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

/**
 * POST /api/messages/share-file
 * 메신저에서 파일 읽기 권한을 공유하는 메시지 전송
 *
 * body: { channelId, fileId, expiresInDays }
 * - 파일은 원래 위치에 그대로 유지
 * - 상대방에게 기간 제한 읽기 권한만 부여
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const { channelId, fileId, expiresInDays } = await request.json();

    if (!channelId || !fileId) {
      return NextResponse.json({ success: false, error: '채널 ID와 파일 ID가 필요합니다.' }, { status: 400 });
    }

    const days = Math.max(1, Math.min(365, Number(expiresInDays) || 7));
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const admin = createAdminSupabaseClient();

    // 파일 소유권 확인
    const { data: file, error: fileErr } = await admin
      .from('files')
      .select('id, name, type, size, uploaded_by')
      .eq('id', fileId)
      .single();

    if (fileErr || !file) {
      return NextResponse.json({ success: false, error: '파일을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (file.uploaded_by !== authUserId) {
      return NextResponse.json({ success: false, error: '본인이 업로드한 파일만 공유할 수 있습니다.' }, { status: 403 });
    }

    // 채널 멤버 조회 (나를 제외한 상대방들에게 권한 부여)
    const { data: members } = await admin
      .from('channel_members')
      .select('user_id')
      .eq('channel_id', channelId)
      .neq('user_id', authUserId);

    if (!members || members.length === 0) {
      return NextResponse.json({ success: false, error: '채널에 공유 대상이 없습니다.' }, { status: 400 });
    }

    // 사이즈 포맷
    const sizeNum = Number(file.size) || 0;
    const sizeStr = sizeNum < 1024 * 1024
      ? `${(sizeNum / 1024).toFixed(0)} KB`
      : `${(sizeNum / (1024 * 1024)).toFixed(1)} MB`;

    // 메시지 생성 (shared_file_id 포함)
    const { data: msg, error: msgErr } = await admin.from('messages').insert({
      channel_id: channelId,
      sender_id: authUserId,
      content: `📎 파일을 공유했습니다: ${file.name}`,
      shared_file_id: fileId,
      attachment_name: file.name,
      attachment_size: sizeStr,
    }).select().single();

    if (msgErr) {
      console.error('[share-file] message insert:', msgErr.message);
      return NextResponse.json({ success: false, error: '메시지 전송 실패' }, { status: 500 });
    }

    // 각 채널 멤버에게 file_shares 레코드 생성
    const shareInserts = members.map(m => ({
      file_id: fileId,
      shared_by: authUserId,
      shared_with: m.user_id,
      message_id: msg.id,
      permission: 'read',
      expires_at: expiresAt,
    }));

    const { error: shareErr } = await admin.from('file_shares').insert(shareInserts);
    if (shareErr) {
      console.error('[share-file] share insert:', shareErr.message);
      // 메시지는 이미 전송됨, 공유 실패 로그만
    }

    // 감사 로그
    await admin.from('audit_logs').insert({
      user_id: authUserId,
      action: 'file.share',
      target_type: 'file',
      target_id: fileId,
      details: {
        file_name: file.name,
        channel_id: channelId,
        shared_with: members.map(m => m.user_id),
        expires_at: expiresAt,
        expires_in_days: days,
      },
    }).then(() => {}, () => {});

    return NextResponse.json({
      success: true,
      data: {
        messageId: msg.id,
        fileId,
        fileName: file.name,
        expiresAt,
        sharedWith: members.length,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: '파일 공유 중 오류' }, { status: 500 });
  }
}
