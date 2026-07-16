/**
 * POST /api/generate
 * 멀티포맷 문서 생성 통합 엔드포인트
 *
 * 요청: { templateId, sourceFileIds[], instructions, outputFormat }
 * 응답:
 *   - DOCX/HWPX: 마크다운 콘텐츠 + 문서 DB 저장
 *   - XLSX/PPTX: 구조화 JSON + 파일 생성 → Supabase Storage 업로드 → URL 반환
 *   - PDF: HTML 콘텐츠 반환 (클라이언트 print-to-pdf)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { generateForFormat } from '@/lib/ai/generate-document';
import { applyFormDataRuntimeOverrides } from '@/lib/ai/generate-document-helpers';
import { renderDocument } from '@/lib/renderers';
import { collapseWorklogNextPlanRows } from '@/lib/renderers/docx-renderer';
import type { DocxFormData, DocxTableStructure, OutputFormat } from '@/lib/renderers/types';
import {
  buildInstructionMeta,
  buildDocumentInsertPayload,
  buildTheme,
  loadReferenceContent,
  loadSourceChunks,
  loadTemplateContext,
  loadUserGenerationContext,
  persistCompletedRender,
  resolveVersionFields,
} from './route-helpers';
import { getWorklogDocumentTitle, isWorklogTemplateName } from '@/lib/templates/worklog';
import { isProposalTemplateName } from '@/lib/templates/proposal';
import { isBusinessPlanTemplateName } from '@/lib/templates/business-plan';
import { signatureBufferToDataUrl } from '@/lib/utils/signature-data-url';

export const maxDuration = 300;

/**
 * 같은 섹션(연속 행)의 내용을 첫 셀에 합치고 나머지 비우기.
 * AI가 행별로 분산 채우는 문제를 프로그래밍으로 보정.
 * 연속 행 판정: emptyCells를 (tableIndex, colIndex)별로 그룹핑 후 rowIndex 연속 여부 확인.
 * 섹션 헤더(비어있지 않은 행)가 있으면 자연스럽게 그룹이 끊어짐.
 */
/**
 * 같은 테이블+같은 열의 빈 셀 내용을 첫 셀로 합치고 나머지 비우기.
 * 연속행 여부 무관 — 같은 (tableIndex, colIndex)면 무조건 합침.
 */
function consolidateSectionCells(
  fd: Record<string, string>,
  emptyCells: Array<{ fieldId: string; tableIndex: number; rowIndex: number; colIndex: number }>,
) {
  const groups = new Map<string, Array<{ fieldId: string; rowIndex: number }>>();

  for (const cell of emptyCells) {
    const key = `${cell.tableIndex}_${cell.colIndex}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ fieldId: cell.fieldId, rowIndex: cell.rowIndex });
  }

  for (const [, cells] of groups) {
    if (cells.length <= 1) continue;
    cells.sort((a, b) => a.rowIndex - b.rowIndex);

    const merged = cells
      .map(c => fd[c.fieldId] || '')
      .filter(v => v.trim() !== '')
      .join('\n');

    fd[cells[0].fieldId] = merged;
    for (let i = 1; i < cells.length; i++) {
      fd[cells[i].fieldId] = '';
    }
  }
}

function applyWorklogTemplateOverrides(
  formData: DocxFormData,
  structure: DocxTableStructure,
  documentInputs: Record<string, string>,
) {
  const noteValue = documentInputs.note?.trim() ?? '';
  const tomorrowValue = documentInputs.tomorrow_work?.trim() ?? '';

  for (const table of structure.tables) {
    const normalizedHeaders = table.headers.map((header) => header.replace(/\s+/g, ''));
    const isNextPlanTable = normalizedHeaders.includes('번호') && normalizedHeaders.includes('작업내용');
    const isTodayTable = normalizedHeaders.includes('업무내용') && normalizedHeaders.includes('비고');

    if (isTodayTable) {
      const bigoColIndex = normalizedHeaders.findIndex((header) => header === '비고');
      if (bigoColIndex >= 0) {
        for (const row of table.rows.slice(1)) {
          const bigoCell = row[bigoColIndex];
          if (bigoCell?.isEmpty) formData[bigoCell.fieldId] = '';
        }
      }

      for (const row of table.rows) {
        const labelCell = row[0];
        if (!labelCell) continue;
        const normalizedLabel = labelCell.text.replace(/\s+/g, '');
        if (!normalizedLabel.includes('특이사항') && !normalizedLabel.includes('건의사항')) continue;

        const targetCells = row.filter((cell, index) => index > 0 && cell.isEmpty);
        if (targetCells.length === 0) continue;

        formData[targetCells[0].fieldId] = noteValue;
        for (const cell of targetCells.slice(1)) {
          formData[cell.fieldId] = '';
        }
      }
    }

    if (isNextPlanTable) {
      const contentColIndex = normalizedHeaders.findIndex((header) => header === '작업내용');
      if (contentColIndex >= 0) {
        const contentCells = table.rows
          .slice(1)
          .map((row) => row[contentColIndex])
          .filter((cell) => cell?.isEmpty);

        if (contentCells.length > 0) {
          formData[contentCells[0].fieldId] = tomorrowValue;
          for (const cell of contentCells.slice(1)) {
            formData[cell.fieldId] = '';
          }
        }
      }

      const bigoColIndex = normalizedHeaders.findIndex((header) => header === '비고');
      if (bigoColIndex >= 0) {
        for (const row of table.rows.slice(1)) {
          const bigoCell = row[bigoColIndex];
          if (bigoCell?.isEmpty) formData[bigoCell.fieldId] = '';
        }
      }
    }
  }

  return formData;
}

const VALID_FORMATS: OutputFormat[] = ['docx', 'pdf', 'hwpx', 'xlsx', 'pptx'];

function isMouTemplateName(templateName: string | null | undefined) {
  return Boolean(templateName && /업무협약서|MOU|양해각서/i.test(templateName));
}

function buildDocumentSummary(params: {
  id?: string;
  title: string;
  templateName: string;
  createdAt: string;
  status: '초안' | '완료';
  sourceCount: number;
  content: string;
  versionNumber?: number | null;
  parentId?: string | null;
  originDocumentId?: string | null;
  originContext?: string | null;
  outputFormat?: string | null;
}) {
  return {
    id: params.id,
    title: params.title,
    template: params.templateName,
    createdAt: params.createdAt,
    status: params.status,
    sourceCount: params.sourceCount,
    content: params.content,
    versionNumber: params.versionNumber ?? 1,
    parentId: params.parentId ?? null,
    originDocumentId: params.originDocumentId ?? null,
    originContext: params.originContext ?? null,
    outputFormat: params.outputFormat ?? null,
  };
}

function buildDocumentInputInstructions(documentInputs: Record<string, string>) {
  const lines: string[] = [];
  const labelMap: Record<string, string> = {
    demand_org: '수요기관명',
    proposer_name: '제안사명',
    project_name: '사업명 또는 과업명',
    proposal_objective: '제안 목적',
    scope_summary: '핵심 수행 범위',
    special_notes: '특기사항 또는 작성 메모',
  };

  const pushLine = (label: string, value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) lines.push(`${label}: ${trimmed}`);
  };

  pushLine('제목', documentInputs.report_title);
  pushLine('부제목', documentInputs.subtitle);
  pushLine('금일업무내용', documentInputs.today_work);
  pushLine('특이사항', documentInputs.note);
  pushLine('차일업무계획', documentInputs.tomorrow_work);

  for (const [key, value] of Object.entries(documentInputs)) {
    if (!value?.trim()) continue;
    if (['report_title', 'subtitle', 'today_work', 'tomorrow_work', 'note'].includes(key)) continue;
    lines.push(`${labelMap[key] ?? key}: ${value.trim()}`);
  }

  return lines.length > 0 ? `## 기본 입력값\n${lines.join('\n')}` : '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      templateId,
      sourceFileIds,
      instructions,
      outputFormat = 'docx',
      font,
      customStructure,
      contractFormData,
      parentId,
      originDocumentId,
      originContext,
      documentInputs,
      aiAssist = false,
      aiAssistPrompt,
      referenceDocId,
    } = body;

    const theme = buildTheme(font);

    if (!templateId && !customStructure) {
      return NextResponse.json({ error: '템플릿을 선택하거나 문서 구조를 입력해주세요.' }, { status: 400 });
    }

    let format = outputFormat as OutputFormat;
    if (!VALID_FORMATS.includes(format)) {
      return NextResponse.json({ error: `지원하지 않는 포맷: ${outputFormat}` }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const versionFields = await resolveVersionFields(supabase, parentId);
    const { userName, userPosition, userDept, signatureBuffer } = await loadUserGenerationContext(supabase, authUserId);
    const sourceContext = await loadSourceChunks(supabase, sourceFileIds);
    const { sourceChunks, sourceFileNames, sourceFileSummary, sourceFileCount } = sourceContext;
    const templateContext = await loadTemplateContext(supabase, templateId, customStructure, format);
    const { tmpl, templateBundle, templateName, templateFileText, templateBuffer, templateFileName } = templateContext;
    format = templateContext.format;
    const isProposalTemplate = isProposalTemplateName(templateName);

    // 참조 제안서 콘텐츠 로드
    let referenceSections: Map<string, string> | null = null;
    if (referenceDocId && isProposalTemplate) {
      referenceSections = await loadReferenceContent(supabase, referenceDocId);
    }

    if (templateFileName) {
      const ext = templateFileName.split('.').pop()?.toLowerCase() ?? '';
      const allowedFormats = ext === 'docx' || ext === 'dotx'
        ? ['docx', 'pdf']
        : ext === 'hwpx' || ext === 'hwp'
        ? ['hwpx', 'pdf']
        : ext === 'xlsx' || ext === 'xls'
        ? ['xlsx']
        : ext === 'pptx' || ext === 'ppt'
        ? ['pptx']
        : null;

      if (allowedFormats && !allowedFormats.includes(format)) {
        return NextResponse.json({
          error: `선택한 템플릿 파일(${templateFileName})은 ${allowedFormats.map((item) => item.toUpperCase()).join(', ')} 포맷으로만 생성할 수 있습니다.`,
        }, { status: 400 });
      }
    }

    const { todayStr, timeStr, reportNo, enrichedInstructions } = buildInstructionMeta(userName, userDept, instructions);

    // ── 계약서 직접 치환 경로 (AI 미사용) ──
    if (contractFormData && typeof contractFormData === 'object' && Object.keys(contractFormData).length > 0 && templateBuffer) {
      const { isContractTemplate } = await import('@/lib/contract-fields');
      if (isContractTemplate(templateName)) {
        const { renderSystemContract } = await import('@/lib/renderers/contract-renderer');
        const dateStr = todayStr;
        const title = `${templateName} (${dateStr} 생성)`;

        console.log('[generate] 계약서 직접 치환 시작:', templateName, 'buffer:', templateBuffer.length, 'bytes, ZIP magic:', templateBuffer[0] === 0x50 && templateBuffer[1] === 0x4B ? 'OK' : 'FAIL');
        let rendered;
        try {
          rendered = renderSystemContract(templateBuffer, contractFormData as Record<string, string>, title);
          console.log('[generate] 계약서 렌더링 완료:', rendered.buffer.length, 'bytes, ZIP magic:', rendered.buffer[0] === 0x50 && rendered.buffer[1] === 0x4B ? 'OK' : 'FAIL');
        } catch (renderErr) {
          console.error('[generate] 계약서 렌더링 에러:', renderErr instanceof Error ? renderErr.message : renderErr, renderErr instanceof Error ? renderErr.stack : '');
          return NextResponse.json({ error: '계약서 생성 실패: ' + (renderErr instanceof Error ? renderErr.message : '알 수 없는 오류') }, { status: 500 });
        }
        try {
          const content = `[계약서 자동 작성] ${templateName}`;
          const { newDoc, signedUrl, downloadFileName, downloadExtension, downloadMimeType } = await persistCompletedRender({
            supabase,
            authUserId,
            rendered,
            title,
            content,
            templateId,
            sourceFileIds,
            instructions: JSON.stringify(contractFormData),
            versionFields,
            originDocumentId,
            originContext,
            auditDetails: { format: 'hwpx', mode: 'contract-direct' },
          });
          return NextResponse.json({
            document: buildDocumentSummary({
              id: newDoc?.id,
              title,
              templateName,
            createdAt: dateStr,
            status: '완료',
            sourceCount: 0,
            content,
            versionNumber: (newDoc as { version_number?: number | null } | null)?.version_number ?? 1,
            parentId: (newDoc as { parent_id?: string | null } | null)?.parent_id ?? null,
            originDocumentId: (newDoc as { origin_document_id?: string | null } | null)?.origin_document_id ?? null,
            originContext: (newDoc as { origin_context?: string | null } | null)?.origin_context ?? null,
            outputFormat: format,
          }),
            format: 'hwpx',
            mode: 'contract-direct',
            downloadUrl: signedUrl,
            downloadFileName,
            downloadExtension,
            downloadMimeType,
          }, { status: 201 });
        } catch (e) {
          console.error('[generate] Contract upload error:', e);
          return NextResponse.json({ error: '파일 업로드 실패' }, { status: 500 });
        }
      }
    }
    console.log('[generate] 계약서 경로 미진입. contractFormData:', !!contractFormData, 'templateBuffer:', !!templateBuffer, 'templateName:', templateName);

    // AI 콘텐츠 생성 (포맷별 분기)
    const resolvedDocumentInputs = {
      ...(typeof documentInputs === 'object' && documentInputs ? documentInputs : {}),
      author: userName,
      author_department: userDept,
      author_position: userPosition,
      report_date: todayStr,
      report_time: timeStr,
      report_no: reportNo,
      signature_image_src: signatureBufferToDataUrl(signatureBuffer),
      source_file_names: sourceFileNames.join(', '),
      source_file_count: String(sourceFileCount),
      source_file_summary: sourceFileSummary || (sourceFileCount > 0 ? `${sourceFileNames.join(', ')} 참조` : ''),
    };
    const documentInputInstructions = buildDocumentInputInstructions(resolvedDocumentInputs);
    const generationInstructions = [
      enrichedInstructions,
      documentInputInstructions,
      isProposalTemplate ? '## 제안서 작성 규칙\n입력된 기본정보를 최우선 사실로 사용합니다. 참조 자료를 근거로 공공기관 제출용 제안서를 작성합니다. 확인되지 않은 비용, 일정, 인력 실명은 [확인필요]로 남깁니다.' : '',
      aiAssist ? '## AI 보강 요청\n사용자가 직접 입력하지 않은 항목은 참조 자료와 템플릿 문맥을 바탕으로 자연스럽게 보강합니다. 사실이 불명확한 값은 [확인필요]로 남깁니다.' : '',
      aiAssistPrompt ? `## 추가 AI 보강 지시\n${String(aiAssistPrompt)}` : '',
    ].filter(Boolean).join('\n\n');

    const generationResult = await generateForFormat({
      format,
      templateName,
      templateContent: customStructure ? customStructure : templateBundle?.outline ?? ((typeof tmpl?.description === 'string' && tmpl.description.trim()) ? tmpl.description : null),
      templateBundle,
      templateFileText,
      templateBuffer,
      sourceChunks,
      instructions: generationInstructions,
      documentInputs: resolvedDocumentInputs,
      referenceSections: referenceSections ?? undefined,
    });

    const dateStr = todayStr;
    const preferredTitle = typeof resolvedDocumentInputs.report_title === 'string' && resolvedDocumentInputs.report_title.trim()
      ? resolvedDocumentInputs.report_title.trim()
      : isWorklogTemplateName(templateName)
      ? getWorklogDocumentTitle(dateStr, templateName)
      : templateName;
    const title = isWorklogTemplateName(templateName) && !resolvedDocumentInputs.report_title?.trim()
      ? preferredTitle
      : `${preferredTitle} (${dateStr} 생성)`;
    generationResult.title = title;

    // DOCX 폼 데이터 기반: 빈 셀에 내용 주입 → Storage 업로드
    if (generationResult.docxFormData && generationResult.templateBuffer && generationResult.tableStructure) {
      const fd = generationResult.docxFormData;
      const cells = generationResult.tableStructure.emptyCells;

      // ── 1단계: 섹션 통합 (AI가 행별 분산한 내용을 첫 셀로 합침) ──
      consolidateSectionCells(fd, cells);

      // ── 2단계: 메타데이터 강제 보정 (통합 결과를 덮어씀) ──
      applyFormDataRuntimeOverrides(fd, cells, { userName, userPosition, userDept, todayStr, templateName });
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
        console.error('[generate] DOCX FormData render error:', e);
        return NextResponse.json({ error: 'DOCX 템플릿 구조에 맞춘 렌더링에 실패했습니다. 템플릿 필드 또는 양식 구조를 확인해주세요.' }, { status: 500 });
      }
      {
        try {
          const content = generationResult.markdown?.trim() || `[DOCX 양식 채우기] ${templateName}`;
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
          }, { status: 201 });
        } catch (e) {
          console.error('[generate] DOCX FormData Storage upload error:', e);
          return NextResponse.json({ error: '템플릿 기반 DOCX 파일 업로드에 실패했습니다.' }, { status: 500 });
        }
      }
    }

    // HWPX 폼 데이터 기반: 빈 셀에 내용 주입 → Storage 업로드
    if (generationResult.hwpxFormData && generationResult.templateBuffer && generationResult.hwpxTableStructure) {
      const hfd = generationResult.hwpxFormData;
      const hcells = generationResult.hwpxTableStructure.emptyCells;

      // ── 1단계: 섹션 통합 (AI가 행별 분산한 내용을 첫 셀로 합침) ──
      consolidateSectionCells(hfd, hcells);

      // ── 2단계: 메타데이터 강제 보정 (통합 결과를 덮어씀) ──
      applyFormDataRuntimeOverrides(hfd, hcells, { userName, userPosition, userDept, todayStr, templateName });
      if (isWorklogTemplateName(templateName)) {
        applyWorklogTemplateOverrides(hfd, generationResult.hwpxTableStructure, resolvedDocumentInputs);
      }

      const rendered = await renderDocument(generationResult, theme);
        try {
          const content = generationResult.markdown?.trim() || `[HWPX 양식 채우기] ${templateName}`;
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
        }, { status: 201 });
      } catch (e) {
        console.error('[generate] HWPX FormData Storage upload error:', e);
        return NextResponse.json({ error: '파일 업로드 실패' }, { status: 500 });
      }
    }

    // DOCX 템플릿 기반: 파일 렌더링 → Storage 업로드 (XLSX/PPTX와 동일 흐름)
    if (generationResult.docxReplacements && generationResult.templateBuffer) {
      let rendered;
      try {
        rendered = await renderDocument(generationResult, theme);
      } catch (e) {
        console.error('[generate] DOCX template render error:', e);
        return NextResponse.json({ error: 'DOCX 템플릿 구조에 맞춘 렌더링에 실패했습니다. 템플릿 필드 또는 양식 구조를 확인해주세요.' }, { status: 500 });
      }
      {
        try {
          const content = generationResult.markdown?.trim() || `[DOCX 템플릿 기반] ${templateName}`;
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
          }, { status: 201 });
        } catch (e) {
          console.error('[generate] DOCX Storage upload error:', e);
          return NextResponse.json({ error: '템플릿 기반 DOCX 파일 업로드에 실패했습니다.' }, { status: 500 });
        }
      }
    }

    // 마크다운 기반 포맷(DOCX새로생성/HWPX/PDF)은 기존처럼 documents 테이블에도 저장
    if (generationResult.markdown) {
      // 제안서/사업계획서: documentInputs를 콘텐츠 앞에 HTML 코멘트로 저장 (다운로드 시 표지 복원용)
      const shouldEmbedInputs = isProposalTemplate || isBusinessPlanTemplateName(templateName) || isMouTemplateName(templateName);
      const markdownContent = shouldEmbedInputs
        ? `<!--DOCUMENT_INPUTS:${JSON.stringify(resolvedDocumentInputs)}-->\n${generationResult.markdown}`
        : generationResult.markdown;

      const payload = buildDocumentInsertPayload({
        title,
        content: markdownContent,
        templateId,
        sourceFileIds,
        instructions,
        status: 'draft',
        createdBy: authUserId,
        versionFields,
        originDocumentId,
        originContext,
        outputFormat: format,
      });
      const { data: newDoc, error } = await supabase.from('documents').insert(payload).select().single();

      if (error) {
        console.error('[generate] DB insert error:', error.message);
        return NextResponse.json({ error: '문서 생성에 실패했습니다.' }, { status: 500 });
      }

      // audit
      await supabase.from('audit_logs').insert({
        user_id: authUserId,
        action: 'document.create',
        target_type: 'document',
        target_id: newDoc.id,
        details: { title, format },
      }).then(() => {}, () => {});

      // PDF/DOCX/HWPX 마크다운 → 파일 렌더링 → Storage 업로드
      if (format === 'pdf' || format === 'hwpx' || format === 'docx') {
        const rendered = await renderDocument(generationResult, theme);
        const filePath = `generated/${authUserId}/${crypto.randomUUID()}.${rendered.extension}`;
        const { error: upErr } = await supabase.storage
          .from('files')
          .upload(filePath, rendered.buffer, { contentType: rendered.mimeType, upsert: false });
        if (upErr) {
          console.error(`[generate] ${format.toUpperCase()} Storage upload error:`, upErr.message);
        } else {
          await supabase.from('documents').update({ storage_path: filePath }).eq('id', newDoc.id).then(() => {}, () => {});
        }
        const { data: fileUrl } = await supabase.storage
          .from('files')
          .createSignedUrl(filePath, 3600);

        return NextResponse.json({
          document: buildDocumentSummary({
            id: newDoc.id,
            title,
            templateName,
            createdAt: dateStr,
            status: '초안',
            sourceCount: (sourceFileIds ?? []).length,
            content: markdownContent,
            versionNumber: (newDoc as { version_number?: number | null }).version_number ?? 1,
            parentId: (newDoc as { parent_id?: string | null }).parent_id ?? null,
            originDocumentId: (newDoc as { origin_document_id?: string | null }).origin_document_id ?? null,
            originContext: (newDoc as { origin_context?: string | null }).origin_context ?? null,
            outputFormat: format,
          }),
          format,
          downloadUrl: fileUrl?.signedUrl ?? null,
          downloadFileName: rendered.fileName,
          downloadExtension: rendered.extension,
          downloadMimeType: rendered.mimeType,
        }, { status: 201 });
      }

      return NextResponse.json({
        document: buildDocumentSummary({
          id: newDoc.id,
          title,
          templateName,
          createdAt: dateStr,
          status: '초안',
          sourceCount: (sourceFileIds ?? []).length,
          content: markdownContent,
          versionNumber: (newDoc as { version_number?: number | null }).version_number ?? 1,
          parentId: (newDoc as { parent_id?: string | null }).parent_id ?? null,
          originDocumentId: (newDoc as { origin_document_id?: string | null }).origin_document_id ?? null,
          originContext: (newDoc as { origin_context?: string | null }).origin_context ?? null,
          outputFormat: format,
        }),
        format,
      }, { status: 201 });
    }

    const rendered = await renderDocument(generationResult, theme);
    const contentSummary = format === 'xlsx'
      ? `[Excel] ${generationResult.excelSheets?.map(s => s.sheetName).join(', ')} (${generationResult.excelSheets?.reduce((sum, s) => sum + s.rows.length, 0)}행)`
      : `[PPT] ${generationResult.pptxSlides?.length}개 슬라이드`;

    try {
      const { newDoc, signedUrl, downloadFileName, downloadExtension, downloadMimeType } = await persistCompletedRender({
        supabase,
        authUserId,
        rendered,
        title,
        content: contentSummary,
        templateId,
        sourceFileIds,
        instructions: instructions ?? null,
        versionFields,
        originDocumentId,
        originContext,
        auditDetails: { format },
      });
      return NextResponse.json({
        document: buildDocumentSummary({
          id: newDoc?.id,
          title,
          templateName,
          createdAt: dateStr,
          status: '완료',
          sourceCount: (sourceFileIds ?? []).length,
          content: contentSummary,
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
        outline: format === 'xlsx' ? { sheets: generationResult.excelSheets } : { slides: generationResult.pptxSlides },
      }, { status: 201 });
    } catch (e) {
      console.error('[generate] Storage upload error:', e);
      return NextResponse.json({ error: '파일 업로드 실패' }, { status: 500 });
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '문서 생성 실패';
    const errStack = err instanceof Error ? err.stack?.split('\n').slice(0, 5).join('\n') : '';
    console.error('[generate] error:', errMsg, errStack);
    return NextResponse.json({ error: `문서 생성 중 오류: ${errMsg}` }, { status: 500 });
  }
}
