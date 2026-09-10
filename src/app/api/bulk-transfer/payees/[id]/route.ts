import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { encryptPassword, decryptPassword } from '@/lib/crypto/credentials';
import { validatePayeeInput } from '@/lib/bulk-transfer/validate';
import { mapPayee, type RawPayee } from '@/lib/bulk-transfer/map';

const SELECT = 'id, name, bank_code, enc_account, account_holder, notify_phone, memo, created_at, updated_at';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH — 거래처 수정 (계좌 재암호화)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });

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

  // 수정 시 계좌 미입력이면 기존 계좌 유지 (평문을 클라이언트로 내리지 않기 위함)
  const validation = validatePayeeInput(body, { accountOptional: true });
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  const input = validation.value;

  const patch: Record<string, unknown> = {
    name: input.name,
    bank_code: input.bank_code,
    account_holder: input.account_holder,
    notify_phone: input.notify_phone,
    memo: input.memo,
  };
  if (input.account) {
    try {
      patch.enc_account = encryptPassword(input.account);
    } catch {
      return NextResponse.json({ error: '계좌 암호화 설정 오류. 관리자에게 문의하세요.' }, { status: 500 });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from('transfer_payees')
    .update(patch)
    .eq('id', id)
    .eq('created_by', userId) // RLS 이중 방어
    .select(SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? '거래처를 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ data: mapPayee(data as RawPayee, decryptPassword) });
}

// DELETE — 거래처 삭제 (참조 중인 이체 건이 있으면 DB가 restrict로 차단)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { error } = await db.from('transfer_payees').delete().eq('id', id).eq('created_by', userId);

  if (error) {
    // FK restrict 위반 등
    const msg = /foreign key|violates|restrict/i.test(error.message)
      ? '이 거래처를 사용하는 이체 건이 있어 삭제할 수 없습니다. 먼저 이체 건을 삭제해 주세요.'
      : error.message;
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
