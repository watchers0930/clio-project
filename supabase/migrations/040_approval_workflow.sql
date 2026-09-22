-- 전자결재 워크플로우: 결재 건(requests) + 단계(steps)
-- 결재선은 조직도(users.manager_user_id) 트리를 따라 신청자→직속상위→…로 자동 생성된다.

-- 문서(템플릿)별 결재 깊이: 담당 포함 총 결재 단계 수. 예: 휴가원=2(담당+1), 품의서=4(담당+3)
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS approval_depth int;
COMMENT ON COLUMN public.templates.approval_depth IS '결재 단계 수(담당 포함). 상신 시 신청자부터 직속상위 체인을 따라 이 수만큼 결재선 생성';

-- 결재 건
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  requester_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  current_step  int  NOT NULL DEFAULT 1,           -- 현재 결재 대기 단계(step_order)
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_approval_requests_doc ON public.approval_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requester ON public.approval_requests(requester_id);

-- 결재 단계(담당=신청자 포함)
CREATE TABLE IF NOT EXISTS public.approval_steps (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  step_order     int  NOT NULL,                    -- 1=담당(신청자), 2~=상위 결재자
  approver_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rank_title     text,                             -- 결재란 라벨 스냅샷(담당·팀장·이사 등)
  status         text NOT NULL DEFAULT 'waiting',  -- waiting | approved | rejected | delegated
  signature_path text,                             -- 승인 시점 서명 경로 스냅샷
  comment        text,                             -- 의견/반려 사유
  decided_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id, step_order)
);
CREATE INDEX IF NOT EXISTS idx_approval_steps_request ON public.approval_steps(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_approver ON public.approval_steps(approver_id, status);

-- RLS: 신청자·결재선상 결재자·admin만 접근. (cron/서버는 service_role로 우회)
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approval_requests_read" ON public.approval_requests
  FOR SELECT TO authenticated
  USING (
    requester_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.approval_steps s WHERE s.request_id = id AND s.approver_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "approval_steps_read" ON public.approval_steps
  FOR SELECT TO authenticated
  USING (
    approver_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.approval_requests r WHERE r.id = request_id AND r.requester_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
-- 쓰기(생성·상태변경)는 서버(service_role)에서만 수행하므로 authenticated용 write 정책은 두지 않는다.
