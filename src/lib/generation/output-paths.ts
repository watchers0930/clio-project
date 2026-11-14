// AI 생성 이후 출력 경로 — 양식 채우기(DOCX/HWPX)·DOCX 템플릿·XLSX/PPTX 렌더 → Storage 업로드 → 응답
// 각 경로는 해당하지 않으면 null 을 반환하고, 해당하면 반드시 응답을 반환한다.
import { NextResponse } from 'next/server';
import { renderDocument } from '@/lib/renderers';
import { collapseWorklogNextPlanRows } from '@/lib/renderers/docx-renderer';
import type { CorporateTheme, GenerationResult, OutputFormat, RenderOutput } from '@/lib/renderers/types';
import { applyFormDataRuntimeOverrides } from '@/lib/ai/docx-form-mapping';
import { LeaveDocumentLinkError, leaveLinkFailure } from '@/lib/leave/leave-document';
import { isWorklogTemplateName } from '@/lib/templates/worklog';
import { persistCompletedRender, type VersionFields } from './context';
import { consolidateSectionCells, applyWorklogTemplateOverrides, buildDocumentSummary } from './form-overrides';

/** 저장(persistCompletedRender)에 공통으로 넘기는 요청 컨텍스트 */
export interface PersistContext {
  supabase: Parameters<typeof persistCompletedRender>[0]['supabase'];
  authUserId: string;
  templateId?: string;
  templateName: string;
  sourceFileIds?: string[];
  versionFields: VersionFields;
  originDocumentId?: string | null;
  originContext?: string | null;
  format: OutputFormat;
}

/** AI 생성 이후 경로 컨텍스트 */
export interface OutputContext extends PersistContext {
  instructions?: string | null;
  title: string;
  dateStr: string;
  leaveInputs: Record<string, string>;
}

type RuntimeOverrideMeta = Parameters<typeof applyFormDataRuntimeOverrides>[2];

/** 렌더·업로드 실패 공통 처리: 휴가 연결 실패는 전용 응답, 그 외는 로그 후 500 */
export function failureResponse(e: unknown, logLabel: string, message: string) {
  if(e instanceof LeaveDocumentLinkError) return NextResponse.json(leaveLinkFailure(e,e.documentId),{status:e.status});
  console.error(logLabel, e);
  return NextResponse.json({ error: message }, { status: 500 });
}

/** 렌더 결과 저장 → 문서 요약 응답(201). content·추가 필드는 원래 위치(try 안·저장 후)에서 계산되도록 함수로 받는다. */
async function persistAndRespond(
  ctx: OutputContext,
  rendered: RenderOutput,
  getContent: () => string,
  logLabel: string,
  failMessage: string,
  getExtra?: () => Record<string, unknown>,
) {
  const { supabase, authUserId, title, templateId, templateName, sourceFileIds, instructions, versionFields, originDocumentId, originContext, format, leaveInputs, dateStr } = ctx;
  try {
    const content = getContent();
    const { newDoc, signedUrl, downloadFileName, downloadExtension, downloadMimeType } = await persistCompletedRender({
      supabase,
      authUserId,
      rendered,
      title,
      content,
      templateId,
      sourceFileIds,
      instructions: instructions ?? null,
      versionFields,
      originDocumentId,
      originContext,
      auditDetails: { format },
      leaveInputs, templateName,
    });
    return NextResponse.json({
      document: buildDocumentSummary({
        id: newDoc?.id,
        title,
        templateName,
        createdAt: dateStr,
        status: '완료',
        sourceCount: (sourceFileIds ?? []).length,
        content,
        versionNumber: (newDoc as { version_number?: number | null } | null)?.version_number ?? 1,
        parentId: (newDoc as { parent_id?: string | null } | null)?.parent_id ?? null,
        originDocumentId: (newDoc as { origin_document_id?: string | null } | null)?.origin_document_id ?? null,
        originContext: (newDoc as { origin_context?: string | null } | null)?.origin_context ?? null,
        outputFormat: format,
      }),
      format,
      downloadUrl: signedUrl,
      downloadFileName,
      downloadExtension,
      downloadMimeType,
      ...getExtra?.(),
    }, { status: 201 });
  } catch (e) {
    return failureResponse(e, logLabel, failMessage);
  }
}

// DOCX 폼 데이터 기반: 빈 셀에 내용 주입 → Storage 업로드
export async function respondDocxFormData(ctx: OutputContext, generationResult: GenerationResult, theme: CorporateTheme, runtimeMeta: RuntimeOverrideMeta, resolvedDocumentInputs: Record<string, string>) {
  if (!(generationResult.docxFormData && generationResult.templateBuffer && generationResult.tableStructure)) return null;
  const { templateName } = ctx;
  const fd = generationResult.docxFormData;
  const cells = generationResult.tableStructure.emptyCells;

  // ── 1단계: 섹션 통합 (AI가 행별 분산한 내용을 첫 셀로 합침) ──
  consolidateSectionCells(fd, cells);

  // ── 2단계: 메타데이터 강제 보정 (통합 결과를 덮어씀) ──
  applyFormDataRuntimeOverrides(fd, cells, runtimeMeta);
  if (isWorklogTemplateName(templateName)) {
    applyWorklogTemplateOverrides(fd, generationResult.tableStructure, resolvedDocumentInputs);
  }

  let rendered;
  try {
    rendered = await renderDocument(generationResult, theme);
    if (isWorklogTemplateName(templateName) && rendered.extension === 'docx') {
      rendered = { ...rendered, buffer: collapseWorklogNextPlanRows(rendered.buffer) };
    }
  } catch (e) {
    return failureResponse(e, '[generate] DOCX FormData render error:', 'DOCX 템플릿 구조에 맞춘 렌더링에 실패했습니다. 템플릿 필드 또는 양식 구조를 확인해주세요.');
  }
  return persistAndRespond(ctx, rendered, () => generationResult.markdown?.trim() || `[DOCX 양식 채우기] ${templateName}`,
    '[generate] DOCX FormData Storage upload error:', '템플릿 기반 DOCX 파일 업로드에 실패했습니다.');
}

// HWPX 폼 데이터 기반: 빈 셀에 내용 주입 → Storage 업로드
export async function respondHwpxFormData(ctx: OutputContext, generationResult: GenerationResult, theme: CorporateTheme, runtimeMeta: RuntimeOverrideMeta, resolvedDocumentInputs: Record<string, string>) {
  if (!(generationResult.hwpxFormData && generationResult.templateBuffer && generationResult.hwpxTableStructure)) return null;
  const { templateName } = ctx;
  const hfd = generationResult.hwpxFormData;
  const hcells = generationResult.hwpxTableStructure.emptyCells;

  // ── 1단계: 섹션 통합 (AI가 행별 분산한 내용을 첫 셀로 합침) ──
  consolidateSectionCells(hfd, hcells);

  // ── 2단계: 메타데이터 강제 보정 (통합 결과를 덮어씀) ──
  applyFormDataRuntimeOverrides(hfd, hcells, runtimeMeta);
  if (isWorklogTemplateName(templateName)) {
    applyWorklogTemplateOverrides(hfd, generationResult.hwpxTableStructure, resolvedDocumentInputs);
  }

  // 렌더 실패는 try 없이 상위(generateDocument) catch 로 전달
  const rendered = await renderDocument(generationResult, theme);
  return persistAndRespond(ctx, rendered, () => generationResult.markdown?.trim() || `[HWPX 양식 채우기] ${templateName}`,
    '[generate] HWPX FormData Storage upload error:', '파일 업로드 실패');
}

// DOCX 템플릿 기반: 파일 렌더링 → Storage 업로드 (XLSX/PPTX와 동일 흐름)
export async function respondDocxTemplate(ctx: OutputContext, generationResult: GenerationResult, theme: CorporateTheme) {
  if (!(generationResult.docxReplacements && generationResult.templateBuffer)) return null;
  let rendered;
  try {
    rendered = await renderDocument(generationResult, theme);
  } catch (e) {
    return failureResponse(e, '[generate] DOCX template render error:', 'DOCX 템플릿 구조에 맞춘 렌더링에 실패했습니다. 템플릿 필드 또는 양식 구조를 확인해주세요.');
  }
  return persistAndRespond(ctx, rendered, () => generationResult.markdown?.trim() || `[DOCX 템플릿 기반] ${ctx.templateName}`,
    '[generate] DOCX Storage upload error:', '템플릿 기반 DOCX 파일 업로드에 실패했습니다.');
}

// XLSX/PPTX 구조화 결과: 렌더 → Storage 업로드 (렌더 실패는 상위 catch 로 전달)
export async function respondStructured(ctx: OutputContext, generationResult: GenerationResult, theme: CorporateTheme) {
  const { format } = ctx;
  const rendered = await renderDocument(generationResult, theme);
  const contentSummary = format === 'xlsx'
    ? `[Excel] ${generationResult.excelSheets?.map(s => s.sheetName).join(', ')} (${generationResult.excelSheets?.reduce((sum, s) => sum + s.rows.length, 0)}행)`
    : `[PPT] ${generationResult.pptxSlides?.length}개 슬라이드`;

  return persistAndRespond(ctx, rendered, () => contentSummary, '[generate] Storage upload error:', '파일 업로드 실패',
    () => ({ outline: format === 'xlsx' ? { sheets: generationResult.excelSheets } : { slides: generationResult.pptxSlides } }));
}
