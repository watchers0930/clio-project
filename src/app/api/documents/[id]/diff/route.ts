/**
 * POST /api/documents/[id]/diff
 * 두 버전의 Myers diff 계산 후 DiffResult + 메타 정보 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { computeDiff } from '@/lib/utils/myers-diff';
import { canAccessDocument, getUserRoleInfo } from '@/lib/permissions';

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

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: '사용자 정보가 없습니다.' } }, { status: 403 });
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
    const [{ data: fromDoc }, { data: toDoc }] = await Promise.all([
      admin.from('documents').select('id, title, content, version_number, parent_id, created_at, created_by').eq('id', id).single(),
      admin.from('documents').select('id, title, content, version_number, parent_id, created_at, created_by').eq('id', compareWith).single(),
    ]);

    if (!fromDoc) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: '기준 문서를 찾을 수 없습니다.' } }, { status: 404 });
    }
    if (!toDoc) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: '비교 문서를 찾을 수 없습니다.' } }, { status: 404 });
    }

    const typedFromDoc = fromDoc as DocRow;
    const typedToDoc = toDoc as DocRow;

    const [canAccessFrom, canAccessTo] = await Promise.all([
      canAccessDocument(supabase, authUserId, roleInfo.role, roleInfo.department_id, typedFromDoc.id),
      canAccessDocument(supabase, authUserId, roleInfo.role, roleInfo.department_id, typedToDoc.id),
    ]);

    if (!canAccessFrom || !canAccessTo) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' } }, { status: 403 });
    }

    // 버전 체인 유효성 검증: 두 문서가 같은 parent_id 체인에 속하는지 확인
    const fromRoot = typedFromDoc.parent_id ?? typedFromDoc.id;
    const toRoot = typedToDoc.parent_id ?? typedToDoc.id;

    if (fromRoot !== toRoot && typedFromDoc.id !== toRoot && typedToDoc.id !== fromRoot) {
      return NextResponse.json({
        error: { code: 'INVALID_VERSION_CHAIN', message: '두 문서가 같은 버전 체인에 속하지 않습니다.' },
      }, { status: 400 });
    }

    // diff 계산
    const diffResult = computeDiff(typedFromDoc.content ?? '', typedToDoc.content ?? '');

    return NextResponse.json({
      ...diffResult,
      from: {
        id: typedFromDoc.id,
        versionNumber: typedFromDoc.version_number ?? 1,
        createdAt: typedFromDoc.created_at?.split('T')[0] ?? '',
        title: typedFromDoc.title,
      },
      to: {
        id: typedToDoc.id,
        versionNumber: typedToDoc.version_number ?? 1,
        createdAt: typedToDoc.created_at?.split('T')[0] ?? '',
        title: typedToDoc.title,
      },
    });
  } catch (err) {
    console.error('[documents/diff]', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' } }, { status: 500 });
  }
}
