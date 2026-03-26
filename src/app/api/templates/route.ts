import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { templates as mockTemplates, departments } from '@/lib/mock-data';

// Supabase 미설정 시 세션 내 임시 저장용
let sessionTemplates = [...mockTemplates];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');
    const type = searchParams.get('type');

    /* ── Supabase 연동 ── */
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      let query = supabase
        .from('templates')
        .select('*, departments:department_id(name)');

      if (departmentId) {
        query = query.eq('department_id', departmentId);
      }
      // scope 또는 type 필터
      if (type) {
        // DB 스키마: scope 컬럼 / 레거시: type 컬럼
        query = query.or(`scope.eq.${type},type.eq.${type}`);
      }

      const { data: rows, error } = await query;
      if (error) throw error;

      const tplList = (rows ?? []).map((t) => {
        const deptJoin = (t as Record<string, unknown>).departments as { name: string } | null;
        // content가 문자열이면 placeholders는 별도 필드, 객체면 레거시 형태
        const placeholders = Array.isArray(t.placeholders)
          ? t.placeholders
          : typeof t.content === 'object' && t.content !== null
            ? (t.content as { placeholders?: string[] }).placeholders ?? []
            : [];
        return {
          id: t.id,
          name: t.name,
          description: t.description,
          department: deptJoin?.name ?? '전사',
          departmentId: t.department_id,
          scope: (t.scope ?? t.type) === 'company' ? '전사 공용' : '부서 전용',
          placeholders,
          lastUpdated: t.updated_at.split('T')[0],
          usageCount: 0, // TODO: 실사용 집계
        };
      });

      return NextResponse.json({ templates: tplList });
    }

    /* ── 폴백: mock 데이터 ── */
    let filtered = sessionTemplates.filter((t) => t.is_active);

    if (departmentId) {
      filtered = filtered.filter((t) => t.department_id === departmentId);
    }
    if (type) {
      filtered = filtered.filter((t) => t.type === type);
    }

    const tplList = filtered.map((t) => {
      const dept = departments.find((d) => d.id === t.department_id);
      const placeholders = typeof t.content === 'object' && t.content !== null
        ? (t.content as { placeholders?: string[] }).placeholders ?? []
        : [];
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        department: dept?.name ?? '전사',
        departmentId: t.department_id,
        scope: t.type === 'company' ? '전사 공용' : '부서 전용',
        placeholders,
        lastUpdated: t.updated_at.split('T')[0],
        usageCount: Math.floor(Math.random() * 80) + 10,
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

    const scopeValue = scope === '부서 전용' ? 'department' : 'company';
    const deptId = departmentId || 'dept-1';

    /* ── Supabase 연동 ── */
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { data: newTmpl, error } = await supabase.from('templates').insert({
        name,
        description: description ?? '',
        department_id: deptId,
        scope: scopeValue,
        content: '',
        placeholders: [],
      } as Record<string, unknown>).select('*, departments:department_id(name)').single();

      if (error) throw error;

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
    }

    /* ── 폴백: mock ── */
    const dept = departments.find((d) => d.id === deptId);
    const now = new Date().toISOString();
    const newTemplate = {
      id: `tmpl-${Date.now()}`,
      name,
      description: description ?? '',
      department_id: deptId,
      type: scopeValue as 'department' | 'company',
      content: { placeholders: [] as string[], structure: {} },
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    sessionTemplates.push(newTemplate);

    return NextResponse.json({
      template: {
        id: newTemplate.id,
        name: newTemplate.name,
        description: newTemplate.description,
        department: dept?.name ?? '전사',
        departmentId: newTemplate.department_id,
        scope: scope ?? '전사 공용',
        placeholders: [],
        lastUpdated: now.split('T')[0],
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

    /* ── Supabase 연동 ── */
    const supabase = await createServerSupabaseClient();
    if (supabase) {
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

      if (error) throw error;

      const deptJoin = (data as Record<string, unknown>).departments as { name: string } | null;
      const placeholders = Array.isArray(data.placeholders)
        ? data.placeholders
        : typeof data.content === 'object' && data.content !== null
          ? ((data.content as Record<string, unknown>).placeholders as string[] ?? [])
          : [];

      return NextResponse.json({
        template: {
          id: data.id,
          name: data.name,
          description: data.description,
          department: deptJoin?.name ?? '전사',
          departmentId: data.department_id,
          scope: (data.scope ?? data.type) === 'company' ? '전사 공용' : '부서 전용',
          placeholders,
          lastUpdated: data.updated_at.split('T')[0],
          usageCount: 0,
        },
      });
    }

    /* ── 폴백: mock ── */
    const idx = sessionTemplates.findIndex((t) => t.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: '템플릿을 찾을 수 없습니다.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    if (name !== undefined) sessionTemplates[idx].name = name;
    if (description !== undefined) sessionTemplates[idx].description = description;
    if (departmentId !== undefined) sessionTemplates[idx].department_id = departmentId;
    if (scope !== undefined) sessionTemplates[idx].type = scope === '부서 전용' ? 'department' : 'company';
    sessionTemplates[idx].updated_at = now;

    const t = sessionTemplates[idx];
    const dept = departments.find((d) => d.id === t.department_id);
    const placeholders = typeof t.content === 'object' && t.content !== null
      ? (t.content as { placeholders?: string[] }).placeholders ?? []
      : [];

    return NextResponse.json({
      template: {
        id: t.id,
        name: t.name,
        description: t.description,
        department: dept?.name ?? '전사',
        departmentId: t.department_id,
        scope: t.type === 'company' ? '전사 공용' : '부서 전용',
        placeholders,
        lastUpdated: now.split('T')[0],
        usageCount: Math.floor(Math.random() * 80) + 10,
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

    /* ── Supabase 연동 ── */
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    /* ── 폴백: mock ── */
    const idx = sessionTemplates.findIndex((t) => t.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: '템플릿을 찾을 수 없습니다.' }, { status: 404 });
    }

    sessionTemplates.splice(idx, 1);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '템플릿 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
