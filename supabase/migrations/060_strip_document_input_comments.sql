-- 060: 문서 입력값 분리 2단계 — 기존 본문 맨 앞의 입력값 주석 제거(입력값은 059 의 input_values 칸에 있음)
--
-- 선행: v7.98.1 코드 배포(저장 시 본문·칸 분리, 화면 응답 시 칸→주석 합성, 결재·주간업무 판별은 칸 기준).
--       이 코드는 주석이 있든 없든 동작하므로 코드를 먼저 배포하고 이 마이그레이션을 적용한다.
-- 안전장치:
--   - 칸 값과 주석 값이 정확히 같은 문서만 주석을 지운다(다르거나 칸이 비면 그대로 둠 → 입력값 유실 없음).
--   - 휴가원 잠금(047/059)은 잠긴 휴가원의 본문 변경을 막으므로, 이 작업 동안만 끄고 같은 트랜잭션 안에서 다시 켠다.
--     (결재 상태 보호 트리거 052 는 auth.uid() 가 없는 마이그레이션은 통과시킨다)
-- 되돌리기: 주석은 칸 값에서 그대로 복원된다 —
--   update public.documents set content = '<!--DOCUMENT_INPUTS:' || replace(input_values::text, '-->', '-->') || '-->' || chr(10) || content
--   where input_values is not null and content !~ '^<!--(DOCUMENT_INPUTS|PROPOSAL_INPUTS):';
--   (잠긴 휴가원 때문에 위와 같이 trg_leave_document_lock 을 잠시 끄고 실행)
begin;

alter table public.documents disable trigger trg_leave_document_lock;

update public.documents
set content = regexp_replace(content, '^<!--(DOCUMENT_INPUTS|PROPOSAL_INPUTS):[^\n]*-->\r?\n?', '')
where input_values is not null
  and public.parse_document_inputs(content) = input_values;

alter table public.documents enable trigger trg_leave_document_lock;

commit;
