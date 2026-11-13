import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { canAccessDocument, getUserRoleInfo } from '@/lib/permissions';
import { loadDownloadContext, loadDownloadDocument } from './download-source';
import { renderFromContent, serveLatestInputForm, serveStoredFile } from './download-render';

// PDF 서버 렌더(puppeteer/chromium 콜드스타트 대비) 실행시간 확보
export const maxDuration = 60;

/**
 * GET /api/documents/[id]/download?font=맑은고딕&format=docx
 * 문서 내용을 선택된 포맷으로 변환하여 다운로드
 */
const FONT_MAP: Record<string, string> = {
  '맑은 고딕': 'Malgun Gothic',
  '나눔고딕': 'NanumGothic',
  '바탕': 'Batang',
  '돋움': 'Dotum',
  '굴림': 'Gulim',
  '나눔명조': 'NanumMyeongjo',
  'Arial': 'Arial',
  'Times New Roman': 'Times New Roman',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(_request.url);
    const requestedFont = url.searchParams.get('font') ?? '맑은 고딕';
    const fontParam = Object.hasOwn(FONT_MAP, requestedFont) ? requestedFont : '맑은 고딕';
    const format = url.searchParams.get('format') ?? 'docx';
    const fontFamily = FONT_MAP[fontParam] ?? 'Malgun Gothic';

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) {
      return NextResponse.json({ error: '사용자 정보가 없습니다.' }, { status: 403 });
    }

    const canAccess = await canAccessDocument(supabase, authUserId, roleInfo.role, roleInfo.department_id, id);

    // 문서 조회(본인/결재자/주간업무 열람권자) + 스냅샷 storage_path 보정
    const doc = await loadDownloadDocument(id, authUserId, canAccess);
    if (!doc) {
      return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const inline = url.searchParams.get('inline') === 'true';

    // 서명·템플릿·로고·직인 컨텍스트 준비 후 단계별 서빙(앞 단계가 응답하면 그대로 반환)
    const context = await loadDownloadContext(doc, authUserId, inline);
    const ctx = { ...context, doc, inline, format, fontParam, fontFamily };

    const latest = await serveLatestInputForm(ctx);
    if (latest) return latest;

    const stored = await serveStoredFile(ctx);
    if (stored) return stored;

    return await renderFromContent(ctx);
  } catch (err) {
    console.error('[documents/download]', err);
    return NextResponse.json({ error: '파일 변환 중 오류' }, { status: 500 });
  }
}
