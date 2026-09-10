import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { decryptPassword } from '@/lib/crypto/credentials';
import { validateItemInput } from '@/lib/bulk-transfer/validate';
import { mapItem, type RawItem } from '@/lib/bulk-transfer/map';

const SELECT =
  'id, payee_id, payee_name, amount, deposit_display, withdraw_display, memo, cms_code, notify_phone, status, source_type, source_id, created_at, updated_at, payee:transfer_payees(bank_code, enc_account)';

// GET — 본인 이체 예정 건 목록
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from('transfer_items')
    .select(SELECT)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = ((data ?? []) as RawItem[]).map((r) => mapItem(r, decryptPassword));
  return NextResponse.json({ data: items });
}

// POST — 이체 건 생성 (거래처 스냅샷명 기록)
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

  const validation = validateItemInput(body);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  const input = validation.value;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // 거래처 소유/존재 확인 + 스냅샷명 확보 (RLS로 본인 것만 조회됨)
  const { data: payee } = await db
    .from('transfer_payees')
    .select('id, name')
    .eq('id', input.payee_id)
    .single();
  if (!payee) return NextResponse.json({ error: '거래처를 찾을 수 없습니다.' }, { status: 404 });

  const { data, error } = await db
    .from('transfer_items')
    .insert({
      payee_id: input.payee_id,
      payee_name: payee.name,
      amount: input.amount,
      deposit_display: input.deposit_display,
      withdraw_display: input.withdraw_display,
      memo: input.memo,
      cms_code: input.cms_code,
      notify_phone: input.notify_phone,
      status: 'pending',
      source_type: input.source_type ?? 'manual',
      source_id: input.source_id ?? null,
      created_by: userId,
    })
    .select(
      'id, payee_id, payee_name, amount, deposit_display, withdraw_display, memo, cms_code, notify_phone, status, source_type, source_id, created_at, updated_at, payee:transfer_payees(bank_code, enc_account)',
    )
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? '이체 건 생성 실패' }, { status: 500 });
  }

  return NextResponse.json({ data: mapItem(data as RawItem, decryptPassword) }, { status: 201 });
}
