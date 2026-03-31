import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

/** MIME → 확장자 매핑 */
function mimeToType(mime: string | null, name: string): string {
  if (!mime) return name.split('.').pop()?.toUpperCase() ?? 'FILE';
  const map: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    'application/haansofthwp': 'HWP',
    'application/x-hwp': 'HWP',
    'text/markdown': 'MD',
  };
  return map[mime] ?? name.split('.').pop()?.toUpperCase() ?? 'FILE';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
      .select('*, departments:department_id(name), template_file:template_file_id(id, name, type, size)');

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
      const fileJoin = (t as Record<string, unknown>).template_file as { id: string; name: string; type: string; size: number } | null;
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
        templateFile: fileJoin ? {
          id: fileJoin.id,
          name: fileJoin.name,
          type: mimeToType(fileJoin.type, fileJoin.name),
          size: formatSize(fileJoin.size),
        } : null,
      };
    });

    return NextResponse.json({ templates: tplList });
  } catch {
    return NextResponse.json({ templates: [], error: '템플릿 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

/** 파일 업로드 → files 테이블 INSERT → process 파이프라인 호출 → file.id 반환 */
async function uploadTemplateFile(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, file: File, authUserId: string, requestOrigin: string): Promise<string | null> {
  if (!supabase) return null;
  const storagePath = `uploads/templates/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage.from('files').upload(storagePath, file);
  if (uploadError) {
    console.error('[templates] storage upload:', uploadError.message);
    return null;
  }

  const { data, error } = await supabase.from('files').insert({
    name: file.name,
    type: file.type,
    size: file.size,
    department_id: null,
    uploaded_by: authUserId,
    status: 'processing',
    storage_path: storagePath,
  }).select('id').single();

  if (error) {
    console.error('[templates] file insert:', error.message);
    return null;
  }

  // 텍스트 추출/청킹/임베딩 파이프라인 호출
  const internalSecret = process.env.INTERNAL_API_SECRET || '';
  fetch(`${requestOrigin}/api/files/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': internalSecret },
    body: JSON.stringify({ fileId: data.id }),
  }).then(() => {}, () => {});

  return data.id;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') ?? '';
    let name = '';
    let description = '';
    let departmentId: string | null = null;
    let scope = '전사 공용';
    let templateFileId: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      name = (formData.get('name') as string) ?? '';
      description = (formData.get('description') as string) ?? '';
      departmentId = (formData.get('departmentId') as string) || null;
      scope = (formData.get('scope') as string) ?? '전사 공용';
      const file = formData.get('file') as File | null;
      if (file && file.size > 0) {
        templateFileId = await uploadTemplateFile(supabase, file, authUserId, request.nextUrl.origin);
      }
    } else {
      const body = await request.json();
      name = body.name ?? '';
      description = body.description ?? '';
      departmentId = body.departmentId || null;
      scope = body.scope ?? '전사 공용';
      if (body.templateFileId) templateFileId = body.templateFileId;
    }

    if (!name) {
      return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 });
    }

    const scopeValue = scope === '부서 전용' ? 'department' : 'company';

    const insertData: Record<string, unknown> = {
      name,
      description: description ?? '',
      department_id: departmentId,
      scope: scopeValue,
      content: '',
      placeholders: [],
      created_by: authUserId,
    };
    if (templateFileId) insertData.template_file_id = templateFileId;

    const { data: newTmpl, error } = await supabase.from('templates').insert(insertData)
      .select('*, departments:department_id(name), template_file:template_file_id(id, name, type, size)').single();

    if (error) {
      console.error('[templates/POST]', error.message);
      return NextResponse.json({ error: '템플릿 생성에 실패했습니다.' }, { status: 500 });
    }

    const deptJoin = (newTmpl as Record<string, unknown>).departments as { name: string } | null;
    const fileJoin = (newTmpl as Record<string, unknown>).template_file as { id: string; name: string; type: string; size: number } | null;

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
        templateFile: fileJoin ? {
          id: fileJoin.id,
          name: fileJoin.name,
          type: mimeToType(fileJoin.type, fileJoin.name),
          size: formatSize(fileJoin.size),
        } : null,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '템플릿 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') ?? '';
    let id = '';
    let name: string | undefined;
    let description: string | undefined;
    let departmentId: string | undefined;
    let scope: string | undefined;
    let templateFileId: string | null | undefined;
    let removeFile = false;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      id = (formData.get('id') as string) ?? '';
      name = (formData.get('name') as string) || undefined;
      description = (formData.get('description') as string) ?? undefined;
      departmentId = (formData.get('departmentId') as string) || undefined;
      scope = (formData.get('scope') as string) || undefined;
      removeFile = (formData.get('removeFile') as string) === 'true';
      const file = formData.get('file') as File | null;
      if (file && file.size > 0) {
        templateFileId = await uploadTemplateFile(supabase, file, authUserId, request.nextUrl.origin);
      }
    } else {
      const body = await request.json();
      id = body.id ?? '';
      name = body.name;
      description = body.description;
      departmentId = body.departmentId;
      scope = body.scope;
      removeFile = body.removeFile === true;
    }

    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (departmentId !== undefined) updateData.department_id = departmentId;
    if (scope !== undefined) updateData.scope = scope === '부서 전용' ? 'department' : 'company';
    if (templateFileId) updateData.template_file_id = templateFileId;
    if (removeFile) updateData.template_file_id = null;

    const { data, error } = await supabase
      .from('templates')
      .update(updateData)
      .eq('id', id)
      .select('*, departments:department_id(name), template_file:template_file_id(id, name, type, size)')
      .single();

    if (error) {
      console.error('[templates/PUT]', error.message);
      return NextResponse.json({ error: '템플릿 수정에 실패했습니다.' }, { status: 500 });
    }

    const deptJoin = (data as Record<string, unknown>).departments as { name: string } | null;
    const fileJoin = (data as Record<string, unknown>).template_file as { id: string; name: string; type: string; size: number } | null;
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
        templateFile: fileJoin ? {
          id: fileJoin.id,
          name: fileJoin.name,
          type: mimeToType(fileJoin.type, fileJoin.name),
          size: formatSize(fileJoin.size),
        } : null,
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

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
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
