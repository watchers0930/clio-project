import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

/** 파일 사이즈 포맷 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const DEFAULT_SHARE_DAYS = 7;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const channelId = formData.get('channelId') as string | null;

    if (!file) return NextResponse.json({ success: false, error: '파일이 필요합니다.' }, { status: 400 });
    if (!channelId) return NextResponse.json({ success: false, error: '채널 ID가 필요합니다.' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: '파일 크기는 50MB 이하여야 합니다.' }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const expiresAt = new Date(Date.now() + DEFAULT_SHARE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // 1. Storage에 파일 업로드 — 경로는 ASCII만 사용 (한글 파일명 호환)
    const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
    const storagePath = `attachments/${channelId}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}${ext}`;
    const { error: uploadError } = await admin.storage
      .from('files')
      .upload(storagePath, file);

    if (uploadError) {
      console.error('[upload-attachment] storage:', uploadError.message);
      return NextResponse.json({ success: false, error: `스토리지 업로드 실패: ${uploadError.message}` }, { status: 500 });
    }

    // 2. files 테이블에 메타데이터 저장
    const { data: fileData, error: fileError } = await admin.from('files').insert({
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      uploaded_by: authUserId,
      status: 'completed',
      storage_path: storagePath,
    }).select().single();

    if (fileError) {
      console.error('[upload-attachment] file insert:', fileError.message);
      return NextResponse.json({ success: false, error: '파일 정보 저장 실패' }, { status: 500 });
    }

    // 3. 메시지 생성
    const sizeStr = formatSize(file.size);
    const { data: msgData, error: msgError } = await admin.from('messages').insert({
      channel_id: channelId,
      sender_id: authUserId,
      content: `📎 파일을 공유했습니다: ${file.name}`,
      attachment_name: file.name,
      attachment_size: sizeStr,
      shared_file_id: fileData.id,
    }).select().single();

    if (msgError) {
      console.error('[upload-attachment] message insert:', msgError.message);
      return NextResponse.json({ success: false, error: '메시지 전송 실패' }, { status: 500 });
    }

    // 4. 채널 멤버에게 읽기 권한 부여 (본인 제외)
    const { data: members } = await admin
      .from('channel_members')
      .select('user_id')
      .eq('channel_id', channelId)
      .neq('user_id', authUserId);

    if (members && members.length > 0) {
      const shareInserts = members.map(m => ({
        file_id: fileData.id,
        shared_by: authUserId,
        shared_with: m.user_id,
        message_id: msgData.id,
        permission: 'read',
        expires_at: expiresAt,
      }));

      const { error: shareErr } = await admin.from('file_shares').insert(shareInserts);
      if (shareErr) {
        console.error('[upload-attachment] share insert:', shareErr.message);
      }
    }

    // 5. 감사 로그
    await admin.from('audit_logs').insert({
      user_id: authUserId,
      action: 'file.share',
      target_type: 'file',
      target_id: fileData.id,
      details: {
        file_name: file.name,
        channel_id: channelId,
        shared_with: (members ?? []).map(m => m.user_id),
        expires_at: expiresAt,
        via: 'attachment',
      },
    }).then(() => {}, () => {});

    return NextResponse.json({
      success: true,
      data: {
        messageId: msgData.id,
        fileId: fileData.id,
        fileName: file.name,
        fileSize: sizeStr,
        sharedWith: members?.length ?? 0,
        expiresAt,
      },
    }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류';
    console.error('[upload-attachment] catch:', msg);
    return NextResponse.json({ success: false, error: `첨부파일 오류: ${msg}` }, { status: 500 });
  }
}
