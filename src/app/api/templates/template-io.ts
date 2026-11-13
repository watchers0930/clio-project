// 템플릿 API 입출력 — 요청 파싱(POST·PUT 공용)과 응답 변환(GET·POST·PUT·빌트인 공용)을 한 곳에 둔다.
// 응답 필드를 바꿀 때 이 파일만 고치면 목록·생성·수정·빌트인이 함께 맞춰진다.
import type { NextRequest } from 'next/server';
import type { createServerSupabaseClient } from '@/lib/supabase/server';
import { mimeToType, formatSize } from '@/lib/utils/format';
import {
  parseTemplateBundle,
  type TemplateBundle,
  type TemplateFieldDefinition,
  type TemplateSectionDefinition,
} from '@/lib/templates/template-schema';
import { parseJsonArrayField, uploadTemplateFile, type TemplateRowWithJoins } from './route-helpers';

export type TemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  content: string;
  department: string;
  departmentId: string | null;
  scope: string;
  placeholders: unknown[];
  templateMode: string;
  templateHtml: string;
  templateFields: unknown;
  templateSections: unknown;
  lastUpdated: string;
  usageCount: number;
  templateFile: { id: string; name: string; type: string; size: string } | null;
};

/** 번들에서 화면이 쓰는 필드만 꺼낸다(DB 템플릿·빌트인 공용). */
export function templateBundleFields(bundle: TemplateBundle) {
  return {
    content: bundle.outline,
    templateMode: bundle.mode,
    templateHtml: bundle.layoutHtml,
    templateFields: bundle.fields,
    templateSections: bundle.sections,
  };
}

/** DB 템플릿 행(부서·파일 조인 포함)을 목록·생성·수정 응답 형태로 바꾼다. */
export function toTemplateResponse(row: TemplateRowWithJoins): TemplateListItem {
  const fileJoin = row.template_file ?? null;
  const placeholders = Array.isArray(row.placeholders) ? row.placeholders : [];
  const bundle = parseTemplateBundle(row.content ?? '', {
    name: row.name,
    description: row.description,
    placeholders,
  });
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ...templateBundleFields(bundle),
    department: row.departments?.name ?? '전사',
    departmentId: row.department_id,
    scope: row.scope === 'company' ? '전사 공용' : '부서 전용',
    placeholders,
    lastUpdated: row.updated_at?.split('T')[0] ?? '',
    usageCount: 0,
    templateFile: fileJoin ? {
      id: fileJoin.id,
      name: fileJoin.name,
      type: mimeToType(fileJoin.type, fileJoin.name),
      size: formatSize(fileJoin.size),
    } : null,
  };
}

/**
 * POST·PUT 요청 본문(multipart 또는 JSON). 값이 없으면 undefined, 빈 문자열은 그대로 둔다.
 * 기본값 규칙은 핸들러마다 달라(생성=빈 값 채움, 수정=미전달은 변경 안 함) 각 핸들러가 적용한다.
 * templateFileId·placeholders 는 JSON 본문 값과 업로드 결과를 구분해, 수정에서 임의 파일 id 연결을 받지 않게 한다.
 */
export type TemplateRequestInput = {
  source: 'form' | 'json';
  id: string | undefined;
  name: string | undefined;
  description: string | undefined;
  content: string | undefined;
  departmentId: string | undefined;
  scope: string | undefined;
  removeFile: boolean;
  uploadedFileId: string | null | undefined;
  bodyTemplateFileId: string | undefined;
  bodyPlaceholders: unknown;
  templateBundle: TemplateBundle | null;
};

function buildHtmlTemplateBundle(
  layoutHtml: string,
  outline: string,
  fields: TemplateFieldDefinition[],
  sections: TemplateSectionDefinition[],
): TemplateBundle {
  return { version: 1, mode: 'html-template', layoutHtml, outline, fields, sections };
}

export async function readTemplateRequest(
  request: NextRequest,
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  authUserId: string,
): Promise<{ input: TemplateRequestInput } | { error: string }> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const text = (key: string) => (formData.get(key) as string | null) ?? undefined;
    const content = text('content');
    const templateHtml = text('templateHtml') ?? '';
    const templateFields = parseJsonArrayField<TemplateFieldDefinition>(formData.get('templateFields'));
    const templateSections = parseJsonArrayField<TemplateSectionDefinition>(formData.get('templateSections'));
    const templateBundle = templateHtml || templateFields.length > 0 || templateSections.length > 0
      ? buildHtmlTemplateBundle(templateHtml, content ?? '', templateFields, templateSections)
      : null;

    let uploadedFileId: string | null | undefined;
    const file = formData.get('file') as File | null;
    if (file && file.size > 0) {
      const uploadResult = await uploadTemplateFile(supabase, file, authUserId, request.nextUrl.origin);
      if (uploadResult.error) return { error: uploadResult.error };
      uploadedFileId = uploadResult.id;
    }

    return {
      input: {
        source: 'form',
        id: text('id'),
        name: text('name'),
        description: text('description'),
        content,
        departmentId: text('departmentId'),
        scope: text('scope'),
        removeFile: text('removeFile') === 'true',
        uploadedFileId,
        bodyTemplateFileId: undefined,
        bodyPlaceholders: undefined,
        templateBundle,
      },
    };
  }

  const body = await request.json();
  const templateBundle = body.templateHtml || body.templateFields || body.templateSections
    ? buildHtmlTemplateBundle(
        body.templateHtml ?? '',
        body.content ?? '',
        Array.isArray(body.templateFields) ? body.templateFields as TemplateFieldDefinition[] : [],
        Array.isArray(body.templateSections) ? body.templateSections as TemplateSectionDefinition[] : [],
      )
    : null;

  return {
    input: {
      source: 'json',
      id: body.id,
      name: body.name,
      description: body.description,
      content: body.content,
      departmentId: body.departmentId,
      scope: body.scope,
      removeFile: body.removeFile === true,
      uploadedFileId: undefined,
      bodyTemplateFileId: body.templateFileId || undefined,
      bodyPlaceholders: body.placeholders || undefined,
      templateBundle,
    },
  };
}
