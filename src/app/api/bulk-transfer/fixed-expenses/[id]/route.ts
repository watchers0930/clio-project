import { NextRequest, NextResponse } from 'next/server';
import { validateFixedExpenseInput } from '@/lib/bulk-transfer/validate';
import type { FixedExpense } from '@/lib/bulk-transfer/types';
import { bulkTransferMutationGate } from '@/lib/bulk-transfer/route-guard';

const SELECT = 'id, label, amount, memo, created_at, updated_at';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// PATCH — 월 고정지출 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });

  // 변이 요청: 인증 + 출처 + CSRF 토큰 + 활성 사용자 + 대표/관리자
  const gate = await bulkTransferMutationGate(request);
  if (gate.error) return gate.error;
  const { supabase } = gate;

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
    .update({ label: input.label, amount: input.amount, memo: input.memo })
    .eq('id', id)
    .select(SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? '고정지출 항목을 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ data: mapExpense(data as RawExpense) });
}

// DELETE — 월 고정지출 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });

  // 변이 요청: 인증 + 출처 + CSRF 토큰 + 활성 사용자 + 대표/관리자
  const gate = await bulkTransferMutationGate(request);
  if (gate.error) return gate.error;
  const { supabase } = gate;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { error } = await db.from('fixed_expenses').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
