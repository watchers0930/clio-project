import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

// GET — 월별 수금액 통계 (올해 vs 작년), RLS로 열람 가능 범위만 집계
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  // 신규 테이블은 생성 타입에 없어 캐스팅 (RLS로 접근 제어)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from('work_project_payments')
    .select('amount, paid_date')
    .eq('paid', true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date();
  const year = now.getFullYear();
  const prevYear = year - 1;
  const monthlyCurrent = Array(12).fill(0) as number[];
  const monthlyPrevious = Array(12).fill(0) as number[];

  for (const row of (data ?? []) as Array<{ amount: string | number; paid_date: string | null }>) {
    if (!row.paid_date) continue;
    const m = Number(row.paid_date.slice(5, 7)) - 1; // 'YYYY-MM-DD'
    const y = Number(row.paid_date.slice(0, 4));
    if (m < 0 || m > 11) continue;
    const amount = typeof row.amount === 'number' ? row.amount : Number(row.amount) || 0;
    if (y === year) monthlyCurrent[m] += amount;
    else if (y === prevYear) monthlyPrevious[m] += amount;
  }

  const totalCurrent = monthlyCurrent.reduce((a, b) => a + b, 0);
  const totalPrevious = monthlyPrevious.reduce((a, b) => a + b, 0);

  return NextResponse.json({
    data: { year, prevYear, monthlyCurrent, monthlyPrevious, totalCurrent, totalPrevious },
  });
}
