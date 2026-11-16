// 대량이체 변이 API 공용 가드 — 인증 + 요청 출처 + CSRF 토큰 + 활성 사용자(withMutation) + 대표/관리자(requireAdminOrCeo)
// DB 접근은 기존과 같이 사용자 세션 클라이언트(RLS: 소유자 AND 대표/관리자, 051)로 한다.
import type { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdminOrCeo } from '@/lib/http/admin-guard';
import { withMutation } from '@/lib/http/mutation-guard';

type Gate =
  | { error: NextResponse; supabase: null; userId: null }
  | { error: null; supabase: SupabaseClient; userId: string };

export async function bulkTransferMutationGate(request: NextRequest): Promise<Gate> {
  const mutation = await withMutation(request);
  if (mutation.error) return { error: mutation.error, supabase: null, userId: null };
  const denied = await requireAdminOrCeo(mutation.supabase, mutation.userId);
  if (denied) return { error: denied, supabase: null, userId: null };
  return { error: null, supabase: mutation.supabase as unknown as SupabaseClient, userId: mutation.userId };
}
