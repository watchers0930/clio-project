import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { decryptPassword } from '@/lib/crypto/credentials';
import { validateItemInput } from '@/lib/bulk-transfer/validate';
import { mapItem, type RawItem } from '@/lib/bulk-transfer/map';
import type { TransferStatus } from '@/lib/bulk-transfer/types';

const SELECT =
  'id, payee_id, payee_name, amount, deposit_display, withdraw_display, memo, cms_code, notify_phone, status, source_type, source_id, created_at, updated_at, payee:transfer_payees(bank_code, enc_account)';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: TransferStatus[] = ['pending', 'exported', 'done'];

// PATCH — 이체 건 수정. status만 보내면 상태만 변경, 그 외엔 전체 수정.
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
  const b = (body ?? {}) as Record<string, unknown>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const editKeys = ['payee_id', 'amount', 'deposit_display', 'withdraw_display', 'cms_code'];
  const isStatusOnly = b.status !== undefined && !editKeys.some((k) => k in b);

  let patch: Record<string, unknown>;

  if (isStatusOnly) {
    if (!STATUSES.includes(b.status as TransferStatus)) {
      return NextResponse.json({ error: '상태 값이 올바르지 않습니다.' }, { status: 400 });
    }
    patch = { status: b.status };
  } else {
    const validation = validateItemInput(body);
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
    const input = validation.value;

    // 거래처 재확인 + 스냅샷명 갱신
    const { data: payee } = await db
      .from('transfer_payees')
      .select('id, name')
      .eq('id', input.payee_id)
      .single();
    if (!payee) return NextResponse.json({ error: '거래처를 찾을 수 없습니다.' }, { status: 404 });

    patch = {
      payee_id: input.payee_id,
      payee_name: payee.name,
      amount: input.amount,
      deposit_display: input.deposit_display,
      withdraw_display: input.withdraw_display,
      memo: input.memo,
      cms_code: input.cms_code,
      notify_phone: input.notify_phone,
    };
    if (b.status !== undefined && STATUSES.includes(b.status as TransferStatus)) {
      patch.status = b.status;
    }
  }

  const { data, error } = await db
    .from('transfer_items')
    .update(patch)
    .eq('id', id)
    .eq('created_by', userId)
    .select(SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? '이체 건을 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ data: mapItem(data as RawItem, decryptPassword) });
}

// DELETE — 이체 건 삭제
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
  const { error } = await db.from('transfer_items').delete().eq('id', id).eq('created_by', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
