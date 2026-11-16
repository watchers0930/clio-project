import { withMutation } from '@/lib/http/mutation-guard';
import { readUploadImage } from '@/lib/http/upload-image';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { isAdmin, getUserRoleInfo } from '@/lib/permissions';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { COMPANY_SEAL_PATHS } from '@/lib/settings/company-seal';

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { error: NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 }) };
  const authUserId = await getAuthUserId(supabase);
  if (!authUserId) return { error: NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 }) };
  return { supabase, authUserId };
}

async function requireAdmin() {
  const context = await requireUser();
  if (context.error) return context;
  const roleInfo = await getUserRoleInfo(context.supabase, context.authUserId);
  if (!roleInfo || !isAdmin(roleInfo.role)) {
    return { error: NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 }) };
  }
  return context;
}

export async function GET() {
  try {
    const context = await requireUser();
    if (context.error) return context.error;

    const admin = createAdminSupabaseClient();
    for (const path of COMPANY_SEAL_PATHS) {
      const { data: blob } = await admin.storage.from('files').download(path);
      if (blob) {
        const { data } = await admin.storage.from('files').createSignedUrl(path, 3600);
        return NextResponse.json({ success: true, data: { path, url: data?.signedUrl ?? null } });
      }
    }
    return NextResponse.json({ success: true, data: { path: null, url: null } });
  } catch (err) {
    console.error('[company-seal/GET]', err);
    return NextResponse.json({ success: false, error: '회사 직인 조회 실패' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // 변이 요청: 출처 + CSRF 토큰 + 활성 사용자 확인 (기존 권한 확인은 아래 그대로)
  const mutation = await withMutation(request);
  if (mutation.error) return mutation.error;
  try {
    const context = await requireAdmin();
    if (context.error) return context.error;

    const formData = await request.formData();
    // 형식은 파일 내용으로 판별(브라우저가 보낸 type 은 위조 가능)
    const image = await readUploadImage(formData.get('file'));
    if (!image.ok) return NextResponse.json({ success: false, error: image.error }, { status: 400 });

    const storagePath = `settings/company-seal.${image.ext}`;
    const admin = createAdminSupabaseClient();

    await admin.storage.from('files').remove(COMPANY_SEAL_PATHS.filter((path) => path !== storagePath));
    const { error: uploadErr } = await admin.storage
      .from('files')
      .upload(storagePath, image.buffer, { contentType: image.mime, upsert: true });
    if (uploadErr) {
      console.error('[company-seal/POST] upload:', uploadErr.message);
      return NextResponse.json({ success: false, error: '업로드 실패' }, { status: 500 });
    }

    const { data: signed } = await admin.storage.from('files').createSignedUrl(storagePath, 3600);
    return NextResponse.json({ success: true, data: { path: storagePath, url: signed?.signedUrl ?? null } });
  } catch (err) {
    console.error('[company-seal/POST]', err);
    return NextResponse.json({ success: false, error: '업로드 실패' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  // 변이 요청: 출처 + CSRF 토큰 + 활성 사용자 확인 (기존 권한 확인은 아래 그대로)
  const mutation = await withMutation(request);
  if (mutation.error) return mutation.error;
  try {
    const context = await requireAdmin();
    if (context.error) return context.error;
    const admin = createAdminSupabaseClient();
    await admin.storage.from('files').remove(COMPANY_SEAL_PATHS);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[company-seal/DELETE]', err);
    return NextResponse.json({ success: false, error: '삭제 실패' }, { status: 500 });
  }
}
