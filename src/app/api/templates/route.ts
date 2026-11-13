import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { requireAdmin } from '@/lib/http/admin-guard';
import { countLockedDocumentReferences, isLockedDocumentError } from '@/lib/documents/locked-references';
import { serializeTemplateBundle, type TemplateBundle } from '@/lib/templates/template-schema';
import type { DbTemplate } from '@/lib/supabase/types';
import { formatErrorDetail, resolveTemplateBundle, type TemplateRowWithJoins } from './route-helpers';
import { readTemplateRequest, toTemplateResponse } from './template-io';
import { appendBuiltinTemplates } from './builtin-list';

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

    const tplList = ((rows ?? []) as TemplateRowWithJoins[]).map(toTemplateResponse);

    appendBuiltinTemplates(tplList);

    return NextResponse.json({ templates: tplList });
  } catch {
    return NextResponse.json({ templates: [], error: '템플릿 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
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
    const guard = await requireAdmin(supabase, authUserId);
    if (guard) return guard;
    const admin = createAdminSupabaseClient();

    const parsed = await readTemplateRequest(request, supabase, authUserId);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { input } = parsed;
    // 생성: 미전달 값은 빈 값·전사 공용으로 채운다
    const name = input.name ?? '';
    const description = input.description ?? '';
    const content = input.content ?? '';
    const departmentId = input.departmentId || null;
    const scope = input.scope ?? '전사 공용';
    const templateFileId = input.uploadedFileId ?? input.bodyTemplateFileId ?? null;
    const placeholdersData = input.bodyPlaceholders ?? null;
    let templateBundle: TemplateBundle | null = input.templateBundle;

    if (!name) {
      return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 });
    }

    templateBundle = await resolveTemplateBundle({
      admin,
      name,
      description,
      outline: content,
      placeholders: placeholdersData,
      templateBundle,
      templateFileId,
    });

    const scopeValue = scope === '부서 전용' ? 'department' : 'company';

    const insertData: {
      name: string;
      description: string;
      department_id: string | null;
      scope: string;
      content: string;
      placeholders: unknown[];
      created_by: string;
      template_file_id?: string | null;
    } = {
      name,
      description: description ?? '',
      department_id: departmentId,
      scope: scopeValue,
      content: serializeTemplateBundle(templateBundle),
      placeholders: Array.isArray(placeholdersData) ? placeholdersData : [],
      created_by: authUserId,
    };
    if (templateFileId) insertData.template_file_id = templateFileId;

    const { data: newTmpl, error } = await admin.from('templates').insert(insertData)
      .select('*, departments:department_id(name), template_file:template_file_id(id, name, type, size)').single();

    if (error) {
      const detail = formatErrorDetail(error);
      console.error('[templates/POST]', detail);
      return NextResponse.json({ error: `템플릿 생성 실패: ${detail}` }, { status: 500 });
    }

    return NextResponse.json({ template: toTemplateResponse(newTmpl as TemplateRowWithJoins) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      error: `템플릿 생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
    }, { status: 500 });
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
    const guard = await requireAdmin(supabase, authUserId);
    if (guard) return guard;
    const admin = createAdminSupabaseClient();

    const parsed = await readTemplateRequest(request, supabase, authUserId);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { input } = parsed;
    // 수정: 미전달(undefined)은 변경하지 않음. 폼은 빈 칸이 항상 전송되므로 이름·부서·범위의 빈 값도 미변경으로 본다.
    // JSON 본문의 templateFileId 는 받지 않는다(업로드로만 연결).
    const id = input.id ?? '';
    const blankAsUnset = (value: string | undefined) => (input.source === 'form' ? value || undefined : value);
    const name = blankAsUnset(input.name);
    const description = input.description;
    const content = input.content;
    const departmentId = blankAsUnset(input.departmentId);
    const scope = blankAsUnset(input.scope);
    const templateFileId = input.uploadedFileId;
    const removeFile = input.removeFile;
    const templateBundlePatch = input.templateBundle;

    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
    }

    const { data: existingTemplate, error: existingError } = await admin
      .from('templates')
      .select('name, description, content, placeholders, template_file_id')
      .eq('id', id)
      .single();

    if (existingError || !existingTemplate) {
      return NextResponse.json({ error: `기존 템플릿 조회 실패: ${formatErrorDetail(existingError)}` }, { status: 404 });
    }

    const persistedTemplate = existingTemplate as DbTemplate;
    const updateData: {
      updated_at: string;
      name?: string;
      description?: string;
      content?: string;
      department_id?: string;
      scope?: string;
      template_file_id?: string | null;
    } = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (content !== undefined || templateBundlePatch) {
      const bundle = await resolveTemplateBundle({
        admin,
        name: name ?? persistedTemplate.name ?? '문서',
        description: description ?? persistedTemplate.description ?? '',
        outline: content ?? persistedTemplate.content ?? '',
        placeholders: persistedTemplate.placeholders,
        templateBundle: templateBundlePatch,
        templateFileId: removeFile ? null : templateFileId ?? persistedTemplate.template_file_id ?? null,
      });
      updateData.content = serializeTemplateBundle(bundle);
    }
    if (departmentId !== undefined) updateData.department_id = departmentId;
    if (scope !== undefined) updateData.scope = scope === '부서 전용' ? 'department' : 'company';
    if (templateFileId) updateData.template_file_id = templateFileId;
    if (removeFile) updateData.template_file_id = null;

    const { data, error } = await admin
      .from('templates')
      .update(updateData)
      .eq('id', id)
      .select('*, departments:department_id(name), template_file:template_file_id(id, name, type, size)')
      .single();

    if (error) {
      const detail = formatErrorDetail(error);
      console.error('[templates/PUT]', detail);
      return NextResponse.json({ error: `템플릿 수정 실패: ${detail}` }, { status: 500 });
    }

    return NextResponse.json({ template: toTemplateResponse(data as TemplateRowWithJoins) });
  } catch (error) {
    return NextResponse.json({
      error: `템플릿 수정 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
    }, { status: 500 });
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
    const guard = await requireAdmin(supabase, authUserId);
    if (guard) return guard;

    const lockedCount = await countLockedDocumentReferences(createAdminSupabaseClient(), ['template_id'], id);
    if (lockedCount > 0) {
      return NextResponse.json({ error: `결재 중이거나 승인된 문서(${lockedCount}건)가 사용하는 템플릿은 삭제할 수 없습니다.` }, { status: 409 });
    }

    const { error } = await supabase.from('templates').delete().eq('id', id);
    if (error) {
      if (isLockedDocumentError(error)) {
        return NextResponse.json({ error: '결재 중이거나 승인된 문서가 사용하는 템플릿은 삭제할 수 없습니다.' }, { status: 409 });
      }
      console.error('[templates/DELETE]', error.message);
      return NextResponse.json({ error: '템플릿 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '템플릿 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
