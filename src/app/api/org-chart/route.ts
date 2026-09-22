import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { getUserRoleInfo, isAdmin } from '@/lib/permissions';

export const maxDuration = 30;

interface OrgUser {
  id: string;
  name: string;
  email: string;
  department_id: string | null;
  manager_user_id: string | null;
  rank_level: number | null;
  rank_title: string | null;
}

// GET /api/org-chart — 조직도(전체 사용자 조직 정보). 결재선 미리보기 등에 쓰이므로 로그인 사용자면 조회 가능.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('users')
    .select('id, name, email, department_id, manager_user_id, rank_level, rank_title')
    .order('rank_level', { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ success: false, error: '조직도 조회 실패' }, { status: 500 });
  return NextResponse.json({ success: true, users: (data ?? []) as OrgUser[] });
}

/** 새 상위자 지정이 사이클을 만드는지 검사. managerId의 상위 체인에 targetId가 있으면 사이클. */
function wouldCreateCycle(users: OrgUser[], targetId: string, newManagerId: string | null): boolean {
  if (!newManagerId) return false;
  if (newManagerId === targetId) return true; // 자기 자신을 상위로
  const byId = new Map(users.map((u) => [u.id, u]));
  let cursor: string | null = newManagerId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === targetId) return true;
    if (seen.has(cursor)) break; // 기존 데이터에 사이클이 있어도 무한루프 방지
    seen.add(cursor);
    cursor = byId.get(cursor)?.manager_user_id ?? null;
  }
  return false;
}

// PUT /api/org-chart — 사용자 조직 정보(직속 상위·직위) 수정. admin 전용.
// body { userId, managerUserId, rankLevel, rankTitle }
export async function PUT(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

  const authUserId = await getAuthUserId(supabase);
  if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

  const roleInfo = await getUserRoleInfo(supabase, authUserId);
  if (!roleInfo || !isAdmin(roleInfo.role)) {
    return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  let body: { userId?: string; managerUserId?: string | null; rankLevel?: number | null; rankTitle?: string | null } = {};
  try { body = await request.json(); } catch { /* 빈 body */ }

  const userId = typeof body.userId === 'string' ? body.userId : '';
  if (!userId) return NextResponse.json({ success: false, error: '대상 사용자 id가 필요합니다.' }, { status: 400 });

  const managerUserId = body.managerUserId ?? null;
  const rankLevel = body.rankLevel === null || body.rankLevel === undefined ? null : Number(body.rankLevel);
  const rankTitle = typeof body.rankTitle === 'string' ? body.rankTitle.trim().slice(0, 40) : null;

  if (rankLevel !== null && (!Number.isInteger(rankLevel) || rankLevel < 1 || rankLevel > 20)) {
    return NextResponse.json({ success: false, error: '직위 레벨은 1~20 사이여야 합니다.' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  // 사이클 방지: 현재 조직도를 읽어 새 상위 지정이 순환을 만드는지 검사
  const { data: allUsers } = await admin
    .from('users')
    .select('id, name, email, department_id, manager_user_id, rank_level, rank_title');
  const users = (allUsers ?? []) as OrgUser[];

  if (managerUserId && !users.some((u) => u.id === managerUserId)) {
    return NextResponse.json({ success: false, error: '존재하지 않는 상위자입니다.' }, { status: 400 });
  }
  if (wouldCreateCycle(users, userId, managerUserId)) {
    return NextResponse.json({ success: false, error: '순환 구조가 됩니다. 직속 상위자를 다시 선택해 주세요.' }, { status: 400 });
  }

  const { error } = await admin
    .from('users')
    .update({ manager_user_id: managerUserId, rank_level: rankLevel, rank_title: rankTitle })
    .eq('id', userId);

  if (error) return NextResponse.json({ success: false, error: '조직도 저장 실패: ' + error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
