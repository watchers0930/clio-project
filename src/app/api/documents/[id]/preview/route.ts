import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { canAccessDocument, getUserRoleInfo } from '@/lib/permissions';
import { UUID_RE } from '@/lib/documents/document-links';
import { stripEmbeddedInputs } from '@/lib/documents/embedded-inputs';

const PREVIEW_MAX_CHARS = 10000; // 파일 미리보기(files/[id]/preview)와 같은 기준

/**
 * GET /api/documents/[id]/preview — 검색 결과 '미리보기'용 문서 본문(제목·본문만)
 * 문서 상세(GET /api/documents/[id])는 코멘트·버전·공유·관련 문서까지 10여 개를 조회해 미리보기에 무거웠다.
 * 응답 모양은 파일 미리보기와 같다: { name, text, truncated?, totalLength? } / 실패 { error }
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });
    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) return NextResponse.json({ error: '사용자 정보가 없습니다.' }, { status: 403 });
    if (!(await canAccessDocument(supabase, authUserId, roleInfo.role, roleInfo.department_id, id))) {
      return NextResponse.json({ error: '문서 접근 권한이 없습니다.' }, { status: 403 });
    }

    const { data: doc } = await createAdminSupabaseClient()
      .from('documents').select('title, content').eq('id', id).maybeSingle();
    if (!doc) return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });

    const text = stripEmbeddedInputs(doc.content ?? '').trim(); // 내부 입력값 주석 제외
    if (!text) return NextResponse.json({ name: doc.title, text: "(본문이 없는 문서입니다. '문서 열기'에서 확인해 주세요.)" });
    return NextResponse.json({
      name: doc.title,
      text: text.slice(0, PREVIEW_MAX_CHARS),
      truncated: text.length > PREVIEW_MAX_CHARS,
      totalLength: text.length,
    });
  } catch (err) {
    console.error('[documents/preview]', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: '미리보기 처리 중 오류' }, { status: 500 });
  }
}
