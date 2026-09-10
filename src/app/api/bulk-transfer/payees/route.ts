import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { encryptPassword, decryptPassword } from '@/lib/crypto/credentials';
import { validatePayeeInput } from '@/lib/bulk-transfer/validate';
import { mapPayee, type RawPayee } from '@/lib/bulk-transfer/map';

const SELECT = 'id, name, bank_code, enc_account, account_holder, notify_phone, memo, created_at, updated_at';

// GET — 본인 거래처 목록 (계좌는 마스킹만 노출)
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from('transfer_payees')
    .select(SELECT)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const payees = ((data ?? []) as RawPayee[]).map((r) => mapPayee(r, decryptPassword));
  return NextResponse.json({ data: payees });
}

// POST — 거래처 생성 (계좌번호 암호화 저장)
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

  const validation = validatePayeeInput(body);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  const input = validation.value;

  let enc_account: string;
  try {
    enc_account = encryptPassword(input.account);
  } catch {
    return NextResponse.json({ error: '계좌 암호화 설정 오류. 관리자에게 문의하세요.' }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from('transfer_payees')
    .insert({
      name: input.name,
      bank_code: input.bank_code,
      enc_account,
      account_holder: input.account_holder,
      notify_phone: input.notify_phone,
      memo: input.memo,
      created_by: userId,
    })
    .select(SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? '거래처 생성 실패' }, { status: 500 });
  }

  return NextResponse.json({ data: mapPayee(data as RawPayee, decryptPassword) }, { status: 201 });
}
