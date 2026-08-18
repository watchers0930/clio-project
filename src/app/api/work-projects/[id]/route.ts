import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { validateWorkProjectInput } from '@/lib/work-ledger/validate';
import { mapWorkProject, type RawWorkProject } from '@/lib/work-ledger/map';
import { marginRate } from '@/lib/work-ledger/calc';

const SELECT = '*, payments:work_project_payments(*), manager:users!manager_id(name)';

// PATCH — 프로젝트 수정 + 대금 단계 전체 교체
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const validation = validateWorkProjectInput(body);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  const input = validation.value;

  // 신규 테이블은 생성된 타입에 없어 캐스팅 (RLS로 접근 제어)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: updated, error: updErr } = await db
    .from('work_projects')
    .update({
      name: input.name,
      status: input.status,
      client_name: input.client_name,
      supplier_name: input.supplier_name,
      manager_id: input.manager_id,
      contract_date: input.contract_date,
      due_date: input.due_date,
      contract_amount: input.contract_amount,
      purchase_amount: input.purchase_amount,
      margin_rate: marginRate(input.contract_amount, input.purchase_amount),
      visible_department_ids: input.visible_department_ids,
      note: input.note,
    })
    .eq('id', id)
    .select('id')
    .single();

  // RLS 위반 시 updated=null → 권한 없음
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: '수정 권한이 없거나 프로젝트를 찾을 수 없습니다.' }, { status: 403 });

  // 대금 단계 전체 교체
  const { error: delErr } = await db.from('work_project_payments').delete().eq('project_id', id);
  if (delErr) return NextResponse.json({ error: '대금 단계 갱신 실패: ' + delErr.message }, { status: 500 });

  if (input.payments.length > 0) {
    const rows = input.payments.map((p, i) => ({
      project_id: id,
      type: p.type,
      seq: p.seq,
      amount: p.amount,
      due_date: p.due_date,
      paid: p.paid,
      paid_date: p.paid_date,
      sort_order: p.sort_order ?? i,
    }));
    const { error: payErr } = await db.from('work_project_payments').insert(rows);
    if (payErr) return NextResponse.json({ error: '대금 단계 저장 실패: ' + payErr.message }, { status: 500 });
  }

  const { data: full } = await db.from('work_projects').select(SELECT).eq('id', id).single();
  return NextResponse.json({ data: full ? mapWorkProject(full as unknown as RawWorkProject) : null });
}

// DELETE — 프로젝트 삭제 (대금 단계 cascade)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { data: deleted, error } = await supabase
    .from('work_projects')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!deleted) return NextResponse.json({ error: '삭제 권한이 없거나 프로젝트를 찾을 수 없습니다.' }, { status: 403 });

  return NextResponse.json({ success: true });
}
