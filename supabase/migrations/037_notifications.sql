-- ============================================================
-- Migration 037: 인앱 알림(notifications) 시스템
-- ------------------------------------------------------------
-- 문서 댓글 / 채팅 신청 등 이벤트 발생 시 수신자에게 전달되는 알림.
-- 클라이언트는 Supabase Realtime(postgres_changes)로 본인 알림 INSERT를
-- 구독하여 슬라이드 알림을 띄운다. RLS로 본인 알림만 조회 가능하며,
-- 생성은 서버(service_role)만 수행한다(authenticated INSERT 정책 없음).
--
-- 멱등·비파괴로 작성(DROP 없이 존재검사 후 생성) → 재실행 안전, Supabase
-- SQL Editor의 destructive-operation 경고 없이 실행된다.
-- 2026-09-17 운영 DB(cxsaohiwkeebgshxcypa) 적용·검증 완료
-- (table_exists=1, policy_count=2, in_realtime=1).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  type         TEXT NOT NULL,                 -- 'document_comment' | 'chat_request'
  title        TEXT NOT NULL,
  body         TEXT,
  link         TEXT,                          -- 클릭 시 이동 경로
  is_read      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON public.notifications(recipient_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- 본인 알림만 조회
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_select') THEN
    CREATE POLICY notifications_select ON public.notifications
      FOR SELECT TO authenticated USING (recipient_id = auth.uid());
  END IF;

  -- 본인 알림만 갱신(읽음 처리). 생성은 service_role 전용(정책 없음 = authenticated 차단).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_update') THEN
    CREATE POLICY notifications_update ON public.notifications
      FOR UPDATE TO authenticated USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());
  END IF;

  -- Realtime publication 등록 (중복 방지 가드)
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
