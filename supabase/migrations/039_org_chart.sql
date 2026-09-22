-- 조직도(전자결재용): 각 사용자의 직속 상위자·직위
-- 결재선은 이 트리를 따라 신청자 → 직속 상위 → ... 순으로 자동 생성된다.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS manager_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- 직위 레벨: 1=대표, 2=이사, 3=팀장, 4=사원 (숫자가 작을수록 상위). 전결 권한 판정에도 사용(<=2 전결 가능)
  ADD COLUMN IF NOT EXISTS rank_level int,
  -- 직위 표시명(결재란 라벨): 대표·이사·팀장·사원 등
  ADD COLUMN IF NOT EXISTS rank_title text;

-- 결재선 생성 시 직속 상위 조회에 사용
CREATE INDEX IF NOT EXISTS idx_users_manager ON public.users(manager_user_id);

COMMENT ON COLUMN public.users.manager_user_id IS '직속 상위자(조직 트리 부모) — 결재선 자동 생성 기준';
COMMENT ON COLUMN public.users.rank_level IS '직위 레벨 1=대표 2=이사 3=팀장 4=사원 (전결권: <=2)';
COMMENT ON COLUMN public.users.rank_title IS '직위 표시명(결재란 라벨)';
