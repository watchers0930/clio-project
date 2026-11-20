// 문서 다운로드 형식 결정 — 다운로드 라우트의 단일 규칙.
// 형식을 지정하지 않은 요청(문서 상세·버전 목록·검색 결과)은 문서가 만들어진 형식(output_format)을 따른다.
// 이전엔 docx 로 고정돼 PDF 로 만든 문서가 생성 당시 저장 파일을 그대로 받았다(폰트 수정 전 파일은 한글이 비어 보임).

const DOWNLOAD_FORMATS = ['pdf', 'docx', 'hwpx', 'xlsx', 'pptx'] as const;
export type DownloadFormat = (typeof DOWNLOAD_FORMATS)[number];

function isDownloadFormat(value: string | null | undefined): value is DownloadFormat {
  return !!value && (DOWNLOAD_FORMATS as readonly string[]).includes(value);
}

export function resolveDownloadFormat(requested: string | null | undefined, outputFormat: string | null | undefined): DownloadFormat {
  if (isDownloadFormat(requested)) return requested;
  if (isDownloadFormat(outputFormat)) return outputFormat;
  return 'docx';
}
