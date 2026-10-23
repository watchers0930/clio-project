import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { requireAdmin } from '@/lib/http/admin-guard';
import { mimeToType, formatSize } from '@/lib/utils/format';
import {
  parseTemplateBundle,
  serializeTemplateBundle,
  type TemplateSectionDefinition,
  type TemplateBundle,
  type TemplateFieldDefinition,
} from '@/lib/templates/template-schema';
import type { DbTemplate } from '@/lib/supabase/types';
import {
  formatErrorDetail,
  parseJsonArrayField,
  resolveTemplateBundle,
  uploadTemplateFile,
  type TemplateRowWithJoins,
} from './route-helpers';
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

    const templateRows = (rows ?? []) as TemplateRowWithJoins[];
    const tplList = templateRows.map((t) => {
      const deptJoin = t.departments ?? null;
      const fileJoin = t.template_file ?? null;
      const placeholders = Array.isArray(t.placeholders) ? t.placeholders : [];
      const bundle = parseTemplateBundle(t.content ?? '', {
        name: t.name,
        description: t.description,
        placeholders,
      });
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        content: bundle.outline,
        department: deptJoin?.name ?? '전사',
        departmentId: t.department_id,
        scope: t.scope === 'company' ? '전사 공용' : '부서 전용',
        placeholders,
        templateMode: bundle.mode,
        templateHtml: bundle.layoutHtml,
        templateFields: bundle.fields,
        templateSections: bundle.sections,
        lastUpdated: t.updated_at?.split('T')[0] ?? '',
        usageCount: 0,
        templateFile: fileJoin ? {
          id: fileJoin.id,
          name: fileJoin.name,
          type: mimeToType(fileJoin.type, fileJoin.name),
          size: formatSize(fileJoin.size),
        } : null,
      };
    });

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

    const contentType = request.headers.get('content-type') ?? '';
    let name = '';
    let description = '';
    let content = '';
    let departmentId: string | null = null;
    let scope = '전사 공용';
    let templateFileId: string | null = null;
    let placeholdersData: unknown = null;
    let templateBundle: TemplateBundle | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      name = (formData.get('name') as string) ?? '';
      description = (formData.get('description') as string) ?? '';
      content = (formData.get('content') as string) ?? '';
      departmentId = (formData.get('departmentId') as string) || null;
      scope = (formData.get('scope') as string) ?? '전사 공용';
      const templateHtml = (formData.get('templateHtml') as string) ?? '';
      const templateFields = parseJsonArrayField<TemplateFieldDefinition>(formData.get('templateFields'));
      const templateSections = parseJsonArrayField<TemplateSectionDefinition>(formData.get('templateSections'));
      if (templateHtml || templateFields.length > 0 || templateSections.length > 0) {
        templateBundle = {
          version: 1,
          mode: 'html-template',
          layoutHtml: templateHtml,
          outline: content,
          fields: templateFields,
          sections: templateSections,
        };
      }
      const file = formData.get('file') as File | null;
      if (file && file.size > 0) {
        const uploadResult = await uploadTemplateFile(supabase, file, authUserId, request.nextUrl.origin);
        if (uploadResult.error) return NextResponse.json({ error: uploadResult.error }, { status: 400 });
        templateFileId = uploadResult.id;
      }
    } else {
      const body = await request.json();
      name = body.name ?? '';
      description = body.description ?? '';
      content = body.content ?? '';
      departmentId = body.departmentId || null;
      scope = body.scope ?? '전사 공용';
      if (body.templateFileId) templateFileId = body.templateFileId;
      if (body.placeholders) placeholdersData = body.placeholders;
      if (body.templateHtml || body.templateFields || body.templateSections) {
        templateBundle = {
          version: 1,
          mode: 'html-template',
          layoutHtml: body.templateHtml ?? '',
          outline: content,
          fields: Array.isArray(body.templateFields) ? body.templateFields as TemplateFieldDefinition[] : [],
          sections: Array.isArray(body.templateSections) ? body.templateSections as TemplateSectionDefinition[] : [],
        };
      }
    }

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

    const createdTemplate = newTmpl as TemplateRowWithJoins;
    const deptJoin = createdTemplate.departments ?? null;
    const fileJoin = createdTemplate.template_file ?? null;
    const bundle = parseTemplateBundle(createdTemplate.content ?? '', {
      name: createdTemplate.name,
      description: createdTemplate.description,
      placeholders: createdTemplate.placeholders,
    });

    return NextResponse.json({
      template: {
        id: createdTemplate.id,
        name: createdTemplate.name,
        description: createdTemplate.description,
        content: bundle.outline,
        department: deptJoin?.name ?? '전사',
        departmentId: createdTemplate.department_id,
        scope: scope ?? '전사 공용',
        placeholders: Array.isArray(createdTemplate.placeholders) ? createdTemplate.placeholders : [],
        templateMode: bundle.mode,
        templateHtml: bundle.layoutHtml,
        templateFields: bundle.fields,
        templateSections: bundle.sections,
        lastUpdated: createdTemplate.updated_at.split('T')[0],
        usageCount: 0,
        templateFile: fileJoin ? {
          id: fileJoin.id,
          name: fileJoin.name,
          type: mimeToType(fileJoin.type, fileJoin.name),
          size: formatSize(fileJoin.size),
        } : null,
      },
    }, { status: 201 });
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

    const contentType = request.headers.get('content-type') ?? '';
    let id = '';
    let name: string | undefined;
    let description: string | undefined;
    let content: string | undefined;
    let departmentId: string | undefined;
    let scope: string | undefined;
    let templateFileId: string | null | undefined;
    let removeFile = false;
    let templateBundlePatch: TemplateBundle | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      id = (formData.get('id') as string) ?? '';
      name = (formData.get('name') as string) || undefined;
      description = (formData.get('description') as string) ?? undefined;
      content = (formData.get('content') as string) ?? undefined;
      departmentId = (formData.get('departmentId') as string) || undefined;
      scope = (formData.get('scope') as string) || undefined;
      const templateHtml = (formData.get('templateHtml') as string) ?? '';
      const templateFields = parseJsonArrayField<TemplateFieldDefinition>(formData.get('templateFields'));
      const templateSections = parseJsonArrayField<TemplateSectionDefinition>(formData.get('templateSections'));
      if (templateHtml || templateFields.length > 0 || templateSections.length > 0) {
        templateBundlePatch = {
          version: 1,
          mode: 'html-template',
          layoutHtml: templateHtml,
          outline: content ?? '',
          fields: templateFields,
          sections: templateSections,
        };
      }
      removeFile = (formData.get('removeFile') as string) === 'true';
      const file = formData.get('file') as File | null;
      if (file && file.size > 0) {
        const uploadResult = await uploadTemplateFile(supabase, file, authUserId, request.nextUrl.origin);
        if (uploadResult.error) return NextResponse.json({ error: uploadResult.error }, { status: 400 });
        templateFileId = uploadResult.id;
      }
    } else {
      const body = await request.json();
      id = body.id ?? '';
      name = body.name;
      description = body.description;
      content = body.content;
      departmentId = body.departmentId;
      scope = body.scope;
      removeFile = body.removeFile === true;
      if (body.templateHtml || body.templateFields || body.templateSections) {
        templateBundlePatch = {
          version: 1,
          mode: 'html-template',
          layoutHtml: body.templateHtml ?? '',
          outline: body.content ?? '',
          fields: Array.isArray(body.templateFields) ? body.templateFields as TemplateFieldDefinition[] : [],
          sections: Array.isArray(body.templateSections) ? body.templateSections as TemplateSectionDefinition[] : [],
        };
      }
    }

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

    const updatedTemplate = data as TemplateRowWithJoins;
    const deptJoin = updatedTemplate.departments ?? null;
    const fileJoin = updatedTemplate.template_file ?? null;
    const placeholders = Array.isArray(updatedTemplate.placeholders) ? updatedTemplate.placeholders : [];
    const bundle = parseTemplateBundle(updatedTemplate.content ?? '', {
      name: updatedTemplate.name,
      description: updatedTemplate.description,
      placeholders,
    });

    return NextResponse.json({
      template: {
        id: updatedTemplate.id,
        name: updatedTemplate.name,
        description: updatedTemplate.description,
        content: bundle.outline,
        department: deptJoin?.name ?? '전사',
        departmentId: updatedTemplate.department_id,
        scope: updatedTemplate.scope === 'company' ? '전사 공용' : '부서 전용',
        placeholders,
        templateMode: bundle.mode,
        templateHtml: bundle.layoutHtml,
        templateFields: bundle.fields,
        templateSections: bundle.sections,
        lastUpdated: updatedTemplate.updated_at.split('T')[0],
        usageCount: 0,
        templateFile: fileJoin ? {
          id: fileJoin.id,
          name: fileJoin.name,
          type: mimeToType(fileJoin.type, fileJoin.name),
          size: formatSize(fileJoin.size),
        } : null,
      },
    });
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
