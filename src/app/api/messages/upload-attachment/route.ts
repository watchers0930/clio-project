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

    // 1. Storage에 파일 업로드
    const storagePath = `attachments/${channelId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await admin.storage
      .from('files')
      .upload(storagePath, file);

    if (uploadError) {
      console.error('[upload-attachment] storage:', uploadError.message);
      return NextResponse.json({ success: false, error: '파일 업로드 실패' }, { status: 500 });
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

    // 3. messages 테이블에 첨부 메시지 저장
    const sizeStr = formatSize(file.size);
    const { data: msgData, error: msgError } = await admin.from('messages').insert({
      channel_id: channelId,
      sender_id: authUserId,
      content: `📎 ${file.name}`,
      attachment_name: file.name,
      attachment_size: sizeStr,
      shared_file_id: fileData.id,
    }).select().single();

    if (msgError) {
      console.error('[upload-attachment] message insert:', msgError.message);
      return NextResponse.json({ success: false, error: '메시지 전송 실패' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        messageId: msgData.id,
        fileId: fileData.id,
        fileName: file.name,
        fileSize: sizeStr,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: '첨부파일 업로드 중 오류' }, { status: 500 });
  }
}
