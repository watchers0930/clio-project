import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { createHash, randomBytes } from 'crypto';

function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'clio-salt').digest('hex');
}

function generateToken(): string {
  return randomBytes(16).toString('hex');
}

/**
 * GET /api/share — 내 공유 링크 목록
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });
    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const admin = createAdminSupabaseClient();
    const { data: links } = await admin
      .from('shared_links')
      .select('id, token, resource_type, resource_id, title, expires_at, view_count, created_at, password_hash')
      .eq('created_by', authUserId)
      .order('created_at', { ascending: false });

    const result = (links ?? []).map((l) => ({
      id: l.id,
      token: l.token,
      resourceType: l.resource_type,
      resourceId: l.resource_id,
      title: l.title,
      expiresAt: l.expires_at,
      viewCount: l.view_count,
      createdAt: l.created_at,
      hasPassword: !!l.password_hash,
      url: `/share/${l.token}`,
    }));

    return NextResponse.json({ links: result });
  } catch (err) {
    console.error('[share/GET]', err);
    return NextResponse.json({ error: '목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * POST /api/share — 공유 링크 생성
 * body: { resourceType, resourceId, title, expiresInDays?, password? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });
    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const { resourceType, resourceId, title, expiresInDays, password } = await request.json();

    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: '리소스 정보가 필요합니다.' }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const token = generateToken();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const passwordHash = password ? hashPassword(password) : null;

    const { data: link, error } = await admin.from('shared_links').insert({
      token,
      resource_type: resourceType,
      resource_id: resourceId,
      title: title ?? '공유 링크',
      expires_at: expiresAt,
      password_hash: passwordHash,
      created_by: authUserId,
    }).select().single();

    if (error) {
      console.error('[share/POST]', error.message);
      return NextResponse.json({ error: '링크 생성에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      token: link.token,
      url: `/share/${link.token}`,
    });
  } catch (err) {
    console.error('[share/POST]', err);
    return NextResponse.json({ error: '링크 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
