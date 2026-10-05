import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { validateFixedExpenseInput } from '@/lib/bulk-transfer/validate';
import type { FixedExpense } from '@/lib/bulk-transfer/types';

const SELECT = 'id, label, amount, memo, created_at, updated_at';

interface RawExpense {
  id: string;
  label: string;
  amount: number | string;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

function mapExpense(r: RawExpense): FixedExpense {
  return {
    id: r.id,
    label: r.label,
    amount: Number(r.amount),
    memo: r.memo,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// GET — 본인 월 고정지출 목록
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from('fixed_expenses')
    .select(SELECT)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const expenses = ((data ?? []) as RawExpense[]).map(mapExpense);
  return NextResponse.json({ data: expenses });
}

// POST — 월 고정지출 생성
export async function POST(request: NextRequest) {
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

  const validation = validateFixedExpenseInput(body);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  const input = validation.value;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from('fixed_expenses')
    .insert({
      label: input.label,
      amount: input.amount,
      memo: input.memo,
      created_by: userId,
    })
    .select(SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? '고정지출 생성 실패' }, { status: 500 });
  }

  return NextResponse.json({ data: mapExpense(data as RawExpense) }, { status: 201 });
}
