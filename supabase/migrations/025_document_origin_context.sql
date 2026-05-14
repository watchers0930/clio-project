ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS origin_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin_context TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_origin_document_id ON public.documents(origin_document_id);

COMMENT ON COLUMN public.documents.origin_document_id IS '버전(parent_id)과 별도로 회의록/보고서/후속 문서가 참조한 원본 문서 ID';
COMMENT ON COLUMN public.documents.origin_context IS 'origin 문서와의 관계 유형(meeting_minutes, meeting_followup, report_update, report_draft, shared_followup 등)';
