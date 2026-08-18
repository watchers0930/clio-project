import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { validateWorkProjectInput } from '@/lib/work-ledger/validate';
import { mapWorkProject, type RawWorkProject } from '@/lib/work-ledger/map';

const SELECT = '*, payments:work_project_payments(*), manager:users!manager_id(name)';

// GET — 열람 가능한 프로젝트 목록 (RLS로 팀 열람 범위 자동 적용)
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { data, error } = await supabase
    .from('work_projects')
    .select(SELECT)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const projects = ((data ?? []) as unknown as RawWorkProject[]).map(mapWorkProject);
  return NextResponse.json({ data: projects });
}

// POST — 프로젝트 + 대금 단계 생성
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

  const validation = validateWorkProjectInput(body);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  const input = validation.value;

  // 신규 테이블은 생성된 타입에 없어 캐스팅 (RLS로 접근 제어)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: project, error: insErr } = await db
    .from('work_projects')
    .insert({
      name: input.name,
      status: input.status,
      client_name: input.client_name,
      manager_id: input.manager_id,
      contract_date: input.contract_date,
      due_date: input.due_date,
      contract_amount: input.contract_amount,
      margin_rate: input.margin_rate,
      visible_department_ids: input.visible_department_ids,
      note: input.note,
      created_by: userId,
    })
    .select('id')
    .single();

  if (insErr || !project) {
    return NextResponse.json({ error: insErr?.message ?? '프로젝트 생성 실패' }, { status: 500 });
  }

  if (input.payments.length > 0) {
    const rows = input.payments.map((p, i) => ({
      project_id: project.id,
      type: p.type,
      seq: p.seq,
      amount: p.amount,
      due_date: p.due_date,
      paid: p.paid,
      paid_date: p.paid_date,
      sort_order: p.sort_order ?? i,
    }));
    const { error: payErr } = await db.from('work_project_payments').insert(rows);
    if (payErr) {
      // 대금 삽입 실패 시 프로젝트 롤백
      await db.from('work_projects').delete().eq('id', project.id);
      return NextResponse.json({ error: '대금 단계 저장 실패: ' + payErr.message }, { status: 500 });
    }
  }

  const { data: full } = await db.from('work_projects').select(SELECT).eq('id', project.id).single();
  return NextResponse.json({ data: full ? mapWorkProject(full as unknown as RawWorkProject) : null }, { status: 201 });
}
