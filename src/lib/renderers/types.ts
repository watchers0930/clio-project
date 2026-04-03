/**
 * 멀티포맷 문서 생성 엔진 — 공통 타입
 */

export type OutputFormat = 'docx' | 'pdf' | 'hwpx' | 'xlsx' | 'pptx';

/** AI가 반환하는 XLSX 구조 (템플릿 없을 때) */
export interface ExcelSheet {
  sheetName: string;
  headers: string[];
  rows: (string | number)[][];
}

/** AI가 반환하는 XLSX 셀 데이터 (템플릿 있을 때) */
export type ExcelCellData = Record<string, Record<string, string | number>>;
// { "시트1": { "A1": "값", "B2": 123 }, "시트2": { ... } }

/** AI가 반환하는 PPTX 구조 (템플릿 없을 때) */
export interface PptxSlide {
  title: string;
  body?: string;
  bullets?: string[];
}

/** AI가 반환하는 PPTX 텍스트 치환 (템플릿 있을 때) */
export type PptxReplacement = Record<number, Record<string, string>>;
// { 1: { "기존텍스트": "새텍스트" }, 2: { ... } }

/** AI가 반환하는 DOCX 텍스트 치환 (템플릿 있을 때) */
export type DocxReplacement = Record<string, string>;
// { "기존 플레이스홀더": "새 텍스트", ... }

/** AI 생성 결과 — 포맷별 분기 */
export interface GenerationResult {
  format: OutputFormat;
  /** DOCX/PDF/HWPX용 마크다운 콘텐츠 */
  markdown?: string;
  /** DOCX용 텍스트 치환 (템플릿 있을 때) */
  docxReplacements?: DocxReplacement;
  /** XLSX용 시트 데이터 (템플릿 없을 때) */
  excelSheets?: ExcelSheet[];
  /** XLSX용 셀 데이터 (템플릿 있을 때) */
  excelCellData?: ExcelCellData;
  /** PPTX용 슬라이드 데이터 (템플릿 없을 때) */
  pptxSlides?: PptxSlide[];
  /** PPTX용 텍스트 치환 (템플릿 있을 때) */
  pptxReplacements?: PptxReplacement;
  /** 템플릿 바이너리 (렌더러에 전달) */
  templateBuffer?: Buffer;
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
