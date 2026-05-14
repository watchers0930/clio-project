# CLIO 메모 시스템 고도화 — 설계-구현 GAP 분석서

> **분석 대상**: `docs/02-design/features/clio.design.md` vs. 실제 구현 코드
> **초기 분석일**: 2026-04-21
> **후속 반영일**: 2026-05-06
> **버전 기준**: v7.7.0
> **분석자**: 크로미

---

## 1. Match Rate (일치율)

| Phase | 항목 | 일치율 | 비고 |
|-------|------|--------|------|
| Phase 1 | UI 기반 강화 (card·list·page) | 100% | 주요 UI gap 해소 |
| Phase 2 | 그래프 + AI 아이디어 워크플로우 | 95% | clusters API 연결, 상태 허브 반영 완료 |
| Phase 3 | 할일 연결 (모달) | 95% | 빈 결과 안내 및 액션 정리 완료 |
| Phase 4 | 문서 생성 출력 연결 | 20% | 설계 자체가 "추후 구현" 명시. stub 상태 |
| **전체** | | **~92%** | Phase 4 제외 시 실사용 흐름 대부분 정합 |

---

## 2. Gap 목록

### GAP-1 RESOLVED — clusters API 호출 코드 연결 완료

**설계 (5절, 6-5절)**:
> 클러스터 탐지 후 `/api/memos/graph/clusters` 호출 → AI 생성 클러스터명을 헐 중심에 표시

**현재 상태**:
- `useMemoCluster()`가 `/api/memos/graph/clusters` 호출과 응답 캐시를 담당
- 클러스터 ID 정규화, 중복 요청 방지, 요청 실패 fallback 처리 완료
- `MemoGraphView.tsx`는 이름이 반영된 `clusters`를 그대로 렌더링

**반영 파일**:
- `src/hooks/useMemoCluster.ts`
- `src/app/api/memos/graph/clusters/route.ts`

**추가 처리**:
- OpenAI 키가 없어도 이름 없는 클러스터로 안전하게 동작
- 응답 name 길이 제한과 공백 정리 처리

---

### GAP-2 RESOLVED — page.tsx 상태 구조 정합화 완료

**설계 (2-2절)**:
```typescript
// page.tsx에서 관리
viewMode: 'list' | 'graph'
selectedMemoIds: Set<string>
ideaPanelOpen: boolean
```

**현재 상태**:
| 상태 | 설계 위치 | 실제 위치 |
|------|----------|----------|
| `viewMode` | `page.tsx` | `page.tsx` |
| `selectedMemoIds` | `page.tsx` | `page.tsx` |
| `ideaPanelOpen` | `page.tsx` | `page.tsx` |

`page.tsx`가 상태 허브 역할을 하고, `memo-list.tsx`/`MemoGraphView.tsx`는 props 기반으로만 동작한다.

---

### GAP-3 RESOLVED — memo-idea-panel API 직접 호출 제거

**설계 (2-3절)**:
> `page.tsx`: 책임 = "API 호출, 핸들러 조립"
> `memo-idea-panel.tsx`: 책임 = "SSE 표시, 액션 버튼", 금지 = "그래프 상태 참조"

**현재 상태**:
- `page.tsx`가 `onSaveIdeaMemo`, `onExtractIdeaTodos` 핸들러를 조립
- `memo-idea-panel.tsx`는 표시/UI 상태만 담당
- 저장/추출 실패 메시지도 props 기반 호출 결과만 사용

---

### GAP-4 PARTIAL — memo-todo-confirm-modal은 현재 UX 기준으로 정리 완료

**설계 (6-4절) 와이어프레임**:
```
[취소]  [할일로 등록]
```

**현재 상태**:
- 저장 완료 후 결과 확인 모달이므로 `확인` 단일 액션 유지
- 추가로 `0건 추출` 케이스를 별도 빈 상태 UI로 처리

설계 와이어프레임과 버튼 수는 다르지만, 실제 저장 시점 기준으로는 현재 UX가 더 일관적이다.

---

### GAP-5 LOW — 클러스터 헐 알파 미세 차이

| | 설계 (5-2절) | 현실 (`MemoGraphView.tsx:84`) |
|--|--|--|
| 헐 알파 | `0.08` | `0.09` |

기능 및 UX에 무의미한 차이.

---

### GAP-6 RESOLVED — memo-card.tsx 제목 폰트 반영 완료

**설계 (6-5절)**: "제목 폰트 → Paperlogy 또는 Pretendard (CSS 변수 활용)"

**현재 상태**:
- 그래프 캔버스 노드 라벨: `"Paperlogy", "Noto Sans KR"` ✅
- 카드 제목: `"Paperlogy", "Pretendard", "Noto Sans KR"` ✅

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

전체 구현 완성도는 **약 92%**. Phase 1~3의 핵심 기능(카드 디자인, 그래프 멀티셀렉트, SSE 아이디어 생성, 할일 추출 모달, 클러스터 명명)은 정상 동작 상태다. API 서버 검증도 유지된다.

남은 미구현은 사실상 **Phase 4 문서 생성 연결 stub** 뿐이다.

### 수정 우선순위

| 순위 | GAP | 파일 | 예상 작업량 | 비고 |
|------|-----|------|------------|------|
| P0 | Phase 4 문서 생성 연결 | `memo-idea-panel.tsx`, `/api/generate` 연계부 | 중간 | 별도 기획 필요 |
| P1 | `handleEngineStop` 불변성 리스크 검토 | `MemoGraphView.tsx` | 중간 | 현재 동작 이상 없음 |
| P2 | 클러스터/헐 유틸 추가 분리 | `src/hooks` 또는 `src/lib/memos` | 중간 | 유지보수성 개선 |

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
| 클러스터명 표시 | 헐 위에 AI 생성 클러스터명 | ✅ 완료 |
| 500줄 제한 | 모든 파일 500줄 미만 | ✅ 완료 (MemoGraphView 주의 요) |
| 인증 없는 API 호출 방어 | 로그아웃 후 401 반환 | ✅ 완료 |

---

```
─────────────────────────────────────────────────
📋 플랫폼 개발 원칙 점검 (분석 결과)
─────────────────────────────────────────────────
1. 페이지 500줄 제한   : ✅ 준수 (MemoGraphView 429줄 — GAP-1 추가 시 분리 권장)
2. 단일 책임           : ⚠️ 경미 위반
                         memo-list.tsx — UI + 그래프 로드 훅 호출 혼재
                         memo-idea-panel.tsx 직접 API 호출 위반은 해소
3. 서버 검증·보안      : ✅ 준수 — 모든 변이 API 인증·소유권 검증 완료
4. 성능 (중복·N+1)     : ✅ 준수 (handleEngineStop 불변성 경고 제외)
5. 폴더 구조           : ✅ 준수 (cluster-hull-utils 분리 미진행 — 경미)
─────────────────────────────────────────────────
위반 항목: 경미 1~2건 수준 (기능 동작 영향 없음)
핵심 미구현: Phase 4 — 문서 생성 연결 stub
─────────────────────────────────────────────────
```
