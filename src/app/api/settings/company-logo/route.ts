import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { isAdmin, getUserRoleInfo } from '@/lib/permissions';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  COMPANY_LOGO_PATHS,
  getCompanyLogoPatternSize,
  loadCompanyLogoSettings,
  normalizeCompanyLogoPatternDensity,
  saveCompanyLogoSettings,
} from '@/lib/settings/company-logo';

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
    const settings = await loadCompanyLogoSettings(admin);
    for (const path of COMPANY_LOGO_PATHS) {
      const { data: blob } = await admin.storage.from('files').download(path);
      if (blob) {
        const { data } = await admin.storage.from('files').createSignedUrl(path, 3600);
        return NextResponse.json({
          success: true,
          data: {
            path,
            url: data?.signedUrl ?? null,
            patternDensity: settings.patternDensity,
            patternSize: getCompanyLogoPatternSize(settings.patternDensity),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        path: null,
        url: null,
        patternDensity: settings.patternDensity,
        patternSize: getCompanyLogoPatternSize(settings.patternDensity),
      },
    });
  } catch (err) {
    console.error('[company-logo/GET]', err);
    return NextResponse.json({ success: false, error: '회사 로고 조회 실패' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAdmin();
    if (context.error) return context.error;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ success: false, error: '파일이 없습니다.' }, { status: 400 });
    if (file.size > 2 * 1024 * 1024) return NextResponse.json({ success: false, error: '파일 크기는 2MB 이하여야 합니다.' }, { status: 400 });
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      return NextResponse.json({ success: false, error: 'PNG, JPEG, WebP 형식만 지원합니다.' }, { status: 400 });
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp';
    const storagePath = `settings/company-logo.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const admin = createAdminSupabaseClient();

    await admin.storage.from('files').remove(COMPANY_LOGO_PATHS.filter((path) => path !== storagePath));
    const { error: uploadErr } = await admin.storage
      .from('files')
      .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: true });

    if (uploadErr) {
      console.error('[company-logo/POST] upload:', uploadErr.message);
      return NextResponse.json({ success: false, error: '업로드 실패' }, { status: 500 });
    }

    const settings = await loadCompanyLogoSettings(admin);
    const { data: signed } = await admin.storage.from('files').createSignedUrl(storagePath, 3600);
    return NextResponse.json({
      success: true,
      data: {
        path: storagePath,
        url: signed?.signedUrl ?? null,
        patternDensity: settings.patternDensity,
        patternSize: getCompanyLogoPatternSize(settings.patternDensity),
      },
    });
  } catch (err) {
    console.error('[company-logo/POST]', err);
    return NextResponse.json({ success: false, error: '회사 로고 업로드 실패' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await requireAdmin();
    if (context.error) return context.error;

    const body = await request.json().catch(() => ({}));
    const patternDensity = normalizeCompanyLogoPatternDensity(body?.patternDensity);
    const admin = createAdminSupabaseClient();
    const { error } = await saveCompanyLogoSettings(admin, { patternDensity });

    if (error) {
      console.error('[company-logo/PATCH] settings:', error.message);
      return NextResponse.json({ success: false, error: '워터마크 설정 저장 실패' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        patternDensity,
        patternSize: getCompanyLogoPatternSize(patternDensity),
      },
    });
  } catch (err) {
    console.error('[company-logo/PATCH]', err);
    return NextResponse.json({ success: false, error: '워터마크 설정 저장 실패' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const context = await requireAdmin();
    if (context.error) return context.error;

    const admin = createAdminSupabaseClient();
    await admin.storage.from('files').remove(COMPANY_LOGO_PATHS);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[company-logo/DELETE]', err);
    return NextResponse.json({ success: false, error: '회사 로고 삭제 실패' }, { status: 500 });
  }
}
