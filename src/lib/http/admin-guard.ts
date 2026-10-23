import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ApiResponse } from '@/lib/supabase/types';

/**
 * 민감 메뉴(대량이체·계정관리·템플릿 관리) API 권한 가드.
 * 라우트에서 getAuthUserId로 인증을 확인한 뒤, 아래 가드로 역할/직급 권한을 확인한다.
 * 통과하면 null, 막히면 403 NextResponse를 반환한다:
 *   const guard = await requireAdminOrCeo(supabase, userId);
 *   if (guard) return guard;
 */

async function fetchRoleRank(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ role: string; rank_level: number | null; is_active: boolean | null } | null> {
  const { data } = await supabase
    .from('users')
    .select('role, rank_level, is_active')
    .eq('id', userId)
    .single();
  return (data as { role: string; rank_level: number | null; is_active: boolean | null } | null) ?? null;
}

function forbidden(): NextResponse {
  return NextResponse.json<ApiResponse>(
    { success: false, error: '접근 권한이 없습니다.' },
    { status: 403 },
  );
}

/**
 * 대표이사(rank_level<=1) 또는 시스템 관리자(role='admin')만 허용.
 * 대량이체·계정관리처럼 UI에서 "대표/어드민"에게만 노출하는 민감 기능에 사용.
 * 대표(rank_level=1)는 role이 admin이 아닐 수 있어 rank_level을 함께 본다.
 */
export async function requireAdminOrCeo(
  supabase: SupabaseClient,
  userId: string,
): Promise<NextResponse | null> {
  const info = await fetchRoleRank(supabase, userId);
  if (!info || info.is_active === false) return forbidden();
  const allowed = info.role === 'admin' || (typeof info.rank_level === 'number' && info.rank_level <= 1);
  return allowed ? null : forbidden();
}

/**
 * 시스템 관리자(role='admin')만 허용.
 * 템플릿 쓰기(생성·수정·삭제)처럼 관리자 전용 쓰기 작업에 사용.
 * (템플릿 조회 GET은 문서 생성에 필요하므로 가드하지 않는다.)
 */
export async function requireAdmin(
  supabase: SupabaseClient,
  userId: string,
): Promise<NextResponse | null> {
  const info = await fetchRoleRank(supabase, userId);
  if (!info || info.is_active === false) return forbidden();
  return info.role === 'admin' ? null : forbidden();
}
