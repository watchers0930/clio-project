// 관리비 API 공용 가드 — 시스템 관리자(role='admin')만 통과, DB 는 service role 로만 접근
// 056 테이블은 사용자 세션 정책이 0개라 반드시 이 가드를 거친 admin 클라이언트로 읽고 쓴다.
import type { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAuth } from '@/lib/api-helper';
import { requireAdmin } from '@/lib/http/admin-guard';
import { withMutation } from '@/lib/http/mutation-guard';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

type Gate = { error: NextResponse; db: null; userId: null } | { error: null; db: SupabaseClient; userId: string };

/** 조회용: 로그인 + 관리자 */
export async function feeReadGate(): Promise<Gate> {
  const auth = await withAuth();
  if (auth.error) return { error: auth.error, db: null, userId: null };
  const denied = await requireAdmin(auth.supabase, auth.userId);
  if (denied) return { error: denied, db: null, userId: null };
  return { error: null, db: createAdminSupabaseClient() as unknown as SupabaseClient, userId: auth.userId };
}

/** 변이용: 로그인 + 출처 + CSRF + 활성 사용자 + 관리자 */
export async function feeMutationGate(request: NextRequest): Promise<Gate> {
  const mutation = await withMutation(request);
  if (mutation.error) return { error: mutation.error, db: null, userId: null };
  const denied = await requireAdmin(mutation.supabase, mutation.userId);
  if (denied) return { error: denied, db: null, userId: null };
  return { error: null, db: mutation.admin as unknown as SupabaseClient, userId: mutation.userId };
}

/** JSON 본문 파싱 — 실패 시 undefined */
export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export const UNIQUE_VIOLATION = '23505';
export const FK_VIOLATION = '23503';

// 항목 상한 — 조회 상한(ENTRY_FETCH_LIMIT)이 항목 × 13개월(전년 12월 포함)을 언제나 담도록 함께 정한다
export const MAX_ITEMS = 200;
export const ENTRY_FETCH_LIMIT = MAX_ITEMS * 13;
