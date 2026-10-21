import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sanitizeFileName, validateFile } from '@/lib/utils/sanitize';
import {
  createTemplateBundle,
  type TemplateBundle,
  type TemplateFieldDefinition,
} from '@/lib/templates/template-schema';
import { extractTemplateFileInnerHtml } from '@/lib/templates/template-file-preview';
import type { DbTemplate } from '@/lib/supabase/types';

export function formatErrorDetail(error: unknown) {
  if (!error || typeof error !== 'object') {
    return '알 수 없는 오류';
  }

  const maybeError = error as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };

  const parts = [
    maybeError.message,
    maybeError.code ? `code=${maybeError.code}` : null,
    maybeError.details,
    maybeError.hint,
  ].filter(Boolean);

  return parts.join(' | ') || '알 수 없는 오류';
}

export function parseJsonArrayField<T>(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.trim()) return [] as T[];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [] as T[];
  } catch {
    return [] as T[];
  }
}

export async function loadTemplateFileSource(admin: ReturnType<typeof createAdminSupabaseClient>, templateFileId: string) {
  const { data: fileRow, error } = await admin
    .from('files')
    .select('name, type, storage_path')
    .eq('id', templateFileId)
    .single();

  if (error || !fileRow?.storage_path) {
    throw new Error(`템플릿 파일 조회 실패: ${formatErrorDetail(error)}`);
  }

  const { data: blob, error: downloadError } = await admin.storage.from('files').download(fileRow.storage_path);
  if (downloadError || !blob) {
    throw new Error(`템플릿 파일 다운로드 실패: ${formatErrorDetail(downloadError)}`);
  }

  return {
    fileName: fileRow.name,
    buffer: Buffer.from(await blob.arrayBuffer()),
  };
}

export type TemplateFileJoin = { id: string; name: string; type: string; size: number } | null;
export type TemplateDepartmentJoin = { name: string } | null;
export type TemplateRowWithJoins = DbTemplate & {
  departments?: TemplateDepartmentJoin;
  template_file?: TemplateFileJoin;
};

export function mergeTemplateFields(
  baseFields: TemplateFieldDefinition[],
  nextFields: TemplateFieldDefinition[],
) {
  const seen = new Set<string>();
  const merged: TemplateFieldDefinition[] = [];

  for (const field of [...baseFields, ...nextFields]) {
    if (!field?.key || seen.has(field.key)) continue;
    seen.add(field.key);
    merged.push(field);
  }

  return merged;
}

export async function resolveTemplateBundle(params: {
  admin: ReturnType<typeof createAdminSupabaseClient>;
  name: string;
  description?: string;
  outline?: string;
  placeholders?: unknown;
  templateBundle?: TemplateBundle | null;
  templateFileId?: string | null;
}) {
  const baseBundle = params.templateBundle ?? createTemplateBundle({
    name: params.name,
    description: params.description,
    outline: params.outline,
    placeholders: params.placeholders,
  });

  if (!params.templateFileId) {
    return baseBundle;
  }

  const { buffer, fileName } = await loadTemplateFileSource(params.admin, params.templateFileId);
  const layoutHtml = await extractTemplateFileInnerHtml({ buffer, fileName });
  if (!layoutHtml.trim()) {
    return baseBundle;
  }

  const placeholderFields = Array.isArray(params.placeholders)
    ? (params.placeholders as Array<Record<string, unknown>>).map((placeholder, index) => ({
        key: String(placeholder.key ?? `placeholder_${index + 1}`),
        label: String(placeholder.label ?? placeholder.key ?? `플레이스홀더 ${index + 1}`),
        type: 'text' as const,
        placeholder: typeof placeholder.context === 'string' ? placeholder.context : undefined,
      }))
    : [];

  return {
    ...baseBundle,
    layoutHtml,
    fields: mergeTemplateFields(baseBundle.fields, placeholderFields),
  };
}

/** 파일 업로드 → files 테이블 INSERT → process 파이프라인 호출 → file.id 반환 */
export async function uploadTemplateFile(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, file: File, authUserId: string, requestOrigin: string): Promise<{ id: string | null; error?: string }> {
  if (!supabase) return { id: null, error: 'DB 미연결' };
  const admin = createAdminSupabaseClient();
  const validationError = validateFile(file);
  if (validationError) return { id: null, error: `파일 검증 실패: ${validationError}` };
  const normalizedName = sanitizeFileName(file.name.normalize('NFC'));
  const ext = normalizedName.split('.').pop()?.toLowerCase() ?? 'bin';
  const uuid = crypto.randomUUID();
  const storagePath = `uploads/templates/${uuid}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const { error: uploadError } = await admin.storage.from('files').upload(storagePath, buffer, {
    contentType: file.type || undefined,
  });
  if (uploadError) {
    const detail = formatErrorDetail(uploadError);
    console.error('[templates] storage upload:', detail);
    return { id: null, error: `Storage 업로드 실패: ${detail}` };
  }

  const { data, error } = await admin.from('files').insert({
    name: normalizedName,
    type: file.type,
    size: file.size,
    department_id: null,
    uploaded_by: authUserId,
    status: 'processing',
    storage_path: storagePath,
  }).select('id').single();

  if (error) {
    const detail = formatErrorDetail(error);
    console.error('[templates] file insert:', detail);
    await admin.storage.from('files').remove([storagePath]).catch(() => {});
    return { id: null, error: `DB 저장 실패: ${detail}` };
  }

  // 텍스트 추출/청킹/임베딩 파이프라인 호출
  const internalSecret = process.env.INTERNAL_API_SECRET || '';
  fetch(`${requestOrigin}/api/files/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': internalSecret },
    body: JSON.stringify({ fileId: data.id }),
  }).then(() => {}, (err) => console.error('[templates] process pipeline error:', err));

  return { id: data.id };
}
