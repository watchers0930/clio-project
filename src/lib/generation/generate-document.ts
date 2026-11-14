import { ApiError, errorResponse } from '@/lib/http/api-error';
import { saveMarkdown } from './save-markdown';
import { buildDocumentInputInstructions, VALID_FORMATS } from './form-overrides';
import { serverLeaveInputs } from '@/lib/leave/leave-document';
import { respondContractDirect } from './contract-direct';
import { respondDocxFormData, respondHwpxFormData, respondDocxTemplate, respondStructured, type OutputContext, type PersistContext } from './output-paths';
import { withMutation } from '@/lib/http/mutation-guard';
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
import { generateForFormat } from '@/lib/ai/generate-for-format';
import type { OutputFormat } from '@/lib/renderers/types';
import {
  buildInstructionMeta,
  buildTheme,
  loadReferenceContent,
  loadCompanyLogoWatermarkContext,
  loadSourceChunks,
  loadTemplateContext,
  loadUserGenerationContext,
  resolveVersionFields,
} from './context';
import { getWorklogDocumentTitle, isWorklogTemplateName } from '@/lib/templates/worklog';
import { isProposalTemplateName } from '@/lib/templates/proposal';
import { isEmploymentCertificateTemplateName } from '@/lib/templates/employment-certificate';
import { isStandardLaborContractTemplateName } from '@/lib/templates/standard-labor-contract';
import { signatureBufferToDataUrl } from '@/lib/utils/signature-data-url';
import { loadCompanySeal } from '@/lib/settings/company-seal';



export async function generateDocument(request: NextRequest) {
  const mutation = await withMutation(request);
  if (mutation.error) return mutation.error;
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

    const supabase = mutation.supabase;
    if (!supabase) {
      return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = mutation.userId;
    if (!authUserId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const versionFields = await resolveVersionFields(supabase, parentId);
    const { userName, userPosition, userDept, signatureBuffer } = await loadUserGenerationContext(supabase, authUserId);
    const companyLogoContext = await loadCompanyLogoWatermarkContext();
    // 재직증명서 등 회사 발급 문서의 직인은 회사 공용 직인을 사용
    const companySealBuffer = await loadCompanySeal();
    const sourceContext = await loadSourceChunks(supabase, sourceFileIds);
    const { sourceChunks, sourceFileNames, sourceFileSummary, sourceFileCount } = sourceContext;
    const templateContext = await loadTemplateContext(supabase, templateId, customStructure, format);
    const { tmpl, templateBundle, templateName, templateFileText, templateBuffer, templateFileName } = templateContext;
    format = templateContext.format;
    const isProposalTemplate = isProposalTemplateName(templateName);
    const leaveOverrides = await serverLeaveInputs(authUserId,templateName,documentInputs);
    const leaveInputs = {...(documentInputs ?? {}),...leaveOverrides};

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
    const persistContext: PersistContext = { supabase, authUserId, templateId, templateName, sourceFileIds, versionFields, originDocumentId, originContext, format };
    const contractResponse = await respondContractDirect(persistContext, contractFormData, templateBuffer, todayStr);
    if (contractResponse) return contractResponse;
    console.log('[generate] 계약서 경로 미진입. contractFormData:', !!contractFormData, 'templateBuffer:', !!templateBuffer, 'templateName:', templateName);

    // AI 콘텐츠 생성 (포맷별 분기)
    const resolvedDocumentInputs = {
      ...(typeof documentInputs === 'object' && documentInputs ? documentInputs : {}),
      ...leaveOverrides,
      author: userName,
      author_department: userDept,
      author_position: userPosition,
      report_date: todayStr,
      report_time: timeStr,
      report_no: reportNo,
      signature_image_src: signatureBufferToDataUrl(
        (isEmploymentCertificateTemplateName(templateName) || isStandardLaborContractTemplateName(templateName)) && companySealBuffer ? companySealBuffer : signatureBuffer,
      ),
      employee_signature_src: signatureBufferToDataUrl(signatureBuffer),
      company_logo_src: signatureBufferToDataUrl(companyLogoContext.buffer),
      company_logo_pattern_size: companyLogoContext.patternSize,
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


    const outputContext: OutputContext = { ...persistContext, instructions, title, dateStr, leaveInputs };
    const runtimeMeta = { userName, userPosition, userDept, todayStr, templateName };
    // 양식 채우기(DOCX→HWPX) → DOCX 템플릿 순으로 해당 경로가 있으면 그 응답을 반환 (await 로 예외를 아래 catch 로 전달)
    const formResponse = await respondDocxFormData(outputContext, generationResult, theme, runtimeMeta, resolvedDocumentInputs)
      ?? await respondHwpxFormData(outputContext, generationResult, theme, runtimeMeta, resolvedDocumentInputs)
      ?? await respondDocxTemplate(outputContext, generationResult, theme);
    if (formResponse) return formResponse;

    // 마크다운 기반 포맷(DOCX새로생성/HWPX/PDF)은 기존처럼 documents 테이블에도 저장
    if (generationResult.markdown) return saveMarkdown({supabase, authUserId, generationResult, theme, isProposalTemplate, templateName, resolvedDocumentInputs, title, templateId, sourceFileIds, instructions, versionFields, originDocumentId, originContext, format, leaveInputs, dateStr});

    return await respondStructured(outputContext, generationResult, theme);
  } catch (err) {
    if(err instanceof ApiError) return errorResponse(err);
    const errMsg = err instanceof Error ? err.message : '문서 생성 실패';
    const errStack = err instanceof Error ? err.stack?.split('\n').slice(0, 5).join('\n') : '';
    console.error('[generate] error:', errMsg, errStack);
    return NextResponse.json({ error: '문서 생성 중 오류가 발생했습니다. 다시 시도해 주세요.' }, { status: 500 });
  }
}
