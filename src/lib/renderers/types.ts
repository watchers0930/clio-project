/**
 * 멀티포맷 문서 생성 엔진 — 공통 타입
 */

export type OutputFormat = 'docx' | 'pdf' | 'hwpx' | 'xlsx' | 'pptx';

/** AI가 반환하는 XLSX 구조 */
export interface ExcelSheet {
  sheetName: string;
  headers: string[];
  rows: (string | number)[][];
}

/** AI가 반환하는 PPTX 구조 */
export interface PptxSlide {
  title: string;
  body?: string;
  bullets?: string[];
}

/** AI 생성 결과 — 포맷별 분기 */
export interface GenerationResult {
  format: OutputFormat;
  /** DOCX/PDF/HWPX용 마크다운 콘텐츠 */
  markdown?: string;
  /** XLSX용 시트 데이터 */
  excelSheets?: ExcelSheet[];
  /** PPTX용 슬라이드 데이터 */
  pptxSlides?: PptxSlide[];
  /** 문서 제목 */
  title: string;
}

/** 렌더러 출력 */
export interface RenderOutput {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  fileName: string;
}

/** 기업 테마 설정 */
export interface CorporateTheme {
  primaryColor: string;
  fontFamily: string;
  fontFamilyEn: string;
  fontSize: number;
}

export const DEFAULT_THEME: CorporateTheme = {
  primaryColor: '2E6FF2',
  fontFamily: '맑은 고딕',
  fontFamilyEn: 'Malgun Gothic',
  fontSize: 12,
};
