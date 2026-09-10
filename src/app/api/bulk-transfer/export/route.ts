import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { decryptPassword } from '@/lib/crypto/credentials';
import { generateHanaBulkXls, hanaBulkFilename } from '@/lib/bulk-transfer/hana-excel';
import type { HanaBulkRow } from '@/lib/bulk-transfer/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ItemRow {
  id: string;
  payee_name: string;
  amount: number | string;
  deposit_display: string | null;
  withdraw_display: string | null;
  memo: string | null;
  cms_code: string | null;
  notify_phone: string | null;
  payee: { bank_code: string; enc_account: string; account_holder: string | null; notify_phone: string | null } | null;
}

// POST — 선택한 이체 건들을 하나은행 대량이체 .xls 파일로 생성 (서버에서 계좌 복호화)
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

  const rawIds = (body as { item_ids?: unknown })?.item_ids;
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return NextResponse.json({ error: '이체 건을 1개 이상 선택해 주세요.' }, { status: 400 });
  }
  if (rawIds.length > 1000) {
    return NextResponse.json({ error: '한 번에 최대 1000건까지 생성할 수 있습니다.' }, { status: 400 });
  }
  const ids = rawIds.filter((v): v is string => typeof v === 'string' && UUID_RE.test(v));
  if (ids.length === 0) return NextResponse.json({ error: '유효한 이체 건이 없습니다.' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from('transfer_items')
    .select(
      'id, payee_name, amount, deposit_display, withdraw_display, memo, cms_code, notify_phone, payee:transfer_payees(bank_code, enc_account, account_holder, notify_phone)',
    )
    .in('id', ids); // RLS로 본인 건만 조회됨

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as ItemRow[];
  const valid = rows.filter((r) => r.payee); // 거래처 없는 건 제외
  if (valid.length === 0) {
    return NextResponse.json({ error: '거래처 계좌 정보가 있는 이체 건이 없습니다.' }, { status: 400 });
  }

  const bulkRows: HanaBulkRow[] = valid.map((r) => {
    let account = '';
    try {
      account = decryptPassword(r.payee!.enc_account).replace(/\D/g, '');
    } catch {
      account = '';
    }
    return {
      bankCode: r.payee!.bank_code,
      account,
      amount: typeof r.amount === 'string' ? Number(r.amount) : r.amount,
      accountHolder: r.payee!.account_holder,
      depositDisplay: r.deposit_display,
      withdrawDisplay: r.withdraw_display,
      memo: r.memo,
      cmsCode: r.cms_code,
      notifyPhone: r.notify_phone ?? r.payee!.notify_phone,
    };
  });

  // 계좌 복호화 실패 건이 섞이면 잘못된 이체 위험 → 전량 차단
  if (bulkRows.some((r) => !r.account)) {
    return NextResponse.json(
      { error: '일부 계좌번호를 복호화하지 못했습니다. 해당 거래처를 다시 저장해 주세요.' },
      { status: 500 },
    );
  }

  const buffer = generateHanaBulkXls(bulkRows);

  // 생성한 건은 상태를 exported로 (이미 done인 건은 유지)
  const exportedIds = valid.map((r) => r.id);
  await db
    .from('transfer_items')
    .update({ status: 'exported' })
    .in('id', exportedIds)
    .eq('created_by', userId)
    .neq('status', 'done');

  const dateISO = new Date().toISOString().slice(0, 10);
  const filename = hanaBulkFilename(dateISO);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.ms-excel',
      'Content-Disposition': `attachment; filename="hana_bulk_${dateISO}.xls"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  });
}
