import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

/**
 * GET /api/auth/signature
 * 현재 사용자의 서명 이미지 Signed URL 반환
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const { data: user } = await supabase
      .from('users')
      .select('signature_path')
      .eq('id', authUserId)
      .single();

    if (!user?.signature_path) {
      return NextResponse.json({ success: true, data: null });
    }

    const admin = createAdminSupabaseClient();
    const { data: signed } = await admin.storage
      .from('files')
      .createSignedUrl(user.signature_path, 3600);

    return NextResponse.json({ success: true, data: { path: user.signature_path, url: signed?.signedUrl ?? null } });
  } catch (err) {
    console.error('[signature/GET]', err);
    return NextResponse.json({ success: false, error: '서명 조회 실패' }, { status: 500 });
  }
}

/**
 * POST /api/auth/signature
 * 서명 이미지 업로드 (PNG, 최대 2MB)
 * body: FormData { file: File }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ success: false, error: '파일이 없습니다.' }, { status: 400 });
    if (file.size > 2 * 1024 * 1024) return NextResponse.json({ success: false, error: '파일 크기는 2MB 이하여야 합니다.' }, { status: 400 });
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      return NextResponse.json({ success: false, error: 'PNG, JPEG, WebP 형식만 지원합니다.' }, { status: 400 });
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp';
    const storagePath = `signatures/${authUserId}/signature.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const admin = createAdminSupabaseClient();

    // 기존 서명 덮어쓰기 (upsert)
    const { error: uploadErr } = await admin.storage
      .from('files')
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      console.error('[signature/POST] upload:', uploadErr.message);
      return NextResponse.json({ success: false, error: '업로드 실패' }, { status: 500 });
    }

    // DB 업데이트
    const { error: dbErr } = await admin
      .from('users')
      .update({ signature_path: storagePath })
      .eq('id', authUserId);

    if (dbErr) {
      console.error('[signature/POST] db update:', dbErr.message);
      return NextResponse.json({ success: false, error: 'DB 업데이트 실패' }, { status: 500 });
    }

    const { data: signed } = await admin.storage.from('files').createSignedUrl(storagePath, 3600);
    return NextResponse.json({ success: true, data: { path: storagePath, url: signed?.signedUrl ?? null } });
  } catch (err) {
    console.error('[signature/POST]', err);
    return NextResponse.json({ success: false, error: '서명 업로드 실패' }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/signature
 * 서명 이미지 삭제
 */
export async function DELETE() {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const { data: user } = await supabase.from('users').select('signature_path').eq('id', authUserId).single();
    const admin = createAdminSupabaseClient();

    if (user?.signature_path) {
      await admin.storage.from('files').remove([user.signature_path]);
    }

    await admin.from('users').update({ signature_path: null }).eq('id', authUserId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[signature/DELETE]', err);
    return NextResponse.json({ success: false, error: '서명 삭제 실패' }, { status: 500 });
  }
}
