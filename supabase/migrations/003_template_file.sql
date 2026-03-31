-- 템플릿에 표준양식 파일 첨부 기능
ALTER TABLE templates ADD COLUMN IF NOT EXISTS template_file_id uuid REFERENCES files(id) ON DELETE SET NULL;
