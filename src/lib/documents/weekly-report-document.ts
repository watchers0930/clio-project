import { parseEmbeddedInputs } from '@/lib/documents/embedded-inputs';
import { isWeeklyReportTemplateName } from '@/lib/templates/weekly-report';

/** 주간업무 양식에만 있는 입력값 키 — 양식명이 저장되기 전(v7.92 이전) 문서 판별용 */
const LEGACY_WEEKLY_INPUT_KEYS = ['work_rows', 'report_period'] as const;

/**
 * 주간업무 문서 여부(빌트인 양식 문서 전용).
 * 제목은 사용자가 바꾼 보고서 제목일 수 있으므로, 저장된 양식명(__template_name)을 최우선으로 쓰고
 * 양식명이 없는 옛 문서만 제목 또는 주간업무 고유 입력값으로 판별한다.
 */
export function isWeeklyReportDocument(doc: { title: string; content: string | null }): boolean {
  const parsed = parseEmbeddedInputs(doc.content ?? '');
  const templateName = parsed.ok ? parsed.inputs.__template_name : undefined;
  if (templateName?.trim()) return isWeeklyReportTemplateName(templateName);
  if (isWeeklyReportTemplateName(doc.title)) return true;
  return parsed.ok && LEGACY_WEEKLY_INPUT_KEYS.every((key) => key in parsed.inputs);
}

/** DB 1차 후보 필터(PostgREST or) — 최종 판정은 isWeeklyReportDocument로 한다 */
export const WEEKLY_REPORT_CANDIDATE_FILTER = 'title.ilike.%주간%업무%,content.ilike.%report_period%';
