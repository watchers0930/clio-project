# CLIO 메모 시스템 고도화 — 설계-구현 GAP 분석서

> **분석 대상**: `docs/02-design/features/clio.design.md` vs. 실제 구현 코드
> **분석일**: 2026-04-21
> **버전 기준**: v7.4.0
> **분석자**: 크로미

---

## 1. Match Rate (일치율)

| Phase | 항목 | 일치율 | 비고 |
|-------|------|--------|------|
| Phase 1 | UI 기반 강화 (card·list·page) | 90% | 카드 Paperlogy 폰트 미적용 |
| Phase 2 | 그래프 + AI 아이디어 워크플로우 | 80% | clusters API 호출 미연결, 상태 위치 불일치 |
| Phase 3 | 할일 연결 (모달) | 90% | 버튼 구조 소폭 불일치 |
| Phase 4 | 문서 생성 출력 연결 | 20% | 설계 자체가 "추후 구현" 명시. stub 상태 |
| **전체** | | **~80%** | |

---

## 2. Gap 목록

### GAP-1 ★ HIGH — clusters API 호출 코드 미구현

**설계 (5절, 6-5절)**:
> 클러스터 탐지 후 `/api/memos/graph/clusters` 호출 → AI 생성 클러스터명을 헐 중심에 표시

**현실**:
- `detectClusters()` 함수: ✅ 구현됨 (`MemoGraphView.tsx:28~58`)
- `convexHull` + 헐 렌더링: ✅ 구현됨 (`MemoGraphView.tsx:64~277`)
- `cluster.name` 처리 코드: ✅ 존재함 (`MemoGraphView.tsx:269`)
- **BUT**: API를 실제로 호출하는 코드 없음 → `cluster.name`이 항상 `undefined` → 클러스터명 표시 안 됨

**영향**: 헐(hull)은 그려지나 AI 생성 클러스터명이 나타나지 않음.

**수정**: `MemoGraphView.tsx`에 `useEffect(() => { fetchClusterNames(clusters) }, [clusters])` 추가 (~30줄).

---

### GAP-2 ★ MEDIUM — page.tsx 상태 구조 불일치

**설계 (2-2절)**:
```typescript
// page.tsx에서 관리
viewMode: 'list' | 'graph'
selectedMemoIds: Set<string>
ideaPanelOpen: boolean
```

**현실**:
| 상태 | 설계 위치 | 실제 위치 |
|------|----------|----------|
| `viewMode` (→ `tab`) | `page.tsx` | `memo-list.tsx:36` |
| `selectedIds` | `page.tsx` | `MemoGraphView.tsx:103` |
| `ideaPanelOpen` | `page.tsx` | `MemoGraphView.tsx:108` |

설계 9단계 "page.tsx에 selectedMemoIds·ideaPanelOpen 연결"이 실행되지 않음.

**영향**: 기능은 정상 동작하나, 설계가 의도한 "page.tsx = 상태 조율 허브" 원칙에서 이탈. 향후 다른 탭(목록 탭)에서 그래프 멀티셀렉트 상태를 활용해야 할 경우 구조 변경 필요.

---

### GAP-3 ★ MEDIUM — memo-idea-panel API 직접 호출 (단일 책임 경미 위반)

**설계 (2-3절)**:
> `page.tsx`: 책임 = "API 호출, 핸들러 조립"
> `memo-idea-panel.tsx`: 책임 = "SSE 표시, 액션 버튼", 금지 = "그래프 상태 참조"

**현실**:
`memo-idea-panel.tsx`가 다음 API를 직접 호출:
- `POST /api/memos` (메모 저장, `memo-idea-panel.tsx:47`)
- `POST /api/todos/from-idea` (할일 추출, `memo-idea-panel.tsx:69`)

설계가 이를 명시적으로 "금지"하지는 않았으나(금지 항목은 "그래프 상태 참조" 뿐), 설계 원칙상 `page.tsx`가 핸들러를 props로 내려주는 구조가 맞음.

**영향**: 기능 이상 없음. 다만 `memo-idea-panel`의 테스트 가능성이 저하되고, API 로직이 컴포넌트에 혼재됨.

---

### GAP-4 LOW — memo-todo-confirm-modal 버튼 구조 불일치

**설계 (6-4절) 와이어프레임**:
```
[취소]  [할일로 등록]
```

**현실 (`memo-todo-confirm-modal.tsx:81~87`)**:
```
[확인]
```

`POST /api/todos/from-idea`는 **이미 DB 저장 완료** 후 모달을 띄우는 구조이므로, `[확인]`만 두는 것이 기능적으로는 맞음. 다만 설계 와이어프레임과 다름.

---

### GAP-5 LOW — 클러스터 헐 알파 미세 차이

| | 설계 (5-2절) | 현실 (`MemoGraphView.tsx:84`) |
|--|--|--|
| 헐 알파 | `0.08` | `0.09` |

기능 및 UX에 무의미한 차이.

---

### GAP-6 LOW — memo-card.tsx Paperlogy 폰트 미적용

**설계 (6-5절)**: "제목 폰트 → Paperlogy 또는 Pretendard (CSS 변수 활용)"

**현실**:
- 그래프 캔버스 노드 라벨: `"Paperlogy", "Noto Sans KR"` ✅ (`MemoGraphView.tsx:211`)
- 카드 제목: `font-semibold` (시스템 폰트, Paperlogy 클래스 없음)

---

### GAP-7 INFO — Phase 4 문서 생성 stub

**설계 (1-2절)**: "Phase 4 — 아이디어 → POST /api/generate 출력 연결 (Medium)"

**현실 (`memo-idea-panel.tsx:172~179`)**: 버튼 존재하나 `disabled={true}`, title="Phase 4 — 추후 지원"

설계 자체가 "별도 기획 확정 후" 로 명시했으므로 정상 처리.

---

## 3. 플랫폼 절대규칙 위반 점검

### 3-1. 500줄 초과 파일 점검

| 파일 | 줄 수 | 상태 |
|------|-------|------|
| `src/app/(app)/memos/page.tsx` | 144줄 | ✅ |
| `src/components/memos/MemoGraphView.tsx` | **429줄** | ✅ (주의: 클러스터 API 추가 시 초과 가능) |
| `src/components/memos/memo-list.tsx` | 145줄 | ✅ |
| `src/components/memos/memo-card.tsx` | 109줄 | ✅ |
| `src/components/memos/memo-idea-panel.tsx` | 194줄 | ✅ |
| `src/components/memos/memo-todo-confirm-modal.tsx` | 92줄 | ✅ |
| `src/components/memos/memo-graph-controls.tsx` | 33줄 | ✅ |
| `src/hooks/useMemoIdea.ts` | 85줄 | ✅ |
| `src/types/memo-graph.ts` | 45줄 | ✅ |
| `src/app/api/memos/graph/route.ts` | 164줄 | ✅ |
| `src/app/api/memos/idea/route.ts` | 118줄 | ✅ |
| `src/app/api/memos/graph/clusters/route.ts` | 96줄 | ✅ |
| `src/app/api/todos/from-idea/route.ts` | 93줄 | ✅ |

> ⚠️ `MemoGraphView.tsx` 429줄 — GAP-1 클러스터 API 호출 코드 추가 시 500줄 초과 가능. 설계서에서 예고한 대로 `cluster-hull-utils.ts` 또는 `useMemoCluster.ts` 분리 검토 필요.

---

### 3-2. 단일 책임 위반

| 파일 | 위반 내용 | 심각도 |
|------|----------|--------|
| `memo-idea-panel.tsx` | SSE 표시 역할 + API 직접 호출(memos POST, todos/from-idea POST) 혼재 | 경미 |
| `memo-list.tsx` | 목록 UI + tab 상태 관리 + useMemoGraph 훅 호출 | 경미 |

두 파일 모두 기능적 동작에는 문제가 없으며, 설계가 허용한 범위를 약간 벗어난 수준.

---

### 3-3. 서버 검증 누락 API

| 엔드포인트 | 인증 | 소유권 검증 | 입력 검증 | 판정 |
|-----------|------|-----------|----------|------|
| `GET /api/memos/graph` | ✅ `getAuthUserId` | ✅ `eq('created_by', authUserId)` | N/A | ✅ |
| `POST /api/memos/idea` | ✅ `getAuthUserId` | ✅ `filter(m.created_by === authUserId)` + length < 2 → 403 | ✅ `memoIds.length < 2` → 400 | ✅ |
| `POST /api/memos/graph/clusters` | ✅ `getAuthUserId` | ✅ `m.created_by === authUserId` 필터 | ✅ 배열 확인, 최대 20개 제한 | ✅ |
| `POST /api/todos/from-idea` | ✅ `getAuthUserId` | ✅ `user_id: authUserId` INSERT | ✅ `ideaText.trim().length === 0` → 400 | ✅ |

**서버 검증 누락 없음 ✅**

---

### 3-4. 성능 문제 점검

| 항목 | 상태 | 비고 |
|------|------|------|
| 그래프 데이터 fetch (useMemoGraph) | ✅ 1회, 탭 활성화 시만 | `enabled: tab === 'graph'` |
| 임계값 슬라이더 필터링 | ✅ 클라이언트 처리 | 재 API 호출 없음 |
| 클러스터 탐지 (Union-Find) | ✅ 클라이언트 계산 | 서버 호출 없음 |
| N+1 쿼리 | ✅ 없음 | memos 1회, embeddings 1회 IN 쿼리 |
| clusters API (미연결) | ⚠️ 잠재적 이슈 | 구현 시 병렬 OpenAI 호출 필요. 설계 대로 `Promise.all` 적용 필수 |
| `MemoGraphView.tsx` 내 `handleEngineStop` | ⚠️ 경고 | `data.nodes` 객체를 직접 변경(`n.fx = n.x`)하여 React 불변성 원칙 위반. 기능은 동작하나 리렌더 이슈 가능 |

---

### 3-5. 폴더 구조 위반

| 위치 | 설계 | 현실 | 판정 |
|------|------|------|------|
| `detectClusters`, `convexHull` 유틸 | `src/lib/memos/cluster-hull-utils.ts` 예정 | `MemoGraphView.tsx` 내부 | ⚠️ 경미 (현재 줄 수 OK) |
| 그 외 전체 | 설계 구조 일치 | 일치 | ✅ |

`cluster-hull-utils.ts` 분리는 설계에서도 "사전 대응 계획"으로만 언급. 의무 아님.

---

## 4. 종합 의견 및 수정 우선순위

### 종합 평가

전체 구현 완성도는 **약 80%**. Phase 1~3의 핵심 기능(카드 디자인, 그래프 멀티셀렉트, SSE 아이디어 생성, 할일 추출 모달)은 모두 정상 동작 상태. API 서버 검증·보안 전면 준수. 성능 규칙 준수.

미달 원인은 하나: **클러스터 AI 명명 API 호출 연결 미완료 (GAP-1)**. 설계의 Phase 2 완성을 위해 이 부분만 해결하면 됨.

### 수정 우선순위

| 순위 | GAP | 파일 | 예상 작업량 | 비고 |
|------|-----|------|------------|------|
| P0 | GAP-1 클러스터 API 호출 | `MemoGraphView.tsx` | ~30줄 추가 | 기능 완성 핵심 |
| P1 | GAP-1 분리 예방 | `src/hooks/useMemoCluster.ts` 분리 | ~50줄 | MemoGraphView 500줄 초과 방지 |
| P2 | GAP-2 상태 위치 | `page.tsx` 또는 `memo-list.tsx` 조정 | 중간 | 필수 아니나 설계 의도 정합성 |
| P3 | GAP-3 단일 책임 | `memo-idea-panel.tsx` props 핸들러화 | 소규모 | 리팩 성격 |
| P4 | GAP-4 모달 버튼 | `memo-todo-confirm-modal.tsx` | 5줄 | UX 일관성 |
| P5 | GAP-6 폰트 | `memo-card.tsx` | 2줄 | 미관 |

---

## 5. 검증 기준 대조 (설계 11절)

| 검증 항목 | 기대 결과 | 구현 상태 |
|----------|----------|----------|
| 목록 탭 카드 디자인 | 여백 균등, 호버 애니메이션, 핀 아이콘 | ✅ 완료 |
| 그래프 탭 전환 | 그래프 캔버스 표시, API 1회 호출 | ✅ 완료 |
| 멀티셀렉트 | Shift+클릭 3개 → 강조 + 아이디어 버튼 | ✅ 완료 |
| 아이디어 생성 SSE | 버튼 클릭 → 패널 열림, 텍스트 스트리밍 | ✅ 완료 |
| 스트리밍 완료 후 버튼 활성화 | 메모저장·할일추출·문서생성 버튼 활성 | ✅ 완료 (문서생성은 Phase 4 stub) |
| 메모로 저장 | POST /api/memos → 목록 갱신 | ✅ 완료 |
| 할일 추출 | POST /api/todos/from-idea → 확인 모달 | ✅ 완료 |
| 클러스터 헐 표시 | 연결된 노드 그룹에 반투명 헐 | ✅ 완료 |
| 클러스터명 표시 | 헐 위에 AI 생성 클러스터명 | ❌ **미구현 (GAP-1)** |
| 500줄 제한 | 모든 파일 500줄 미만 | ✅ 완료 (MemoGraphView 주의 요) |
| 인증 없는 API 호출 방어 | 로그아웃 후 401 반환 | ✅ 완료 |

---

```
─────────────────────────────────────────────────
📋 플랫폼 개발 원칙 점검 (분석 결과)
─────────────────────────────────────────────────
1. 페이지 500줄 제한   : ✅ 준수 (MemoGraphView 429줄 — GAP-1 추가 시 분리 권장)
2. 단일 책임           : ⚠️ 경미 위반
                         memo-idea-panel.tsx — SSE 표시 + API 직접 호출 혼재
                         memo-list.tsx — UI + 탭 상태 + 훅 호출 혼재
3. 서버 검증·보안      : ✅ 준수 — 모든 변이 API 인증·소유권 검증 완료
4. 성능 (중복·N+1)     : ✅ 준수 (handleEngineStop 불변성 경고 제외)
5. 폴더 구조           : ✅ 준수 (cluster-hull-utils 분리 미진행 — 경미)
─────────────────────────────────────────────────
위반 항목: 경미 2건 (기능 동작 영향 없음)
핵심 미구현: GAP-1 — 클러스터 AI 명명 API 호출 연결
─────────────────────────────────────────────────
```
