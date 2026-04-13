-- ============================================================
-- 014_files_scope.sql
-- files 테이블에 공개 범위(scope) 컬럼 추가
-- scope: 'company' = 전사 공개, 'department' = 부서 공유
-- ============================================================

-- 1. 컬럼 추가
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'department'
    CHECK (scope IN ('company', 'department'));

-- 2. 기존 RLS select 정책 교체
DROP POLICY IF EXISTS "files_select" ON public.files;

CREATE POLICY "files_select"
  ON public.files FOR SELECT
  TO authenticated
  USING (
    scope = 'company'                          -- 전사 공개: 모든 로그인 사용자
    OR uploaded_by = auth.uid()                -- 본인 업로드
    OR department_id IN (
      SELECT department_id FROM public.users WHERE id = auth.uid()
    )                                          -- 같은 부서
  );

-- 3. scope 수정: 본인만 가능 (update 정책은 기존 유지, scope 컬럼도 포함됨)
-- 기존 files_update 정책이 uploaded_by = auth.uid() 조건이므로 별도 추가 불필요
