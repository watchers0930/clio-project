-- Gmail 연동 권한 범위 저장
-- gmail.modify(휴지통 이동=삭제 가능) 재동의 여부를 판별하기 위해 granted scope를 보관한다.
-- 기존 연결(readonly만 동의)은 scope가 NULL → UI에서 "재연결(삭제 권한 추가)"을 유도한다.
ALTER TABLE public.user_google_connections
  ADD COLUMN IF NOT EXISTS scope text;
