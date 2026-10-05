import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

// GET — 본인 현재 잔고
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from('fixed_expense_settings')
    .select('balance')
    .eq('created_by', userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: { balance: data ? Number(data.balance) : 0 } });
}

// PUT — 현재 잔고 저장(upsert)
export async function PUT(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

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
  const { data, error } = await db
    .from('fixed_expense_settings')
    .upsert({ created_by: userId, balance: Math.round(balance) }, { onConflict: 'created_by' })
    .select('balance')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? '잔고 저장 실패' }, { status: 500 });
  }
  return NextResponse.json({ data: { balance: Number(data.balance) } });
}
