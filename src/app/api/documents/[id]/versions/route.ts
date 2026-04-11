import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

/**
 * GET /api/documents/[id]/versions
 * 해당 문서의 모든 버전 목록 반환 (루트 기준)
 * parent_id 전략: v1=null, v2+=root_id
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const admin = createAdminSupabaseClient();

    // 현재 문서 조회 → root_id 결정
    const { data: current } = await admin
      .from('documents')
      .select('id, parent_id, version_number')
      .eq('id', id)
      .single();

    if (!current) return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });

    // root_id: parent_id가 null이면 자신이 root, 아니면 parent_id가 root
    const rootId: string = current.parent_id ?? id;

    // root 문서 + 모든 버전(parent_id = rootId) 조회
    const { data: versions } = await admin
      .from('documents')
      .select('id, title, version_number, created_at, status, created_by')
      .or(`id.eq.${rootId},parent_id.eq.${rootId}`)
      .order('version_number', { ascending: true });

    if (!versions) return NextResponse.json({ versions: [] });

    // 작성자 이름 조회
    const userIds = [...new Set(versions.map((v) => v.created_by).filter(Boolean))];
    const { data: users } = await admin
      .from('users')
      .select('id, name')
      .in('id', userIds);
    const userMap = new Map((users ?? []).map((u: { id: string; name: string }) => [u.id, u.name]));

    const result = versions.map((v) => ({
      id: v.id,
      title: v.title,
      versionNumber: v.version_number ?? 1,
      createdAt: v.created_at?.split('T')[0] ?? '',
      status: v.status,
      createdBy: userMap.get(v.created_by) ?? '',
      isCurrent: v.id === id,
    }));

    return NextResponse.json({ versions: result, rootId });
  } catch (err) {
    console.error('[documents/versions]', err);
    return NextResponse.json({ error: '버전 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
