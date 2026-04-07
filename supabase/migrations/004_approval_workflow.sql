-- ============================================================================
-- CLIO: 결재 워크플로우 마이그레이션
-- approvals 테이블 생성 + RLS 정책
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.approvals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  requester_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  approver_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending',
  comment       text,
  requested_at  timestamptz NOT NULL DEFAULT now(),
  decided_at    timestamptz
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_approvals_document   ON public.approvals(document_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver   ON public.approvals(approver_id, status);
CREATE INDEX IF NOT EXISTS idx_approvals_requester  ON public.approvals(requester_id);

-- RLS 활성화
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

-- 조회: 요청자 또는 결재자
CREATE POLICY "approvals_select" ON public.approvals
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR approver_id = auth.uid());

-- 삽입: 요청자 본인
CREATE POLICY "approvals_insert" ON public.approvals
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

-- 수정: 결재자 본인
CREATE POLICY "approvals_update" ON public.approvals
  FOR UPDATE TO authenticated
  USING (approver_id = auth.uid())
  WITH CHECK (approver_id = auth.uid());
