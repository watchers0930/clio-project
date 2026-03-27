import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');
    const type = searchParams.get('type');

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ templates: [], error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ templates: [], error: '인증이 필요합니다.' }, { status: 401 });
    }

    let query = supabase
      .from('templates')
      .select('*, departments:department_id(name)');

    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }
    if (type) {
      query = query.eq('scope', type);
    }

    const { data: rows, error } = await query;
    if (error) {
      console.error('[templates/GET]', error.message);
      return NextResponse.json({ templates: [], error: '템플릿 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    const tplList = (rows ?? []).map((t) => {
      const deptJoin = (t as Record<string, unknown>).departments as { name: string } | null;
      const placeholders = Array.isArray(t.placeholders) ? t.placeholders : [];
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        department: deptJoin?.name ?? '전사',
        departmentId: t.department_id,
        scope: t.scope === 'company' ? '전사 공용' : '부서 전용',
        placeholders,
        lastUpdated: t.updated_at.split('T')[0],
        usageCount: 0,
      };
    });

    return NextResponse.json({ templates: tplList });
  } catch {
    return NextResponse.json({ templates: [], error: '템플릿 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, departmentId, scope } = body;

    if (!name) {
      return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const scopeValue = scope === '부서 전용' ? 'department' : 'company';

    const { data: newTmpl, error } = await supabase.from('templates').insert({
      name,
      description: description ?? '',
      department_id: departmentId || null,
      scope: scopeValue,
      content: '',
      placeholders: [],
    }).select('*, departments:department_id(name)').single();

    if (error) {
      console.error('[templates/POST]', error.message);
      return NextResponse.json({ error: '템플릿 생성에 실패했습니다.' }, { status: 500 });
    }

    const deptJoin = (newTmpl as Record<string, unknown>).departments as { name: string } | null;

    return NextResponse.json({
      template: {
        id: newTmpl.id,
        name: newTmpl.name,
        description: newTmpl.description,
        department: deptJoin?.name ?? '전사',
        departmentId: newTmpl.department_id,
        scope: scope ?? '전사 공용',
        placeholders: [],
        lastUpdated: newTmpl.updated_at.split('T')[0],
        usageCount: 0,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '템플릿 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, departmentId, scope } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (departmentId !== undefined) updateData.department_id = departmentId;
    if (scope !== undefined) updateData.scope = scope === '부서 전용' ? 'department' : 'company';

    const { data, error } = await supabase
      .from('templates')
      .update(updateData)
      .eq('id', id)
      .select('*, departments:department_id(name)')
      .single();

    if (error) {
      console.error('[templates/PUT]', error.message);
      return NextResponse.json({ error: '템플릿 수정에 실패했습니다.' }, { status: 500 });
    }

    const deptJoin = (data as Record<string, unknown>).departments as { name: string } | null;
    const placeholders = Array.isArray(data.placeholders) ? data.placeholders : [];

    return NextResponse.json({
      template: {
        id: data.id,
        name: data.name,
        description: data.description,
        department: deptJoin?.name ?? '전사',
        departmentId: data.department_id,
        scope: data.scope === 'company' ? '전사 공용' : '부서 전용',
        placeholders,
        lastUpdated: data.updated_at.split('T')[0],
        usageCount: 0,
      },
    });
  } catch {
    return NextResponse.json({ error: '템플릿 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const { error } = await supabase.from('templates').delete().eq('id', id);
    if (error) {
      console.error('[templates/DELETE]', error.message);
      return NextResponse.json({ error: '템플릿 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '템플릿 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
