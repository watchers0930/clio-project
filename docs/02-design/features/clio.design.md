# CLIO 메모 시스템 고도화 설계서

> **요약**: 메모를 단순 기록 도구에서 지식 엔진으로 격상. 그래프 뷰 멀티셀렉트 + AI 아이디어 생성(SSE) + 할일 자동 연결 + 클러스터 시각화 + 다중 포맷 출력을 단계적으로 구현.
>
> **프로젝트**: CLIO
> **버전**: v7.4.0 (목표)
> **작성자**: 크로미
> **작성일**: 2026-04-21
> **상태**: Draft
> **계획서**: [clio.plan.md](../../01-plan/features/clio.plan.md)
> **참조 설계서**: [memo-insight.design.md](./memo-insight.design.md)

---

## 1. 현재 상태 및 구현 범위

### 1-1. 이미 구현된 것 (유지)

| 구성 요소 | 상태 | 비고 |
|-----------|------|------|
| `GET /api/memos/graph` | ✅ 구현 | title·content·semantic 3종 링크 타입 |
| `POST /api/memos/idea` | ✅ 구현 | memoIds[] → GPT-4o SSE 스트리밍 |
| `POST /api/todos/from-idea` | ✅ 구현 | ideaText → GPT-4o 할일 3~7개 추출 + INSERT |
| `POST /api/memos/[id]/embed` | ✅ 구현 | fire-and-forget, text-embedding-3-small |
| `GET /api/memos/[id]/related` | ✅ 구현 | pgvector match_memo_embeddings RPC |
| `MemoGraphView.tsx` | ✅ 구현 | react-force-graph-2d, Canvas 기반 |
| `MemoGraphSidePanel.tsx` | ✅ 구현 | 그래프 우측 사이드패널 (기존 구조) |
| `useMemoGraph.ts` | ✅ 구현 | 그래프 데이터 fetch + 캐시 |
| `src/types/memo-graph.ts` | ✅ 구현 | GraphNode·GraphLink·ForceGraphNode 타입 |

### 1-2. 구현 대상 (이번 설계 범위)

| 단계 | 항목 | 우선순위 |
|------|------|---------|
| Phase 1 | memo-card.tsx 디자인 개선 (여백·호버·폰트) | High |
| Phase 1 | page.tsx 그래프 탭 진입 복원 | High |
| Phase 2 | 그래프 멀티셀렉트 → 아이디어 생성 버튼 | High |
| Phase 2 | `useMemoIdea.ts` 훅 + `memo-idea-panel.tsx` | High |
| Phase 2 | 클라이언트 사이드 클러스터 헐(hull) 시각화 | Medium |
| Phase 2 | `POST /api/memos/graph/clusters` AI 클러스터 명명 | Medium |
| Phase 3 | 할일 추출 확인 모달 `memo-todo-confirm-modal.tsx` | High |
| Phase 4 | 아이디어 → POST /api/generate 출력 연결 | Medium |

---

## 2. 아키텍처 및 컴포넌트 구조

### 2-1. 파일 분리 계획 (500줄 원칙 적용)

```
src/
├── app/(app)/memos/
│   └── page.tsx                        # 진입점 (~180줄)
│                                       #   상태: viewMode, selectedIds, panels
│                                       #   CRUD 핸들러 + embed fire-and-forget
├── app/api/memos/
│   ├── route.ts                        # GET/POST (기존)
│   ├── [id]/
│   │   ├── route.ts                    # PATCH/DELETE (기존)
│   │   ├── embed/route.ts              # POST 임베딩 (기존)
│   │   └── related/route.ts            # GET 연관 메모 (기존)
│   ├── graph/
│   │   ├── route.ts                    # GET 그래프 데이터 (기존, 유지)
│   │   └── clusters/
│   │       └── route.ts                # POST AI 클러스터 명명 (Phase 2 신규)
│   └── idea/
│       └── route.ts                    # POST 아이디어 SSE (기존)
├── components/memos/
│   ├── memo-list.tsx                   # 목록 뷰 컨트롤 (기존, 레이아웃 조정)
│   ├── memo-card.tsx                   # 카드 UI — 디자인 개선 (기존 수정)
│   ├── memo-form-modal.tsx             # 폼 모달 (기존)
│   ├── memo-view-modal.tsx             # 상세 모달 (기존)
│   ├── MemoGraphView.tsx               # 그래프 캔버스 (기존, 기능 추가)
│   │                                   #   멀티셀렉트, 클러스터 헐, 아이디어 버튼
│   ├── MemoGraphSidePanel.tsx          # 그래프 사이드패널 (기존)
│   ├── memo-graph-controls.tsx         # 임계값 슬라이더 (신규 재추가)
│   ├── memo-idea-panel.tsx             # 아이디어 SSE 결과 패널 (신규)
│   └── memo-todo-confirm-modal.tsx     # 할일 추출 확인 모달 (신규)
├── hooks/
│   ├── useMemoGraph.ts                 # 그래프 fetch (기존)
│   └── useMemoIdea.ts                  # 아이디어 SSE 스트리밍 훅 (신규)
└── types/
    └── memo-graph.ts                   # 타입 정의 (기존)
```

### 2-2. page.tsx 상태 구조

```typescript
// 책임: 상태 조율 + 비즈니스 핸들러 (UI 없음)
type ViewMode = 'list' | 'graph';

// 상태
viewMode: ViewMode                    // 탭 전환
memos: MemoItem[]                     // 목록 데이터
loading: boolean
search: string
selectedMemoIds: Set<string>          // 그래프 멀티셀렉트
ideaPanelOpen: boolean                // 아이디어 패널 열림 여부
selectedMemo: MemoItem | null         // 모달 대상
deleteId: string | null
```

### 2-3. 컴포넌트 책임 경계

| 컴포넌트 | 책임 | 금지 사항 |
|----------|------|----------|
| `page.tsx` | 상태 관리, API 호출, 핸들러 조립 | 직접 JSX 렌더링 최소화 |
| `memo-list.tsx` | 목록/그리드 UI, 검색바, 추가 버튼 | API 호출 금지 |
| `memo-card.tsx` | 카드 1개 렌더링, 액션 콜백 | 상태 관리 금지 |
| `MemoGraphView.tsx` | 그래프 캔버스, 셀렉트 이벤트 | 아이디어 API 호출 금지 |
| `memo-idea-panel.tsx` | SSE 스트림 표시, 액션 버튼 | 그래프 상태 참조 금지 |
| `useMemoIdea.ts` | SSE fetch, 스트림 파싱, 상태 반환 | UI 없음 |

---

## 3. 데이터 모델

### 3-1. 기존 테이블 (변경 없음)

```sql
-- memos (migration 016)
memos(id, title, content, color, is_pinned, created_by, created_at, updated_at)

-- memo_embeddings (migration 021)
memo_embeddings(id, memo_id, embedding vector(1536), UNIQUE memo_id)

-- ivfflat 인덱스 (cosine), match_memo_embeddings RPC
```

### 3-2. 신규 마이그레이션 없음

Phase 1~3은 기존 테이블만 활용. Phase 4(Export) 역시 기존 `/api/generate` 파이프라인 연결.

`memo_groups` 테이블은 현재 migration 021에 정의되어 있으나, **groups API가 제거된 현 아키텍처에서는 사용하지 않음**. 차후 TTL 기반 클러스터 캐시 재도입 시 활용 가능.

### 3-3. 클러스터 타입 (TypeScript)

```typescript
// src/types/memo-graph.ts 에 추가
export interface ClusterInfo {
  clusterIds: string[];   // 같은 클러스터의 node id 배열
  name?: string;          // AI 생성 클러스터명 (Phase 2)
  color?: string;         // 헐 표시 색상 (클라이언트 계산)
}

export interface MemoGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  clusters?: ClusterInfo[];   // Phase 2에서 추가 (선택적)
}
```

---

## 4. API 스펙

### 4-1. 기존 API (변경 없음)

#### `GET /api/memos/graph`

**인증**: 필수

**Query Params**: 없음

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "nodes": [
      { "id": "uuid", "title": "...", "content": "...", "color": "blue", "hasEmbedding": true }
    ],
    "links": [
      { "source": "uuid", "target": "uuid", "similarity": 0.82, "type": "title" }
    ]
  }
}
```

**링크 타입 의미**:
| type | 시각 | 조건 |
|------|------|------|
| `title` | 실선 | 제목 단어 일치율 ≥ 0.15 |
| `content` | 점선 | 제목 단어가 상대 내용에 포함 ≥ 0.20 |
| `semantic` | 점선 (파란색) | 코사인 유사도 ≥ 0.78 |

**Error**:
```json
{ "success": false, "error": "인증 필요" }   // 401
{ "success": false, "error": "서버 오류" }   // 500
```

---

#### `POST /api/memos/idea`

**인증**: 필수

**Request Body**:
```json
{ "memoIds": ["uuid1", "uuid2", "uuid3"] }
```

**Validation**:
- `memoIds` 배열, 최소 2개 필수
- 모든 memoId가 인증 사용자 소유여야 함 (소유 확인 후 필터링)

**Response**: SSE 스트림 (`Content-Type: text/event-stream`)
```
data: {"text": "## 💡 아이디어 제목\n"}
data: {"text": "(핵심 아이디어 한 줄)\n\n"}
...
data: [DONE]
```

**Error Response (JSON)**:
```json
{ "success": false, "error": "2개 이상의 메모를 선택하세요" }   // 400
{ "success": false, "error": "권한 없는 메모 포함" }            // 403
```

**GPT-4o 출력 포맷** (마크다운):
```markdown
## 💡 아이디어 제목
(한 줄 핵심 아이디어)

## 핵심 개념
(연결 인사이트 2~3문장)

## 실행 방안
- 단계 1
- 단계 2
- 단계 3~5

## 기대 효과
(가치 설명)
```

---

#### `POST /api/todos/from-idea`

**인증**: 필수

**Request Body**:
```json
{ "ideaText": "아이디어 전체 마크다운 텍스트", "groupName": "선택적 컨텍스트명" }
```

**Validation**:
- `ideaText`: 필수, 비어있으면 400

**Response (200)**:
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "title": "할일 제목", "priority": "high" }
  ],
  "count": 5
}
```

**Error**:
```json
{ "success": false, "error": "할일을 추출하지 못했습니다" }   // 422
{ "success": false, "error": "할일 저장 실패" }               // 500
```

**동작**: GPT-4o가 아이디어 텍스트에서 실행 가능한 할일 3~7개 추출 → `todos` 테이블 INSERT, `description`에 출처 기록.

---

### 4-2. Phase 2 신규 API

#### `POST /api/memos/graph/clusters`

클라이언트에서 탐지한 클러스터의 메모 제목들을 받아 AI가 클러스터명을 생성.

**인증**: 필수

**Request Body**:
```json
{
  "clusters": [
    { "memoIds": ["uuid1", "uuid2", "uuid3"] },
    { "memoIds": ["uuid4", "uuid5"] }
  ]
}
```

**Validation**:
- `clusters`: 배열, 최대 20개
- 각 cluster의 `memoIds` 최소 2개
- 모든 memoId가 요청자 소유여야 함

**Response (200)**:
```json
{
  "success": true,
  "data": [
    { "index": 0, "name": "AI 법률 서비스", "memoIds": ["uuid1", "uuid2", "uuid3"] },
    { "index": 1, "name": "신규 비즈니스 모델", "memoIds": ["uuid4", "uuid5"] }
  ]
}
```

**처리 로직**:
1. memoIds → DB에서 제목 조회 (소유자 일치 확인)
2. 각 클러스터마다 GPT-4o-mini 병렬 호출: 제목 3개로 10자 이내 명명
3. 실패한 클러스터는 `null` name으로 반환 (전체 실패하지 않음)

**모델**: `gpt-4o-mini`, temperature=0.3, max_tokens=30 (per cluster)

**Error**:
```json
{ "success": false, "error": "클러스터 수 초과 (최대 20개)" }   // 400
{ "success": false, "error": "인증 필요" }                      // 401
```

---

## 5. 클라이언트 사이드 클러스터 탐지 알고리즘

그래프 API에서 받은 links 데이터를 기반으로 클라이언트에서 클러스터를 탐지.
서버 API 호출 없이 순수 클라이언트 계산.

### 5-1. Union-Find (MemoGraphView.tsx 내부 또는 유틸 분리)

```
입력: links[] (source, target, similarity, type)
임계값: type='semantic' 또는 similarity ≥ 0.5 이상인 링크만 사용

알고리즘:
1. 모든 node id를 자기 자신의 부모로 초기화
2. 필터된 링크를 순회하며 union(source, target)
3. find()로 각 노드의 루트 찾기
4. 루트 기준으로 그룹핑 → ClusterInfo[]
5. 크기 1인 클러스터 = 단독 노드 (헐 미표시)
```

### 5-2. 헐(Hull) 시각화

- react-force-graph-2d의 `onRenderFramePost` 콜백에서 Canvas 2D API로 볼록 다각형 그리기
- 각 클러스터에 고정 색상 할당 (클러스터 인덱스 기반 HSL 색상)
- 헐 알파값: 0.08 (배경 투과)
- 클러스터명: 헐 중심점 위에 14px 텍스트

---

## 6. UI 상세 설계

### 6-1. 탭 구조 (page.tsx → memo-list.tsx)

```
메모                    ← 페이지 헤더
[목록]  [그래프]        ← 탭 버튼 (우측 정렬)
```

- `viewMode: 'list' | 'graph'`
- 그래프 탭 전환 시 `useMemoGraph({ enabled: true })` 활성화
- 목록 탭에서는 그래프 데이터 fetch 안 함

### 6-2. 그래프 멀티셀렉트 흐름

```
노드 클릭 (단독)   → 사이드패널에 메모 미리보기
노드 Shift+클릭    → 선택 토글 (selectedIds 집합에 추가/제거)
선택 노드 2개 이상 → 캔버스 하단에 "💡 아이디어 생성 (N개 메모)" 버튼 표시
버튼 클릭          → memo-idea-panel 열림 + POST /api/memos/idea 호출 시작
선택 취소          → Escape 키 또는 빈 공간 클릭
```

**선택 노드 시각화**:
- 선택된 노드: 테두리 2px 흰색, 배경 채도 +30%
- 미선택 노드: 기존 스타일 유지 (대비 감소 없음 — 단순 강조)

### 6-3. memo-idea-panel 레이아웃

```
┌─────────────────────────────────────────────────────┐
│ 💡 아이디어 생성              [닫기 X]               │
│ 선택한 메모 3개 기반                                  │
│ ─────────────────────────────────────────────────── │
│ ## 💡 아이디어 제목                                   │
│ (스트리밍 중 커서 깜빡임)                             │
│                                                     │
│ ## 핵심 개념                                         │
│ ...                                                 │
│                                                     │
│ ## 실행 방안                                         │
│ - ...                                               │
│ ─────────────────────────────────────────────────── │
│ [메모로 저장]    [할일 추출]    [문서로 생성(Phase4)] │
└─────────────────────────────────────────────────────┘
```

- 패널 너비: `w-[420px]` (데스크탑), 모바일: 하단 시트 (`bottom-sheet`)
- 스트리밍 중: 하단 버튼 비활성화 (스트리밍 완료 후 활성화)
- 마크다운 렌더링: `react-markdown` 또는 간단한 정규식 파싱

### 6-4. memo-todo-confirm-modal 레이아웃

```
┌──────────────────────────────────────┐
│ 할일 추출 결과                 [X]   │
│                                      │
│ ✅ 시장 조사 자료 정리       [상]    │
│ ✅ 경쟁사 분석 보고서 작성   [중]    │
│ ✅ 프로토타입 시안 제작       [상]    │
│ ✅ 팀 킥오프 미팅 일정 잡기  [중]    │
│                                      │
│ 4개 할일을 등록합니다.               │
│              [취소]  [할일로 등록]   │
└──────────────────────────────────────┘
```

- `POST /api/todos/from-idea` 호출 결과를 표시 (이미 DB 저장 완료 상태)
- "확인" 버튼: 모달 닫기 + 성공 토스트

### 6-5. memo-card.tsx 디자인 개선 스펙

| 항목 | 현재 | 목표 |
|------|------|------|
| 카드 간격 | 기존 gap | `gap-4` (16px) 균등 |
| 내부 패딩 | 기존 | `p-4` (16px) 상하좌우 통일 |
| 제목 폰트 | 시스템 폰트 | Paperlogy 또는 Pretendard (CSS 변수 활용) |
| 호버 애니메이션 | 없음 | `transition-shadow duration-200`, `hover:shadow-md` |
| 핀 표시 | 텍스트 | 핀 아이콘 우상단 고정 + 노란 배경 |
| 태그 | 없음 | color 뱃지 좌하단 (색상 점 + 색상명) |
| 생성일 | 있음 | `text-xs text-gray-400`, 우하단 고정 |

---

## 7. useMemoIdea 훅 인터페이스

```typescript
// src/hooks/useMemoIdea.ts
interface UseMemoIdeaReturn {
  text: string;          // 누적된 SSE 텍스트 (마크다운)
  loading: boolean;      // 스트리밍 중
  done: boolean;         // 스트리밍 완료
  error: string | null;
  generate: (memoIds: string[]) => void;
  reset: () => void;
}

export function useMemoIdea(): UseMemoIdeaReturn
```

**구현 원칙**:
- `fetch` + `ReadableStream` 기반 (EventSource 불가 — POST 요청)
- `data: {"text":"..."}` 파싱 → `text` 상태에 누적
- `data: [DONE]` 수신 → `done = true`
- 컴포넌트 언마운트 시 AbortController로 스트림 중단

---

## 8. 에러 처리 정책

| 상황 | 처리 |
|------|------|
| 메모 1개 선택 후 아이디어 생성 시도 | 버튼 disabled, "2개 이상 선택하세요" 툴팁 |
| `/api/memos/idea` 스트리밍 오류 | 패널 내 인라인 에러 메시지, retry 버튼 |
| `/api/todos/from-idea` 422 | 토스트: "할일을 추출하지 못했습니다" |
| 임베딩 없는 노드 | 그래프에 포함, semantic 링크 없음, 시각적 표시 없음 (현 동작 유지) |
| 그래프 데이터 없음 (0개 메모) | MemoGraphView 내 EmptyState 컴포넌트 표시 |
| 클러스터 API 실패 | 클러스터명 없이 헐만 표시 (degraded gracefully) |

---

## 9. 구현 순서 (백엔드 → UI)

### Phase 1 — UI 기반 강화

| 순서 | 파일 | 작업 내용 |
|------|------|----------|
| 1 | `memo-card.tsx` | 디자인 개선: 여백·폰트·호버·핀·생성일 |
| 2 | `memo-list.tsx` | gap·padding 조정, 그래프 탭 버튼 추가 |
| 3 | `page.tsx` | `viewMode` 상태 추가, 그래프 탭 전환 로직 |

### Phase 2 — 그래프 + AI 아이디어 워크플로우

| 순서 | 파일 | 작업 내용 |
|------|------|----------|
| 4 | `src/app/api/memos/graph/clusters/route.ts` | AI 클러스터 명명 API 신규 구현 |
| 5 | `useMemoIdea.ts` | SSE 스트리밍 훅 신규 구현 |
| 6 | `memo-graph-controls.tsx` | 임계값 슬라이더 재추가 |
| 7 | `MemoGraphView.tsx` | 멀티셀렉트 + 클러스터 헐 + 클러스터명 렌더링 추가 |
| 8 | `memo-idea-panel.tsx` | SSE 결과 패널 신규 구현 |
| 9 | `page.tsx` | `selectedMemoIds`·`ideaPanelOpen` 연결 |

### Phase 3 — 할일 연결

| 순서 | 파일 | 작업 내용 |
|------|------|----------|
| 10 | `memo-todo-confirm-modal.tsx` | 추출 결과 확인 모달 신규 구현 |
| 11 | `memo-idea-panel.tsx` | "할일 추출" 버튼 → API 호출 → 모달 표시 |

### Phase 4 — 출력 연결 (별도 기획 확정 후)

| 순서 | 파일 | 작업 내용 |
|------|------|----------|
| 12 | `memo-idea-panel.tsx` | "문서로 생성" → 기존 문서생성 모달 연결 |

---

## 10. 절대규칙 준수 체크리스트

```
─────────────────────────────────────────────────────────────────
📋 플랫폼 개발 원칙 — 설계 단계 점검
─────────────────────────────────────────────────────────────────

1. 페이지 500줄 제한
   ✅ page.tsx: 상태 + 핸들러만 (~180줄 예상)
   ✅ MemoGraphView.tsx: 기존 파일 — 기능 추가 시 분리 필요
        → 멀티셀렉트·헐 로직 추가 후 300줄+ 예상.
           cluster-hull-utils.ts 유틸 분리로 사전 대응 계획.
   ✅ 신규 컴포넌트 모두 단일 책임 기준, 200줄 이하 예상.

2. 단일 책임
   ✅ UI(memo-card) / 상태(useMemoIdea) / 비즈니스(page.tsx) /
      API(route.ts) / 타입(memo-graph.ts) 명확히 분리.
   ✅ memo-idea-panel은 패널 렌더링만. API 직접 호출 금지
      (훅 주입 방식).

3. 서버 검증·보안
   ✅ /api/memos/idea: memoIds 소유자 일치 서버 검증 (기존 구현 확인됨).
   ✅ /api/memos/graph/clusters: DB에서 소유자 일치 확인 후 처리.
   ✅ /api/todos/from-idea: authUserId 서버 검증 (기존 구현 확인됨).
   ✅ 모든 변이 핸들러 인증 필수.

4. 성능 (중복·N+1)
   ✅ 그래프 데이터는 useMemoGraph 훅에서 1회 fetch + 캐시.
   ✅ 클러스터 탐지는 클라이언트 사이드 (추가 API 호출 없음).
   ✅ /api/memos/graph/clusters: 메모 제목 1회 IN 쿼리, GPT-4o-mini 병렬 호출.
   ✅ 그래프 임계값 슬라이더: 재API 호출 없이 클라이언트 필터링.

5. 폴더 구조
   ✅ API 라우트: app/api/memos/ 하위 도메인 기준 정리.
   ✅ 훅: src/hooks/ (useMemoGraph·useMemoIdea).
   ✅ 타입: src/types/memo-graph.ts.
   ✅ 공용 유틸 예정 (cluster-hull-utils.ts): src/lib/memos/ 위치.
   ✅ 페이지 전용 컴포넌트: src/components/memos/ 유지.

─────────────────────────────────────────────────────────────────
위반 항목: 없음 (설계 단계)
─────────────────────────────────────────────────────────────────
```

---

## 11. 검증 기준 (GAP 분석 기준)

| 항목 | 확인 방법 | 기대 결과 |
|------|----------|----------|
| 목록 탭 카드 디자인 | UI 시각 확인 | 여백 균등, 호버 애니메이션, 핀 아이콘 |
| 그래프 탭 전환 | 탭 클릭 | 그래프 캔버스 표시, API 1회 호출 |
| 멀티셀렉트 | Shift+클릭 3개 | 3개 노드 강조 + 아이디어 버튼 표시 |
| 아이디어 생성 SSE | 버튼 클릭 | 패널 열림, 텍스트 스트리밍 표시 |
| 스트리밍 완료 후 버튼 활성화 | 생성 완료 시 | 메모저장·할일추출·문서생성 버튼 활성 |
| 메모로 저장 | 버튼 클릭 | POST /api/memos → 목록 갱신 |
| 할일 추출 | 버튼 클릭 | POST /api/todos/from-idea → 확인 모달 표시 |
| 클러스터 헐 표시 | 그래프 진입 (Phase 2) | 연결된 노드 그룹에 반투명 헐 표시 |
| 클러스터명 | /api/memos/graph/clusters 호출 후 | 헐 위에 AI 생성 클러스터명 표시 |
| 500줄 제한 | 파일 줄 수 확인 | 모든 파일 500줄 미만 |
| 인증 없는 API 호출 | 로그아웃 후 API 직접 호출 | 401 반환 |
