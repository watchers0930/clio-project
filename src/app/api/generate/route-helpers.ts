import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { extractText, extractXlsxStructured } from '@/lib/ai/extract-text';
import type { DbFileRecord, DbTemplate, DbUser } from '@/lib/supabase/types';
import type { CorporateTheme, OutputFormat, RenderOutput } from '@/lib/renderers/types';
import { DEFAULT_THEME } from '@/lib/renderers/types';
import { parseTemplateBundle, type TemplateBundle } from '@/lib/templates/template-schema';

const FONT_MAP: Record<string, string> = {
  '맑은 고딕': 'Malgun Gothic',
  '나눔고딕': 'NanumGothic',
  '바탕': 'Batang',
  '돋움': 'Dotum',
  '굴림': 'Gulim',
  '나눔명조': 'NanumMyeongjo',
  'Arial': 'Arial',
  'Times New Roman': 'Times New Roman',
};

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>;
export type VersionFields = { parent_id?: string; version_number?: number };
type DocumentInsertPayload = {
  title: string;
  content: string;
  template_id?: string;
  source_file_ids: string[];
  instructions: string | null;
  status: string;
  created_by: string;
  storage_path?: string;
  parent_id?: string;
  version_number?: number;
  origin_document_id?: string;
  origin_context?: string;
};

type FileChunkRow = {
  file_id: string;
  content: string;
  chunk_index: number;
};

export function buildTheme(font: unknown): CorporateTheme {
  const fontParam = typeof font === 'string' ? font : '맑은 고딕';
  return {
    ...DEFAULT_THEME,
    fontFamily: fontParam,
    fontFamilyEn: FONT_MAP[fontParam] ?? 'Malgun Gothic',
  };
}

export async function resolveVersionFields(supabase: SupabaseClient, parentId?: string): Promise<VersionFields> {
  if (!parentId) return {};
  const { data: parentDoc } = await supabase.from('documents').select('parent_id, version_number').eq('id', parentId).single();
  const rootId: string = parentDoc?.parent_id ?? parentId;
  const { data: siblings } = await supabase
    .from('documents')
    .select('version_number')
    .or(`id.eq.${rootId},parent_id.eq.${rootId}`)
    .order('version_number', { ascending: false })
    .limit(1);
  return {
    parent_id: rootId,
    version_number: (siblings?.[0]?.version_number ?? 1) + 1,
  };
}

export async function loadUserGenerationContext(supabase: SupabaseClient, authUserId: string) {
  const { data: userData } = await supabase
    .from('users')
    .select('name, position, signature_path, departments:department_id(name)')
    .eq('id', authUserId)
    .single();
  const userRow = userData as (DbUser & { departments?: { name: string } | null }) | null;
  const userName = userRow?.name ?? '';
  const userPosition = userRow?.position ?? '';
  const userDept = userRow?.departments?.name ?? '';
  const signaturePath = userRow?.signature_path ?? null;
  let signatureBuffer: Buffer | null = null;

  if (signaturePath) {
    try {
      const adminClient = createAdminSupabaseClient();
      const { data: sigBlob } = await adminClient.storage.from('files').download(signaturePath);
      if (sigBlob) signatureBuffer = Buffer.from(await sigBlob.arrayBuffer());
    } catch (e) {
      console.error('[generate] signature download error:', e);
    }
  }

  return { userName, userPosition, userDept, signatureBuffer };
}

export async function loadSourceChunks(supabase: SupabaseClient, sourceFileIds?: string[]) {
  const sourceChunks: string[] = [];
  if (!sourceFileIds?.length) {
    return { sourceChunks, sourceFileNames: [], sourceFileSummary: '', sourceFileCount: 0 };
  }

  // file_chunks와 Storage는 admin client로 접근 (RLS bypass)
  const admin = createAdminSupabaseClient();

  const { data: srcFiles, error: srcFilesErr } = await admin.from('files').select('id, name, type, storage_path').in('id', sourceFileIds);
  if (srcFilesErr) console.error('[loadSourceChunks] files query error:', srcFilesErr.message);
  console.log('[loadSourceChunks] requestedIds:', sourceFileIds, 'foundFiles:', srcFiles?.length ?? 0, 'filesErr:', srcFilesErr?.message ?? 'none');
  const { data: chunkRows, error: chunkErr } = await admin
    .from('file_chunks')
    .select('file_id, content, chunk_index')
    .in('file_id', sourceFileIds)
    .order('chunk_index', { ascending: true })
    .limit(5000);
  if (chunkErr) console.error('[loadSourceChunks] chunks query error:', chunkErr.message);
  console.log('[loadSourceChunks] chunkRows:', chunkRows?.length ?? 0, 'chunkErr:', chunkErr?.message ?? 'none');

  const chunkMap = new Map<string, string[]>();
  for (const chunk of ((chunkRows ?? []) as FileChunkRow[])) {
    const current = chunkMap.get(chunk.file_id) ?? [];
    current.push(chunk.content);
    chunkMap.set(chunk.file_id, current);
  }

  const sourceFileNames: string[] = [];

  for (const sf of ((srcFiles ?? []) as DbFileRecord[])) {
    sourceFileNames.push(sf.name);
    const indexedText = chunkMap.get(sf.id)?.join('\n').trim();
    if (indexedText) {
      sourceChunks.push(indexedText.slice(0, 8000));
      continue;
    }

    if (!sf.storage_path) {
      console.warn(`[loadSourceChunks] ${sf.name}: no storage_path, skipped`);
      continue;
    }
    try {
      const { data: blob, error: dlErr } = await admin.storage.from('files').download(sf.storage_path);
      if (dlErr || !blob) {
        console.error(`[loadSourceChunks] ${sf.name}: download failed`, dlErr?.message);
        continue;
      }
      const text = await extractText(await blob.arrayBuffer(), sf.type ?? '', sf.name);
      if (text.trim()) sourceChunks.push(text.slice(0, 8000));
      else console.warn(`[loadSourceChunks] ${sf.name}: extracted text is empty`);
    } catch (e) {
      console.error(`[loadSourceChunks] ${sf.name}: extract error`, e);
    }
  }

  const sourceFileSummary = sourceChunks
    .map((chunk, index) => `### ${sourceFileNames[index] ?? `참조자료 ${index + 1}`}\n${chunk.slice(0, 1200)}`)
    .join('\n\n');

  return {
    sourceChunks,
    sourceFileNames,
    sourceFileSummary,
    sourceFileCount: sourceFileNames.length,
  };
}

export async function loadSourceChunksFromFiles(
  supabase: SupabaseClient,
  sourceFileIds?: string[],
) {
  return loadSourceChunks(supabase, sourceFileIds);
}

export async function loadTemplateContext(
  supabase: SupabaseClient,
  templateId: string | undefined,
  customStructure: unknown,
  format: OutputFormat,
): Promise<{
  tmpl: Pick<DbTemplate, 'name' | 'content' | 'description' | 'placeholders' | 'template_file_id'> | null;
  templateBundle: TemplateBundle | null;
  templateName: string;
  templateFileText: string | null;
  templateBuffer: Buffer | null;
  templateFileName: string | null;
  format: OutputFormat;
}> {
  let tmpl: Pick<DbTemplate, 'name' | 'content' | 'description' | 'placeholders' | 'template_file_id'> | null = null;
  if (templateId) {
    const { data } = await supabase
      .from('templates')
      .select('name, content, description, placeholders, template_file_id')
      .eq('id', templateId)
      .single();
    tmpl = data as Pick<DbTemplate, 'name' | 'content' | 'description' | 'placeholders' | 'template_file_id'> | null;
  }

  const templateName = tmpl?.name ?? (customStructure ? '직접 작성 문서' : '문서');
  const templateBundle: TemplateBundle | null = tmpl
    ? parseTemplateBundle(tmpl.content, {
        name: tmpl.name,
        description: tmpl.description,
        placeholders: tmpl.placeholders,
      })
    : null;
  let templateFileText: string | null = null;
  let templateBuffer: Buffer | null = null;
  let templateFileName: string | null = null;
  let resolvedFormat = format;

  if (tmpl?.template_file_id) {
    const { data: tplFile } = await supabase
      .from('files')
      .select('name, type, storage_path')
      .eq('id', tmpl.template_file_id)
      .single();
    const templateFileRow = tplFile as DbFileRecord | null;

    if (templateFileRow?.storage_path) {
      try {
        templateFileName = templateFileRow.name;
        const { data: blob } = await supabase.storage.from('files').download(templateFileRow.storage_path);
        if (blob) {
          const buf = await blob.arrayBuffer();
          templateBuffer = Buffer.from(new Uint8Array(buf));
          const extractBuf = new Uint8Array(buf).buffer;
          const ext = templateFileRow.name.split('.').pop()?.toLowerCase() ?? '';
          templateFileText = ext === 'xlsx' && resolvedFormat === 'xlsx'
            ? await extractXlsxStructured(extractBuf)
            : await extractText(extractBuf, templateFileRow.type ?? '', templateFileRow.name);

          if (ext === 'hwpx' && resolvedFormat === 'docx') resolvedFormat = 'hwpx';
          if ((ext === 'docx' || ext === 'dotx') && resolvedFormat === 'hwpx') resolvedFormat = 'docx';
        }
      } catch (e) {
        console.error('[generate] extract template:', e);
      }
    }
  }

  return { tmpl, templateBundle, templateName, templateFileText, templateBuffer, templateFileName, format: resolvedFormat };
}

/**
 * 참조 제안서의 마크다운 콘텐츠를 ## 기준으로 섹션 분리하여 반환.
 * 섹션당 최대 3,000자로 절삭하여 토큰 예산을 관리합니다.
 */
export async function loadReferenceContent(
  supabase: SupabaseClient,
  referenceDocId: string,
): Promise<Map<string, string> | null> {
  const { data } = await supabase
    .from('documents')
    .select('content')
    .eq('id', referenceDocId)
    .single();

  if (!data?.content) return null;

  // PROPOSAL_INPUTS 코멘트 제거
  const content = (data.content as string).replace(/<!--PROPOSAL_INPUTS:.*?-->\n?/, '');
  const sections = new Map<string, string>();
  const lines = content.split('\n');
  let currentTitle = '';
  let currentBody: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      if (currentTitle) {
        sections.set(currentTitle, currentBody.join('\n').slice(0, 3000));
      }
      currentTitle = h2Match[1].trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  if (currentTitle) {
    sections.set(currentTitle, currentBody.join('\n').slice(0, 3000));
  }

  return sections.size > 0 ? sections : null;
}

export function buildInstructionMeta(userName: string, userDept: string, instructions?: string) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const reportNo = `${todayStr.replace(/-/g, '')}-${String(Math.floor(Math.random() * 90) + 10)}-001`;
  const userMeta = `작성일: ${todayStr}\n작성시간: ${timeStr}\n보고번호: ${reportNo}\n작성자: ${userName}\n소속: ${userDept}`;
  return { todayStr, timeStr, reportNo, enrichedInstructions: instructions ? `${userMeta}\n\n${instructions}` : userMeta };
}

export function buildDocumentInsertPayload(params: {
  title: string;
  content: string;
  templateId?: string;
  sourceFileIds?: string[];
  instructions?: string | null;
  status: string;
  createdBy: string;
  storagePath?: string;
  versionFields?: VersionFields;
  originDocumentId?: string | null;
  originContext?: string | null;
}): DocumentInsertPayload {
  const payload: DocumentInsertPayload = {
    title: params.title,
    content: params.content,
    source_file_ids: params.sourceFileIds ?? [],
    instructions: params.instructions ?? null,
    status: params.status,
    created_by: params.createdBy,
  };

  if (params.templateId) payload.template_id = params.templateId;
  if (params.storagePath) payload.storage_path = params.storagePath;
  if (params.versionFields?.parent_id) payload.parent_id = params.versionFields.parent_id;
  if (typeof params.versionFields?.version_number === 'number') payload.version_number = params.versionFields.version_number;
  if (params.originDocumentId) payload.origin_document_id = params.originDocumentId;
  if (params.originContext) payload.origin_context = params.originContext;

  return payload;
}

export async function persistCompletedRender(params: {
  supabase: SupabaseClient;
  authUserId: string;
  rendered: RenderOutput;
  title: string;
  content: string;
  templateId?: string;
  sourceFileIds?: string[];
  instructions?: string | null;
  versionFields: VersionFields;
  originDocumentId?: string | null;
  originContext?: string | null;
  auditDetails: Record<string, unknown>;
}) {
  const { supabase, authUserId, rendered, title, content, templateId, sourceFileIds, instructions, versionFields, originDocumentId, originContext, auditDetails } = params;
  const storagePath = `generated/${authUserId}/${crypto.randomUUID()}.${rendered.extension}`;
  const { error: uploadErr } = await supabase.storage.from('files').upload(storagePath, rendered.buffer, {
    contentType: rendered.mimeType,
    upsert: false,
  });
  if (uploadErr) throw new Error(uploadErr.message);

  const { data: urlData } = await supabase.storage.from('files').createSignedUrl(storagePath, 3600);
  const payload = buildDocumentInsertPayload({
    title,
    content,
    templateId,
    sourceFileIds,
    instructions,
    status: 'completed',
    createdBy: authUserId,
    storagePath,
    versionFields,
    originDocumentId,
    originContext,
  });
  const { data: newDoc, error: insertErr } = await supabase.from('documents').insert(payload).select().single();
  if (insertErr) throw new Error(insertErr.message);

  await supabase.from('audit_logs').insert({
    user_id: authUserId,
    action: 'document.create',
    target_type: 'document',
    target_id: newDoc?.id ?? '',
    details: { title, storagePath, ...auditDetails },
  }).then(() => {}, () => {});

  return { storagePath, signedUrl: urlData?.signedUrl ?? null, newDoc };
}
