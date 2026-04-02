/**
 * 멀티포맷 문서 렌더러 — 통합 인덱스
 * AI 콘텐츠 생성 결과 → 파일 렌더링 분기
 */

export { renderDocx } from './docx-renderer';
export { renderXlsx } from './xlsx-renderer';
export { renderPptx } from './pptx-renderer';
export { renderHwpx } from './hwpx-renderer';
export { renderPdf } from './pdf-renderer';
export type {
  OutputFormat,
  ExcelSheet,
  PptxSlide,
  GenerationResult,
  RenderOutput,
  CorporateTheme,
} from './types';
export { DEFAULT_THEME } from './types';

import type { GenerationResult, RenderOutput, CorporateTheme } from './types';
import { DEFAULT_THEME } from './types';
import { renderDocx } from './docx-renderer';
import { renderXlsx } from './xlsx-renderer';
import { renderPptx } from './pptx-renderer';
import { renderHwpx } from './hwpx-renderer';
import { renderPdf } from './pdf-renderer';

/**
 * 통합 렌더러 — GenerationResult를 받아 파일 Buffer 반환
 */
export async function renderDocument(
  result: GenerationResult,
  theme: CorporateTheme = DEFAULT_THEME,
): Promise<RenderOutput> {
  switch (result.format) {
    case 'docx':
      if (!result.markdown) throw new Error('DOCX 렌더링에 마크다운 콘텐츠가 필요합니다.');
      return renderDocx(result.markdown, result.title, theme);

    case 'xlsx':
      if (!result.excelSheets?.length) throw new Error('XLSX 렌더링에 시트 데이터가 필요합니다.');
      return renderXlsx(result.excelSheets, result.title, theme);

    case 'pptx':
      if (!result.pptxSlides?.length) throw new Error('PPTX 렌더링에 슬라이드 데이터가 필요합니다.');
      return renderPptx(result.pptxSlides, result.title, theme);

    case 'hwpx':
      if (!result.markdown) throw new Error('HWPX 렌더링에 마크다운 콘텐츠가 필요합니다.');
      return renderHwpx(result.markdown, result.title, theme);

    case 'pdf':
      if (!result.markdown) throw new Error('PDF 렌더링에 마크다운 콘텐츠가 필요합니다.');
      return renderPdf(result.markdown, result.title, theme);

    default:
      throw new Error(`지원하지 않는 출력 포맷: ${result.format}`);
  }
}
