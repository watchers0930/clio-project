# 메모 그래프 뷰 품질 개선 계획서 (memo-graph-polish)

- **프로젝트**: CLIO
- **대상 기능**: 메모 그래프 뷰 (v7.2.0)
- **작성일**: 2026-04-21
- **상태**: 계획 수립 (Plan)
- **연관 계획서**: `docs/01-plan/features/memo-graph.plan.md`

---

## 1. Overview (개요)

v7.2.0에서 Obsidian 스타일의 메모 그래프 뷰가 도입되었으나, 실사용 과정에서 치명적 버그 1건과 품질 이슈 4건이 확인되었다. 본 계획서는 해당 5개 항목을 한 차례의 정비 사이클로 해결하여 "실사용 가능한 완성도"에 도달시키는 것을 목표로 한다.

신규 기능 추가가 아닌 **기존 기능의 폴리싱(polish)** 에 집중한다. 그래프 데이터 모델·API·DB 스키마는 변경하지 않는다.

---

## 2. Goals (목표)

| # | 목표 | 핵심 지표 |
|---|-----|---------|
| G1 | 노드 클릭 시 발생하는 "화면 밖 튕김" 버그를 완전히 제거한다 | 100회 연속 클릭 시 모든 노드가 뷰포트 내 유지 |
| G2 | 우측 사이드패널의 가독성을 개선한다 | 패딩/행간 개선으로 첫 화면 정보 인지 시간 단축 |
| G3 | MemoViewModal을 MemoFormModal과 동일한 디자인 언어로 통일한다 | 두 모달 간 레이아웃·타이포·버튼 스타일 일치 |
| G4 | 노드와 라벨의 가독성을 확보한다 | 기본 줌 상태에서 라벨이 잘림/겹침 없이 보임 |
| G5 | 그래프 탭 미진입 시 그래프 API 호출을 차단한다 | 리스트 뷰만 사용하는 세션에서 `/api/memos/graph` 호출 0건 |

---

## 3. Scope (범위)

### In Scope
- `MemoGraphView.tsx` — 튕김 버그 수정, 노드/라벨 크기·색상 튜닝, 줌 컨트롤
- `MemoGraphSidePanel.tsx` — 패딩·마진·행간 재조정
- `memo-view-modal.tsx` — MemoFormModal의 레이아웃/타이포/버튼 스타일로 정렬
- `useMemoGraph.ts` — `enabled` 옵션 추가 (지연 실행)
- `memo-list.tsx` — 그래프 뷰 컴포넌트 lazy import 및 탭 활성화 시점까지 fetch 지연

### Out of Scope
- 그래프 데이터 스키마 변경
- 새로운 엣지 타입(관계) 추가
- 서버 측 그래프 API (`/api/memos/graph`) 로직 수정
- 메모 CRUD 정책 변경
- 3D 그래프·클러스터링 등 신규 기능

---

## 4. Requirements (개선 항목 상세)

### 4.1 [Must] 노드 클릭 시 튕김 버그 수정

- **What**: `MemoGraphView.tsx`에서 노드를 클릭했을 때 force simulation이 재가동되며 일부 노드가 뷰포트 밖으로 발사되는 현상을 제거한다.
- **Why**: 현재 최치명 이슈. 그래프 뷰 진입 직후 첫 클릭에서 발생하여 기능 전체의 신뢰를 떨어뜨린다. `onNodeClick`에서 `selected` state 변경 → 리렌더 → ForceGraph 재초기화 과정에서 초기 좌표가 소실되는 것으로 추정.
- **Expected Result**:
  - 클릭 시 선택 하이라이트만 갱신되고 노드 위치는 유지된다
  - simulation cooldown이 반복 재시작되지 않는다
  - 100회 연속 클릭 테스트에서 모든 노드가 뷰포트 내 유지
- **Approach (가설 · 검증 대상)**:
  - `cooldownTicks=0` 또는 이미 계산된 좌표(`fx`, `fy`) 고정 검토
  - 클릭 핸들러를 `useCallback`으로 안정화하고 그래프 인스턴스 ref 재생성 방지
  - `graphData` 객체 참조를 메모이즈하여 Force 내부 초기화 트리거 차단
- **수정 파일**: `src/components/memos/MemoGraphView.tsx`

### 4.2 [Must] 사이드패널 여백 개선

- **What**: 우측 `MemoGraphSidePanel`의 패딩을 기존 대비 확장하고, 섹션 간 여백과 본문 행간을 재조정한다.
- **Why**: 현재 좌우 패딩이 과소하여 제목·본문이 컨테이너 경계에 붙어 있어 스캔이 어렵다.
- **Expected Result**:
  - 좌우 패딩 `px-4 → px-6`, 섹션 간격 `gap-2 → gap-4` 수준으로 상향
  - 본문 `leading-relaxed` 적용
  - 스크롤 영역과 헤더 영역이 시각적으로 구분됨
- **수정 파일**: `src/components/memos/MemoGraphSidePanel.tsx`

### 4.3 [Must] MemoViewModal 스타일을 MemoFormModal과 통일

- **What**: 메모 보기 모달(`memo-view-modal.tsx`)의 헤더·본문·푸터 레이아웃, 타이포그래피, 버튼 스타일, 색상 토큰을 `memo-form-modal.tsx`와 동일한 체계로 맞춘다.
- **Why**: 동일한 "메모" 도메인 모달인데 두 모달의 디자인 언어가 달라 제품 일관성이 깨진다. 사용자가 보기↔편집을 전환할 때 레이아웃이 요동친다.
- **Expected Result**:
  - 모달 폭·둥근 모서리·그림자 토큰 일치
  - 제목 타이포, 태그/색상 표시 방식, 닫기 버튼 위치 일치
  - 편집 진입 시 레이아웃 점프 없음
- **수정 파일**: `src/components/memos/memo-view-modal.tsx`

### 4.4 [Should] 그래프 노드·라벨 가독성 개선

- **What**: 기본 노드 반지름을 상향, 라벨 폰트 크기·배경 처리 개선, 확대/축소 컨트롤(+, −, Fit) 추가.
- **Why**: 노드 수가 늘어날수록 현재 크기로는 구분이 어렵고 라벨이 겹친다. 사용자가 수동으로 스크롤·드래그로 맞추는 수고가 반복된다.
- **Expected Result**:
  - 기본 줌에서 노드와 라벨이 잘림/겹침 없이 보임
  - 우상단 또는 좌하단 오버레이로 +/−/Fit 버튼 제공
  - Fit 클릭 시 모든 노드가 뷰포트에 맞춰 정렬
- **수정 파일**: `src/components/memos/MemoGraphView.tsx`

### 4.5 [Should] 그래프 데이터 지연 로드

- **What**:
  - `useMemoGraph`에 `enabled: boolean` 옵션을 추가하여 `false`일 때 fetch를 보류
  - `memo-list.tsx`에서 그래프 뷰 컴포넌트를 `next/dynamic`으로 lazy import하고, 탭이 "graph"일 때만 `enabled=true`로 훅을 호출
- **Why**: 현재 리스트 뷰만 보는 사용자도 그래프 API가 호출되어 초기 페이지 응답 시간과 DB 부하가 증가한다. 5대 원칙 중 "성능" 항목과 직결.
- **Expected Result**:
  - 리스트 뷰 세션에서 `/api/memos/graph` 호출 0건 (Network 탭 기준)
  - 그래프 탭 최초 진입 시 1회 fetch, 이후 캐시 활용
  - 그래프 청크는 초기 번들에 포함되지 않음
- **수정 파일**:
  - `src/hooks/useMemoGraph.ts`
  - `src/components/memos/memo-list.tsx`

---

## 5. Priority (MoSCoW)

| 우선순위 | 항목 |
|--------|-----|
| Must | 4.1 튕김 버그 수정 |
| Must | 4.2 사이드패널 여백 |
| Must | 4.3 ViewModal 스타일 통일 |
| Should | 4.4 노드·라벨 가독성 + 줌 컨트롤 |
| Should | 4.5 그래프 API 지연 로드 |
| Could | (차기) 노드 드래그로 위치 고정 저장 |
| Won't | 3D 그래프, 클러스터링, 엣지 타입 추가 |

---

## 6. 수정 파일 요약

| 파일 | 변경 유형 | 관련 항목 |
|-----|---------|---------|
| `src/components/memos/MemoGraphView.tsx` | 버그 수정 + 비주얼 개선 + 줌 컨트롤 | 4.1, 4.4 |
| `src/components/memos/MemoGraphSidePanel.tsx` | 패딩·여백 개선 | 4.2 |
| `src/components/memos/memo-view-modal.tsx` | MemoFormModal 스타일로 통일 | 4.3 |
| `src/hooks/useMemoGraph.ts` | `enabled` 옵션 추가 | 4.5 |
| `src/components/memos/memo-list.tsx` | lazy import + 조건부 훅 호출 | 4.5 |

---

## 7. Acceptance Criteria (검증 기준)

각 항목은 **관찰 가능한 증거**로 판정한다.

### AC-1 튕김 버그 (4.1)
- [ ] 그래프 뷰 진입 후 임의의 노드를 연속 100회 클릭 시, 모든 노드가 뷰포트 내에 잔류한다
- [ ] 클릭 시 `ForceGraph`의 simulation alpha가 재부팅되지 않는다 (DevTools 로그로 확인)
- [ ] 선택 하이라이트 변경 외에 노드 좌표가 변하지 않는다

### AC-2 사이드패널 (4.2)
- [ ] 좌우 패딩이 기존 대비 최소 8px 이상 증가
- [ ] 섹션 간 간격이 일관된 토큰(`gap-4` 등)으로 통일
- [ ] 본문에 `leading-relaxed` 이상의 행간 적용

### AC-3 ViewModal 통일 (4.3)
- [ ] ViewModal과 FormModal의 폭·둥근 모서리·그림자가 동일 토큰 사용
- [ ] 제목 폰트 사이즈·웨이트가 동일
- [ ] "보기 → 편집" 전환 시 모달 크기/헤더 위치 점프 없음 (육안 확인)

### AC-4 노드·라벨 가독성 (4.4)
- [ ] 기본 줌 상태에서 라벨 겹침 없이 표시
- [ ] 줌 컨트롤(+, −, Fit) UI가 존재하고 모두 정상 동작
- [ ] Fit 클릭 시 모든 노드가 뷰포트에 맞춰 재배치

### AC-5 지연 로드 (4.5)
- [ ] 리스트 뷰만 사용하는 세션에서 Network 탭에 `/api/memos/graph` 호출이 0건
- [ ] 그래프 탭 최초 진입 시 1회 호출, 탭 재진입 시 재호출 없음(캐시 또는 staleTime)
- [ ] 초기 번들 analyze에서 `react-force-graph-2d`가 별도 청크로 분리됨

---

## 8. 5대 원칙 준수 체크리스트

| # | 원칙 | 본 계획 관련성 | 준수 전략 |
|---|-----|------------|---------|
| 1 | 페이지 500줄 제한 | `MemoGraphView.tsx`에 줌 컨트롤 추가로 줄 수 증가 예상 | 작성 후 줄 수 측정. 400줄 초과 시 `MemoGraphControls.tsx`(줌 UI), `useMemoGraphPainter.ts`(노드 렌더 로직)로 분리. 초과 감지 즉시 대장에게 보고 |
| 2 | 단일 책임 | UI(ForceGraph 렌더) + 상태(selected) + 상호작용(줌) 혼재 위험 | 줌 컨트롤은 하위 컴포넌트로 분리, fetch 로직은 `useMemoGraph`에 귀속, 렌더 함수는 순수 함수로 유지 |
| 3 | 서버 검증·보안 | 본 개선은 클라이언트 폴리싱이므로 서버 변경 없음 | `/api/memos/graph` 기존 인증/RLS 유지, 본 PR에서 서버 코드 수정하지 않음 |
| 4 | 성능 | 항목 4.5가 직접 기여(불필요 호출 제거, 번들 분할) | `enabled` 옵션으로 조건부 fetch, `next/dynamic`으로 청크 분리, `graphData` 메모이즈로 재렌더 최소화 |
| 5 | 폴더 구조 | 훅은 `hooks/`, UI는 `components/memos/`에 유지 | 신규 분리 파일도 동일 규칙 준수: `MemoGraphControls.tsx` → `components/memos/`, `useMemoGraphPainter.ts` → `hooks/` |

---

## 9. Timeline (예상 일정)

| 단계 | 항목 | 예상 소요 |
|-----|-----|---------|
| 1 | 4.1 버그 원인 재현·가설 검증 | 0.5일 |
| 2 | 4.1 수정 + 회귀 테스트 | 0.5일 |
| 3 | 4.4 노드·라벨 튜닝 + 줌 컨트롤 | 0.5일 |
| 4 | 4.2 사이드패널 / 4.3 ViewModal 통일 | 0.5일 |
| 5 | 4.5 지연 로드 + 번들 검증 | 0.5일 |
| 6 | 통합 QA + 완료 점검 보고서 | 0.5일 |
| **합계** | | **약 3일** |

---

## 10. Success Metrics (성공 지표)

- 그래프 뷰 관련 신규 버그 리포트 0건 (1주 모니터링)
- 리스트 뷰 세션의 `/api/memos/graph` 호출 0건
- 그래프 뷰 첫 페인트 시간 체감 단축 (lazy chunk 도입 효과)
- ViewModal ↔ FormModal 전환 시 레이아웃 점프 제거 (육안 QA)

---

## 11. Risks & Mitigation

| 위험 | 영향 | 완화 |
|-----|-----|-----|
| 4.1 수정이 force simulation 초기 레이아웃까지 멈춰버릴 수 있음 | 노드가 한 점에 뭉치는 현상 | 최초 1회는 simulation 동작, 이후 고정(`fx`/`fy`) 방식으로 이원화 |
| 줌 컨트롤 추가로 `MemoGraphView.tsx` 500줄 초과 위험 | 원칙 1 위반 | 사전 분리 플랜 확정 후 작업 (섹션 8 참조) |
| ViewModal 스타일 통일 과정에서 기존 호출부 props 파손 | 빌드 실패 | props 시그니처 유지, 내부 마크업만 교체 |
| `enabled=false` 상태에서 훅이 data undefined를 반환 | 그래프 탭 진입 시 깜빡임 | 로딩 스켈레톤/빈 상태 UI 유지, `enabled` 전환 시 즉시 fetch |

---

## 12. Approval (승인)

- [ ] CTO(대장) 검토
- [ ] Frontend Architect 설계 동의
- [ ] 작업 착수 승인

승인 이후 `frontend-architect`에게 구현을 이관한다. 구현 완료 시 **완료 점검 보고서**를 반드시 출력한 뒤 배포 여부를 판단한다.
