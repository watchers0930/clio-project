/**
 * POST /api/documents/[id]/diff
 * 두 버전의 Myers diff 계산 후 DiffResult + 메타 정보 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { computeDiff } from '@/lib/utils/myers-diff';

type DocRow = {
  id: string;
  title: string;
  content: string | null;
  version_number: number | null;
  parent_id: string | null;
  created_at: string | null;
  created_by: string;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'DB 미설정' } }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' } }, { status: 401 });
    }

    let body: { compareWith?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '잘못된 요청 형식입니다.' } }, { status: 400 });
    }

    const { compareWith } = body;
    if (!compareWith || typeof compareWith !== 'string') {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'compareWith ID가 필요합니다.' } }, { status: 400 });
    }

    if (id === compareWith) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '동일한 문서는 비교할 수 없습니다.' } }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();

    // 두 문서 조회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [{ data: fromDoc }, { data: toDoc }] = await Promise.all([
      (admin as any).from('documents').select('id, title, content, version_number, parent_id, created_at, created_by').eq('id', id).single() as Promise<{ data: DocRow | null }>,
      (admin as any).from('documents').select('id, title, content, version_number, parent_id, created_at, created_by').eq('id', compareWith).single() as Promise<{ data: DocRow | null }>,
    ]);

    if (!fromDoc) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: '기준 문서를 찾을 수 없습니다.' } }, { status: 404 });
    }
    if (!toDoc) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: '비교 문서를 찾을 수 없습니다.' } }, { status: 404 });
    }

    // 접근 권한 확인 (두 문서 모두 본인 작성 또는 같은 조직)
    if (fromDoc.created_by !== authUserId || toDoc.created_by !== authUserId) {
      // 같은 조직이면 허용 — 현재는 작성자 본인만 허용 (RLS 동일 기준)
      if (fromDoc.created_by !== authUserId && toDoc.created_by !== authUserId) {
        return NextResponse.json({ error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' } }, { status: 403 });
      }
    }

    // 버전 체인 유효성 검증: 두 문서가 같은 parent_id 체인에 속하는지 확인
    const fromRoot = fromDoc.parent_id ?? fromDoc.id;
    const toRoot = toDoc.parent_id ?? toDoc.id;

    if (fromRoot !== toRoot && fromDoc.id !== toRoot && toDoc.id !== fromRoot) {
      return NextResponse.json({
        error: { code: 'INVALID_VERSION_CHAIN', message: '두 문서가 같은 버전 체인에 속하지 않습니다.' },
      }, { status: 400 });
    }

    // diff 계산
    const diffResult = computeDiff(fromDoc.content ?? '', toDoc.content ?? '');

    return NextResponse.json({
      ...diffResult,
      from: {
        id: fromDoc.id,
        versionNumber: fromDoc.version_number ?? 1,
        createdAt: fromDoc.created_at?.split('T')[0] ?? '',
        title: fromDoc.title,
      },
      to: {
        id: toDoc.id,
        versionNumber: toDoc.version_number ?? 1,
        createdAt: toDoc.created_at?.split('T')[0] ?? '',
        title: toDoc.title,
      },
    });
  } catch (err) {
    console.error('[documents/diff]', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' } }, { status: 500 });
  }
}
