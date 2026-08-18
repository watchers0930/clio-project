import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

const YEAR_START = 2024;
const YEAR_END = 2034;

// GET — 수금액 통계: 올해 월별 + 2024~2034 연간, RLS로 열람 가능 범위만 집계
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
  const monthly = Array(12).fill(0) as number[];
  const yearlyMap: Record<number, number> = {};
  for (let y = YEAR_START; y <= YEAR_END; y += 1) yearlyMap[y] = 0;

  for (const row of (data ?? []) as Array<{ amount: string | number; paid_date: string | null }>) {
    if (!row.paid_date) continue;
    const y = Number(row.paid_date.slice(0, 4));
    const m = Number(row.paid_date.slice(5, 7)) - 1;
    const amount = typeof row.amount === 'number' ? row.amount : Number(row.amount) || 0;
    if (y === year && m >= 0 && m <= 11) monthly[m] += amount;
    if (y >= YEAR_START && y <= YEAR_END) yearlyMap[y] += amount;
  }

  const yearly = [];
  for (let y = YEAR_START; y <= YEAR_END; y += 1) yearly.push({ year: y, amount: yearlyMap[y] });

  const totalCurrent = monthly.reduce((a, b) => a + b, 0);
  const totalPrevious = yearlyMap[year - 1] ?? 0;

  return NextResponse.json({
    data: { year, prevYear: year - 1, monthly, yearly, totalCurrent, totalPrevious },
  });
}
