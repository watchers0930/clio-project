# 관리비 메뉴 설계 (2026-11-16)

## 목적
회사 관리비(전기·수도·가스·일반관리비 등)를 매달 손으로 입력하고, 항목·사용량·단가·합계를 월별·연도별로 확인한다.
시스템 관리자(`role='admin'`) 두 명(admin@clio.kr, ceo@clio.kr)이 **하나의 공용 장부**를 함께 보고 고친다.

## 목표 / 비목표
- 목표: 항목 등록, 월별 입력·수정·삭제, 월별 표(전월 대비), 연도별 표(항목 × 1~12월)
- 비목표: 고지서 파일 자동 인식, 엑셀 내보내기, 대량이체·고정지출과의 연동, 결재 연결
- 실패 기준(동작해도 실패): 관리자 아닌 계정이 메뉴·API·DB 직접 접근 중 하나로라도 데이터를 보거나 고칠 수 있음

## 결정 사항 (대장 확정)
- 입력: 손 입력
- 열람·수정: `role='admin'` 전원(현재 2명), 공용 장부
- 금액: 사용량 × 단가로 자동 계산, 고지서 금액으로 고쳐 쓸 수 있음
- 방식: A안 — 독립 메뉴 + 전용 테이블

## 방법 비교
| 안 | 내용 | 판정 |
|---|---|---|
| A | 독립 '관리비' 메뉴 + 전용 테이블 2개 | **채택** — 권한 범위·목적이 정확히 분리 |
| B | 대량이체 월지출(monthly_expenses)에 사용량·단가 추가 | 탈락 — 권한이 '관리자 또는 대표 직급', 작성자 본인 전용, 이체 예산과 목적 혼재 |
| C | 고정지출(fixed_expenses) 확장 | 탈락 — 연월 구분 없음 |

## 데이터 (마이그레이션 `056_maintenance_fees.sql`)
- `maintenance_fee_items` — 항목
  - id, name(공백 제거 후 중복 불가), unit(kWh·㎥ 등, 선택), default_unit_price(선택), sort_order, is_active(기본 true), created_by, created_at, updated_at
- `maintenance_fee_entries` — 월별 기록
  - id, item_id(→ items, 삭제 제한), month('YYYY-MM' 형식 검사), usage numeric(15,3) 선택, unit_price numeric(15,2) 선택, amount numeric(15,0) 필수, amount_overridden boolean, memo, created_by, updated_by, created_at, updated_at
  - (item_id, month) 유일 — 한 달에 한 항목은 한 줄
  - 인덱스: (month)
- updated_at 트리거: 기존 `handle_updated_at()` 사용
- 권한: RLS 켜고 **사용자 세션 정책 0개**(055와 같은 서버 전용 방식). 앱은 서버에서 관리자 확인 후 service role로만 접근 → Supabase REST 직접 접근 전면 차단
- 운영 적용: 대장이 SQL Editor에서 직접 실행, 적용 후 `pg_policies`·직접 REST 거부 확인

## 금액 규칙
- 사용량과 단가가 둘 다 있으면 금액 기본값 = 반올림(사용량 × 단가), 원 단위
- 사용자가 금액을 직접 고치면 `amount_overridden=true`, 이후 사용량·단가를 바꿔도 금액을 덮어쓰지 않음. 화면에 '직접 입력' 표시와 계산값 차이 표시
- 사용량 없는 항목(일반관리비 등)은 금액만 입력
- 음수 허용(정산 환급), 범위 검사는 서버에서 — 크로미 판단
- 서버가 단일 기준: 금액이 비어 오면 서버가 계산, 형식·범위·월 형식·항목 존재·활성 여부 서버 검증

## API (`app/api/maintenance-fees/`)
| 경로 | 메서드 | 가드 |
|---|---|---|
| `/items` | GET, POST | GET: 로그인+`requireAdmin` / POST: `withMutation`(CSRF·출처·활성)+`requireAdmin` |
| `/items/[id]` | PATCH, DELETE | `withMutation`+`requireAdmin` |
| `/entries?year=YYYY` 또는 `?month=YYYY-MM` | GET | 로그인+`requireAdmin` |
| `/entries` | POST | `withMutation`+`requireAdmin` |
| `/entries/[id]` | PATCH, DELETE | `withMutation`+`requireAdmin` |

- 조회는 연 단위 한 번(최대 항목 수 × 12줄)으로 월별·연도별 화면이 같이 씀 — 중복 호출 없음. 월별 표의 전월 대비가 1월이면 전년 12월만 추가 조회
- 항목 삭제: 기록이 있으면 409 + '숨기기'(is_active=false) 안내. 기록 없으면 삭제
- 같은 달·같은 항목 중복 저장 → 409
- 클라이언트 호출은 기존 `hooks/csrf-client.ts`의 `apiGet`/`apiMutate` 사용

## 화면 (`/maintenance-fees`)
- 사이드바: 관리자 전용 메뉴에 '관리비' 추가, **`role === 'admin'`일 때만** 노출(대표 직급만으로는 안 보임). 설정의 선택 메뉴 토글 대상 아님
- 탭 2개
  - 월별: 월 이동(◀ 2026년 11월 ▶), 표 = 항목 / 사용량(단위) / 단가 / 금액 / 전월 대비 / 메모, 맨 아래 합계. '입력' 버튼 → 입력창(항목 선택 시 단위·기본 단가 자동 채움, 금액 자동 계산·수정 가능). 줄 클릭 → 수정·삭제
  - 연도별: 연도 이동, 표 = 항목 × 1~12월 금액 + 연간 사용량 합계 + 평균 단가(금액 합 ÷ 사용량 합) + 연 합계, 맨 아래 월별 총액·연 총액 — 연간 열 구성은 크로미 판단
  - 항목 관리: 입력창 안 '항목 관리'에서 추가·수정·숨기기
- 403이면 '권한이 없습니다' 화면
- 숫자 입력·천 단위 표시, 확인창(`use-confirm-dialog`), 간격(gap/padding)은 기존 대량이체 화면 표준을 따름

## 파일 구성 (각 300줄 미만 목표)
- `app/(app)/maintenance-fees/page.tsx` — 껍데기
- `components/maintenance-fees/` — `maintenance-fees-view.tsx`(탭), `monthly-fee-table.tsx`, `yearly-fee-table.tsx`, `fee-entry-modal.tsx`, `fee-item-manager.tsx`
- `hooks/use-maintenance-fees.ts` — 조회·변이 상태
- `lib/maintenance-fees/` — `types.ts`, `calc.ts`(금액 계산·월별/연도별 집계·전월 대비), `validate.ts`(서버 입력 검증), `map.ts`
- 테스트: `lib/maintenance-fees/calc.test.ts`, `validate.test.ts`

## 검증
- 단위 테스트: 계산(반올림·직접 입력 유지·사용량 없음·음수), 집계(빈 달·숨긴 항목), 검증(월 형식·범위·문자열 숫자)
- 운영 화면(admin 계정): 항목 추가 → 입력 → 월별·연도별 표 → 금액 직접 수정 → 삭제, 테스트 데이터는 새로 만든 것만 정리
- 차단: 관리자 아닌 계정 메뉴 숨김, API 직접 호출 403, 사용자 세션 REST 직접 조회·쓰기 거부
- 독립 리뷰 에이전트 적대 검토(백엔드·프론트)

## 버전
v7.97.0 (중간 기능)

## 범위 밖 발견 (기록만)
- 대량이체 API 전체에 CSRF 확인 없음(`app/api/bulk-transfer/**`)
