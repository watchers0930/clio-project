/**
 * AI 문서 생성 엔진 — 멀티포맷 지원
 * 템플릿 + 양식파일 + 소스 파일 청크 + 지시사항 → GPT-4o → 포맷별 결과
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { TemplateBundle } from '@/lib/templates/template-schema';
import { isWorklogTemplateName } from '@/lib/templates/worklog';
import { isProposalTemplateName } from '@/lib/templates/proposal';
import { isBusinessPlanTemplateName } from '@/lib/templates/business-plan';
import { isEmploymentCertificateTemplateName } from '@/lib/templates/employment-certificate';
import { isApprovalRequestTemplateName } from '@/lib/templates/approval-request';
import { generateBusinessPlanBySections, generateProposalBySections } from './generate-sectioned';
import { buildDocumentPrompt } from './build-document-prompt';

export async function generateDocumentContent(params: {
  templateName: string;
  templateContent?: string | null;
  templateBundle?: TemplateBundle | null;
  templateFileText?: string | null;
  sourceChunks: string[];
  instructions?: string;
  documentInputs?: Record<string, string>;
  referenceSections?: Map<string, string>;
}): Promise<string> {
  const { templateName, templateContent, templateBundle, templateFileText, sourceChunks, instructions, documentInputs, referenceSections } = params;
  if (isWorklogTemplateName(templateName)) {
    const reportDate = documentInputs?.report_date || '';
    const author = documentInputs?.author || '';
    const title = documentInputs?.report_title?.trim() || templateName;
    const todayWork = documentInputs?.today_work?.trim() || '[미입력]';
    const tomorrowWork = documentInputs?.tomorrow_work?.trim() || '[미입력]';
    const note = documentInputs?.note?.trim() || '[미입력]';

    return [
      `# ${title}`,
      '',
      author ? `**작성자:** ${author}` : '',
      reportDate ? `**작성일:** ${reportDate}` : '',
      '',
      '## 금일업무내용',
      todayWork,
      '',
      '## 특이사항',
      note,
      '',
      '## 차일업무계획',
      tomorrowWork,
    ].filter(Boolean).join('\n');
  }

  if (isEmploymentCertificateTemplateName(templateName)) {
    const title = documentInputs?.report_title?.trim() || templateName;
    const lines = [
      `# ${title}`,
      '',
      '## 인적사항',
      `- 성명(한글): ${documentInputs?.employee_name || '[미입력]'}`,
      `- 주민등록번호: ${documentInputs?.resident_registration_no || ''}`,
      `- 주소: ${documentInputs?.employee_address || ''}`,
      '',
      '## 재직사항 및 제출용도',
      `- 근무부서: ${documentInputs?.department || ''}`,
      `- 직위: ${documentInputs?.position || ''}`,
      `- 재직기간: ${documentInputs?.employment_start_date || '[미입력]'} 부터 ${documentInputs?.employment_end_date || documentInputs?.report_date || ''} 현재까지`,
      `- 제출용도: ${documentInputs?.purpose || ''}`,
      '',
      '## 회사 정보',
      `- 회사명: ${documentInputs?.company_name || ''}`,
      `- 대표자: ${documentInputs?.representative_name || ''}`,
      `- 사업자등록번호: ${documentInputs?.business_registration_no || ''}`,
      `- 주소: ${documentInputs?.company_address || ''}`,
      `- 전화: ${documentInputs?.company_phone || ''}`,
    ];
    return lines.join('\n');
  }

  if (isApprovalRequestTemplateName(templateName)) {
    const title = documentInputs?.report_title?.trim() || templateName;
    return [
      `# ${title}`,
      '',
      '## 기안 정보',
      `- 문서번호: ${documentInputs?.report_no || ''}`,
      `- 기안일: ${documentInputs?.report_date || ''}`,
      `- 기안부서: ${documentInputs?.author_department || ''}`,
      `- 기안자: ${documentInputs?.author || ''} ${documentInputs?.author_position || ''}`.trim(),
      '',
      '## 품의 내용',
      `- 건명: ${documentInputs?.subject || '[미입력]'}`,
      `- 품의 목적: ${documentInputs?.purpose || ''}`,
      `- 세부 내용: ${documentInputs?.details || ''}`,
      `- 소요 예산: ${documentInputs?.budget_amount || ''}`,
      `- 시행 예정일: ${documentInputs?.execution_date || ''}`,
      `- 비고: ${documentInputs?.remarks || ''}`,
    ].join('\n');
  }

  // 제안서: 섹션별 분할 생성 (템플릿 파일 없는 번들 기반)
  if (isProposalTemplateName(templateName) && templateBundle && !templateFileText) {
    return generateProposalBySections({
      templateName,
      templateBundle,
      sourceChunks,
      instructions,
      documentInputs,
      referenceSections,
    });
  }

  // 사업계획서: Gemini Flash 섹션별 병렬 생성
  if (isBusinessPlanTemplateName(templateName) && templateBundle && !templateFileText) {
    return generateBusinessPlanBySections({
      templateName,
      templateBundle,
      sourceChunks,
      instructions,
      documentInputs,
    });
  }

  const { systemPrompt, userPrompt, isProposalTemplate } = buildDocumentPrompt({
    templateName,
    templateContent,
    templateBundle,
    templateFileText,
    sourceChunks,
    instructions,
    documentInputs,
  });

  const model = openai('gpt-4o');

  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    maxOutputTokens: isProposalTemplate ? 16000 : 12000,
    temperature: 0.2,
  });

  let result = text.trim();
  if (result.startsWith('```markdown')) result = result.replace(/^```markdown\s*\n?/, '').replace(/\n?```\s*$/, '');
  else if (result.startsWith('```')) result = result.replace(/^```\w*\s*\n?/, '').replace(/\n?```\s*$/, '');
  return result;
}
