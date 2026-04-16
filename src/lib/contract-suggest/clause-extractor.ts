/**
 * 파일 타입별 텍스트 추출
 * 기존 lib/ai/extract-text.ts를 래핑하여 계약서 분석 컨텍스트에서 재사용
 */

import type { ContractRiskAnalysis } from '@/lib/types/contract-risk';

/**
 * 분석 레코드와 선택적 파일 버퍼로부터 텍스트를 반환한다.
 * raw_text가 DB에 저장돼 있으면 재추출을 생략한다.
 */
export async function extractTextFromAnalysis(
  analysis: ContractRiskAnalysis,
  fileBuffer?: ArrayBuffer,
): Promise<string> {
  if (analysis.raw_text) return analysis.raw_text;
  if (!fileBuffer) throw new Error('파일 버퍼가 필요합니다.');

  const { extractText } = await import('@/lib/ai/extract-text');
  const mimeMap: Record<string, string> = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    hwpx: 'application/hwp+zip',
    pdf: 'application/pdf',
  };
  const mime = mimeMap[analysis.file_type] ?? 'application/octet-stream';
  return extractText(fileBuffer, mime, analysis.file_name);
}
