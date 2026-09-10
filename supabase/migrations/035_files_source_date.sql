-- files.source_date: 외부 소스(Gmail 등)의 실제 원본 날짜(이메일 발송 시각).
-- 검색 결과에 동기화 시각(created_at)이 아니라 실제 발송일을 표시하기 위함.
-- 업로드 파일 등 원본 날짜가 없는 경우 NULL → 조회 시 created_at으로 폴백.
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS source_date timestamptz;

CREATE INDEX IF NOT EXISTS idx_files_source_date ON public.files(source_date);
