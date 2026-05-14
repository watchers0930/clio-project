import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { createHash } from 'crypto';

function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'clio-salt').digest('hex');
}

/**
 * GET /api/share/[token] — 공유 링크 내용 조회 (공개)
 * query: password? (비밀번호 보호 링크)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password');

    const admin = createAdminSupabaseClient();

    // 토큰으로 링크 조회
    const { data: link } = await admin
      .from('shared_links')
      .select('*')
      .eq('token', token)
      .single();

    if (!link) {
      return NextResponse.json({ error: '존재하지 않는 링크입니다.' }, { status: 404 });
    }

    // 만료 확인
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return NextResponse.json({ error: '만료된 링크입니다.', expired: true }, { status: 410 });
    }

    // 비밀번호 확인
    if (link.password_hash) {
      if (!password) {
        return NextResponse.json({ error: '비밀번호가 필요합니다.', needPassword: true }, { status: 401 });
      }
      if (hashPassword(password) !== link.password_hash) {
        return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.', needPassword: true }, { status: 401 });
      }
    }

    // 조회수 증가
    await admin.from('shared_links').update({ view_count: (link.view_count ?? 0) + 1 }).eq('id', link.id);

    // 리소스 내용 조회
    if (link.resource_type === 'document') {
      const { data: doc } = await admin
        .from('documents')
        .select('id, title, content, created_at, status')
        .eq('id', link.resource_id)
        .single();

      if (!doc) return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });

      return NextResponse.json({
        type: 'document',
        title: link.title ?? doc.title,
        content: doc.content,
        createdAt: doc.created_at,
        expiresAt: link.expires_at,
      });
    }

    if (link.resource_type === 'file') {
      const { data: file } = await admin
        .from('files')
        .select('id, name, type, size, storage_path, created_at')
        .eq('id', link.resource_id)
        .single();

      if (!file) return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
      if (!file.storage_path) {
        return NextResponse.json({ error: '파일 경로 정보가 없습니다.' }, { status: 404 });
      }

      // 다운로드 URL 생성 (1시간 유효)
      const { data: urlData } = await admin.storage
        .from('files')
        .createSignedUrl(file.storage_path, 3600);

      return NextResponse.json({
        type: 'file',
        title: link.title ?? file.name,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        downloadUrl: urlData?.signedUrl ?? null,
        createdAt: file.created_at,
        expiresAt: link.expires_at,
      });
    }

    return NextResponse.json({ error: '알 수 없는 리소스 유형입니다.' }, { status: 400 });
  } catch (err) {
    console.error('[share/token/GET]', err);
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * DELETE /api/share/[token] — 공유 링크 삭제 (인증 필요)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });
    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const admin = createAdminSupabaseClient();
    const { error } = await admin
      .from('shared_links')
      .delete()
      .eq('token', token)
      .eq('created_by', authUserId);

    if (error) return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[share/token/DELETE]', err);
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
