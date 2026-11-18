import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { requireAdminOrCeo } from '@/lib/http/admin-guard';
import { bulkTransferMutationGate } from '@/lib/bulk-transfer/route-guard';

// GET — 본인 현재 잔고
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const guard = await requireAdminOrCeo(supabase, userId);
  if (guard) return guard;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  // 잔고는 대표·관리자 공용(068) — 사용자별 행 중 가장 최근에 고친 값 하나를 쓴다
  const { data, error } = await db
    .from('fixed_expense_settings')
    .select('balance')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: { balance: data ? Number(data.balance) : 0 } });
}

// PUT — 현재 잔고 저장(upsert)
export async function PUT(request: NextRequest) {
  // 변이 요청: 인증 + 출처 + CSRF 토큰 + 활성 사용자 + 대표/관리자
  const gate = await bulkTransferMutationGate(request);
  if (gate.error) return gate.error;
  const { supabase, userId } = gate;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 본문을 읽을 수 없습니다.' }, { status: 400 });
  }
  const raw = (body ?? {}) as Record<string, unknown>;
  const balance = typeof raw.balance === 'number' ? raw.balance : Number(raw.balance);
  if (!Number.isFinite(balance) || balance < 0) {
    return NextResponse.json({ error: '잔고는 0 이상의 숫자여야 합니다.' }, { status: 400 });
  }
  if (balance > 1_000_000_000_000) {
    return NextResponse.json({ error: '잔고가 한도를 초과했습니다.' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  // 공용 잔고(068): 이미 있는 가장 최근 행을 고치고, 하나도 없을 때만 본인 명의로 만든다
  const { data: current, error: readErr } = await db
    .from('fixed_expense_settings')
    .select('created_by')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  // upsert 는 수정 경로에서도 생성 정책(본인 명의)을 검사받아 남의 행을 못 고치므로 update / insert 로 나눈다
  const value = Math.round(balance);
  const { data, error } = current
    ? await db.from('fixed_expense_settings').update({ balance: value }).eq('created_by', current.created_by).select('balance').single()
    : await db.from('fixed_expense_settings').insert({ created_by: userId, balance: value }).select('balance').single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? '잔고 저장 실패' }, { status: 500 });
  }
  return NextResponse.json({ data: { balance: Number(data.balance) } });
}
