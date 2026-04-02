/**
 * 멀티포맷 문서 렌더러 — 통합 인덱스
 * AI 콘텐츠 생성 결과 → 파일 렌더링 분기
 * 템플릿 있으면 → 템플릿 기반 렌더링, 없으면 → 새로 생성
 */

export { renderDocx } from './docx-renderer';
export { renderXlsx, renderXlsxFromTemplate } from './xlsx-renderer';
export { renderPptx, renderPptxFromTemplate } from './pptx-renderer';
export { renderHwpx } from './hwpx-renderer';
export { renderPdf } from './pdf-renderer';
export type {
  OutputFormat,
  ExcelSheet,
  ExcelCellData,
  PptxSlide,
  PptxReplacement,
  GenerationResult,
  RenderOutput,
  CorporateTheme,
} from './types';
export { DEFAULT_THEME } from './types';

import type { GenerationResult, RenderOutput, CorporateTheme } from './types';
import { DEFAULT_THEME } from './types';
import { renderDocx } from './docx-renderer';
import { renderXlsx, renderXlsxFromTemplate } from './xlsx-renderer';
import { renderPptx, renderPptxFromTemplate } from './pptx-renderer';
import { renderHwpx } from './hwpx-renderer';
import { renderPdf } from './pdf-renderer';

/**
 * 통합 렌더러 — GenerationResult를 받아 파일 Buffer 반환
 * templateBuffer가 있으면 템플릿 기반, 없으면 새로 생성
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
      // 템플릿 기반: 기존 파일 로드 → 셀 값 주입
      if (result.templateBuffer && result.excelCellData) {
        return renderXlsxFromTemplate(result.templateBuffer, result.excelCellData, result.title);
      }
      // 새로 생성
      if (!result.excelSheets?.length) throw new Error('XLSX 렌더링에 시트 데이터가 필요합니다.');
      return renderXlsx(result.excelSheets, result.title, theme);

    case 'pptx':
      // 템플릿 기반: 기존 파일 로드 → 텍스트 치환
      if (result.templateBuffer && result.pptxReplacements) {
        return renderPptxFromTemplate(result.templateBuffer, result.pptxReplacements, result.title);
      }
      // 새로 생성
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
