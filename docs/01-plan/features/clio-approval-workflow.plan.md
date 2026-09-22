# CLIO 계층형 순차 전자결재 시스템 — 구현 계획서

**작성일:** 2026-09-22
**대상:** CLIO (`/Users/watchers/Desktop/clio-project`)
**배포:** https://clioai.vercel.app
**설계 승인:** 대장 확정 (전결=이사급 이상, 직위=대표·이사·팀장·사원)

---

## 1. 핵심 원칙

1. **실체 있는 서명** — 결재자가 앱에서 직접 "승인"을 눌러야 그 칸에 본인 서명이 삽입된다. 상신 시점에 상사 서명이 미리 찍히지 않는다(서명 도용 방지).
2. **자동 결재 경로** — 조직 트리로 결재선이 자동 결정된다. 매번 결재자를 손으로 고르지 않는다.

## 2. 조직도 (트리 구조)

- 단순 레벨 숫자가 아니라 **트리**로 구성 — 각 사용자에게 직속 상위자를 지정해 "내 바로 위 사람"이 정확히 하나로 결정.
- **직위 체계(확정):** 대표(rank_level 1) → 이사(2) → 팀장(3) → 사원(4).
- admin이 조직도 관리 화면에서 각 사용자의 직속 상위자·직위를 설정.
- 초기값 참고(현 사용자): ceo@clio.kr 김동의=대표, vice-ceo@clio.kr 정순규=이사, rnd@clio.kr 신은수=팀장, dev01@clio.kr 박세영=사원. (admin@clio.kr은 시스템 관리자, 조직도상 대표 상위 or 별도)

## 3. 문서별 결재 깊이

- 문서(템플릿)마다 최종 결재 단계를 지정(`templates.approval_depth`).
- 상신 시 신청자로부터 지정 깊이까지만 결재선 자동 생성.
- 예: 휴가원=팀장까지(2단), 지출 품의=대표까지(4단), 일반 보고=이사까지(3단).
- 상신 화면에서 결재선을 미리 보고 확인.

## 4. 결재 흐름

작성 → 상신(결재선 자동 생성 + 첫 결재자 알림) → 단계별 결재 → 완료.

각 결재자의 선택지:
- **승인**: 본인 서명 결재란 삽입, 다음 상위 결재자에게 전이 + 알림.
- **반려**: 사유와 함께 신청자에게 회수. 수정 후 재상신 가능.
- **전결**: 이 단계에서 결재 종결. 남은 상위 단계 전부 생략, 문서 즉시 완료. 결재란에 서명 + "전결" 표기, 생략 칸은 공란(—).

## 5. 전결 권한 (확정)

- **이사급 이상만 전결 가능** = `rank_level <= 2` (대표·이사). 팀장·사원은 승인/반려만.
- 서버에서 전결 권한 검증(클라이언트 신뢰 금지).

## 6. DB 스키마

기존 `users`·`documents`·`templates`·알림 시스템 재사용 + 추가.

### users (컬럼 추가)
- `manager_user_id uuid null` — 직속 상위자(트리 부모, self FK)
- `rank_level int null` — 직위 레벨(1 대표 … 4 사원)
- `rank_title text null` — 직위 표시명(결재란 라벨)

### templates (컬럼 추가)
- `approval_depth int null` — 결재 깊이(최종 단계/직위)

### approval_requests (신규)
- `id uuid pk`, `document_id uuid`, `requester_id uuid`, `status text`(pending/approved/rejected), `current_step int`, `created_at`, `completed_at`
- RLS: 신청자·결재선상 결재자·admin만 조회

### approval_steps (신규)
- `id uuid pk`, `request_id uuid`, `step_order int`(1=담당 … n), `approver_id uuid`, `status text`(waiting/approved/rejected/delegated), `signed_at`, `comment text`, `signature_path text`(승인 시점 서명 스냅샷 경로)
- RLS: 해당 결재자·신청자·admin

## 7. 화면

- **조직도 관리**(admin, 설정>조직도): 사용자별 직속 상위자·직위 설정, 트리 미리보기
- **상신 화면**: 결재선 자동 미리보기 확인 후 "결재 올리기"
- **결재함**: 내가 결재할 문서 목록 + 승인/반려/전결 처리
- **결재 진행 현황**: 문서별 결재 단계·상태 타임라인(신청자 추적)

## 8. 결재란 렌더링

- 문서 상단 우측 결재 박스, **결재 단계 수만큼 칸 동적 생성**.
- 각 칸: 직위 라벨 + 결재자명 + [승인=서명이미지 / 전결=서명+"전결" / 대기·생략=공란].
- **휴가원부터 적용**(기존 leave-application 결재란을 동적 결재란으로 전환), 이후 타 문서 확장.

## 9. 구현 순서 (Phase)

- **P1 조직도**: users 3필드 마이그레이션 + admin 조직도 관리 화면 + 트리/사이클 검증
- **P2 결재 엔진·상신**: approval_requests/steps 마이그레이션 + 상신 시 결재선 자동 생성(직속상위→깊이까지) + templates.approval_depth 설정 UI
- **P3 결재함·처리**: 승인/반려/전결 API + 단계 전이 로직 + 전결 권한 검증 + 인앱 알림(기존 notifications 재사용)
- **P4 결재란 렌더·서명**: 결재 단계 수만큼 동적 결재란 + 승인 시 서명 삽입, 휴가원 먼저 적용
- **P5 진행현황·검증**: 결재 타임라인 화면 + 권한/RLS 전수 점검 + 견고성 검증 + 운영 반영

## 10. 재사용 자산

- 알림: 기존 `notifications` 테이블 + NotificationToaster (결재 요청/승인/반려 알림)
- 서명: `signatures/{userId}/signature.png` + `signatureBufferToDataUrl`
- 문서: `documents` + generate/download 렌더 파이프라인
- 권한: `lib/permissions` (admin 판정), 조직도 트리는 신규

## 11. 주의 (견고성)

- 결재선 생성 시 **사이클 방지**(트리 무결성), 직속상위 누락 시 처리
- 전결/반려 후 **재상신 시 이전 결재 이력 처리**(새 request 생성, 이력 보존)
- 동시 결재/중복 승인 방지(current_step 원자적 전이)
- 서버 권한 검증: 결재 대상자 본인만 처리(IDOR), 전결 권한(rank_level)
- 문서별 결재란 동적 생성이 PDF/DOCX 렌더러와 호환되는지 검증
