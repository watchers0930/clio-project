-- Gmail 자동삭제 규칙
-- 이용자가 "확실한 광고"로 직접 등록한 발신자/키워드만 저장한다.
-- 하루 1회 cron이 이 규칙으로 Gmail을 검색해 매칭 메일을 휴지통으로 이동한다.
-- (수동 삭제 키워드는 브라우저 localStorage 즐겨찾기로 별개 — 이 테이블과 무관)
CREATE TABLE IF NOT EXISTS public.gmail_auto_delete_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Gmail 검색식 조각. 예: 'from:noreply@coupang.com', 'subject:광고'
  pattern        text NOT NULL,
  enabled        boolean NOT NULL DEFAULT true,
  last_run_at    timestamptz,           -- 마지막 자동삭제 실행 시각
  total_trashed  integer NOT NULL DEFAULT 0, -- 누적 휴지통 이동 건수
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- 같은 사용자가 동일 패턴을 중복 등록하지 못하게 막는다.
  UNIQUE(user_id, pattern)
);

ALTER TABLE public.gmail_auto_delete_rules ENABLE ROW LEVEL SECURITY;

-- 본인 규칙만 조회·생성·수정·삭제 가능 (cron은 service_role로 RLS 우회)
CREATE POLICY "gmail_auto_delete_rules_own" ON public.gmail_auto_delete_rules
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- cron이 활성 규칙을 사용자별로 훑을 때 사용
CREATE INDEX IF NOT EXISTS idx_gmail_auto_delete_rules_user
  ON public.gmail_auto_delete_rules(user_id);
