import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
  }

  const userId = await getAuthUserId(supabase);
  if (!userId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;

  // 검색/필터 파라미터
  const q = searchParams.get('q')?.trim() ?? '';
  const contractType = searchParams.get('contract_type') ?? '';
  const sort = searchParams.get('sort') ?? 'latest';

  const admin = createAdminSupabaseClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any)
    .from('contract_risk_analyses')
    .select('id, file_name, file_type, contract_type, perspective, risk_count, status, created_at', { count: 'exact' })
    .eq('user_id', userId);

  // 파일명 검색 (ilike)
  if (q) {
    query = query.ilike('file_name', `%${q}%`);
  }

  // 계약 유형 필터
  if (contractType) {
    query = query.eq('contract_type', contractType);
  }

  // 정렬
  if (sort === 'risk_high') {
    query = query.order('risk_count->high', { ascending: false }).order('created_at', { ascending: false });
  } else if (sort === 'oldest') {
    query = query.order('created_at', { ascending: true });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1) as {
    data: unknown[] | null;
    error: unknown;
    count: number | null;
  };

  if (error) {
    console.error('[contract-risk/history] SELECT error:', error);
    return NextResponse.json({ error: '이력 조회에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    limit,
  });
}
