
# 메모 (Memos)

[coverage: high -- sources: docs/01-plan/features/clio.plan.md, docs/01-plan/features/memo-insight.plan.md, docs/01-plan/features/memo-graph.plan.md, src/app/(app)/memos/page.tsx, src/components/memos/*, src/hooks/useMemoGraph.ts, src/app/api/memos/*, supabase/migrations/021_memo_embeddings.sql]

---

## Purpose [coverage: high -- 8 sources]

CLIO 메모는 단순 CRUD를 넘어 "생각의 파편을 조직화하는 허브"를 목표로 한다. PC·모바일에서 빠르게 기록한 아이디어들을 AI가 자동으로 연결하고, 새로운 산출물을 만들어낼 수 있는 3단계 가치를 제공한다.

1. **기록** — 색상 구분 + 고정(pin) 지원 카드형 메모 CRUD
2. **연결** — pgvector 임베딩 + 그래프 뷰 (title·content·semantic 3종 링크)
3. **창출** — 그래프 멀티셀렉트 → GPT-4o 아이디어 생성(SSE) → 할일 자동 등록

현재 아키텍처에서는 그룹 클러스터링 API(groups/route.ts)는 제거됐으며, 아이디어 생성은 그래프 뷰에서 직접 메모를 선택하는 방식으로 전환됐다.

---

## Architecture [coverage: high -- 8 sources]

### 파일 구조 (v7.4.0)

```
src/
├── app/(app)/memos/
│   └── page.tsx                   # 메모 페이지 (~180줄, 상태+핸들러 조율)
├── app/api/memos/
│   ├── route.ts                   # GET/POST 메모 CRUD
│   ├── [id]/
│   │   ├── route.ts               # PATCH/DELETE 메모
│   │   ├── embed/route.ts         # POST 임베딩 생성 (fire-and-forget)
│   │   └── related/route.ts       # GET 연관 메모 (pgvector RPC)
│   ├── graph/route.ts             # GET 그래프 데이터 (title·content·semantic 링크)
│   ├── graph/clusters/route.ts    # POST AI 클러스터 명명 (Phase 2, GPT-4o-mini)
│   └── idea/route.ts              # POST 아이디어 생성 SSE (memoIds[] → GPT-4o)
├── components/memos/
│   ├── memo-list.tsx              # 목록 탭 컨트롤 + 검색바 (API 호출 없음)
│   ├── memo-card.tsx              # 메모 카드 (color 뱃지·핀 아이콘·호버 효과)
│   ├── memo-form-modal.tsx        # 메모 생성/수정 폼 모달
│   ├── memo-view-modal.tsx        # 메모 상세 뷰 모달
│   ├── MemoGraphView.tsx          # 그래프 캔버스 (멀티셀렉트·클러스터 헐·컨트롤)
│   ├── MemoGraphSidePanel.tsx     # 단일 노드 미리보기 사이드패널
│   ├── memo-graph-controls.tsx    # 임계값 슬라이더 (클라이언트 필터링)
│   ├── memo-idea-panel.tsx        # SSE 아이디어 결과 패널 + 액션 버튼
│   └── memo-todo-confirm-modal.tsx # 할일 추출 결과 확인 모달
├── hooks/
│   ├── useMemoGraph.ts            # 그래프 데이터 fetch + 캐시
│   └── useMemoIdea.ts             # POST /api/memos/idea SSE 스트리밍 훅
└── types/
    └── memo-graph.ts              # GraphNode·GraphLink·ClusterInfo·ForceGraph* 타입
```

**컴포넌트 책임 경계**:
| 컴포넌트 | 책임 | 금지 |
|----------|------|------|
| `MemoGraphView` | 캔버스, 셀렉트, 클러스터 헐 | 아이디어 API 직접 호출 |
| `memo-idea-panel` | SSE 표시, 메모저장·할일추출 버튼 | 그래프 상태 참조 |
| `useMemoIdea` | fetch + ReadableStream 파싱 | UI 없음 |

**제거된 파일** (v7.3.0~7.4.0 리팩토링):
- `src/app/api/memos/groups/route.ts` — 클러스터 캐시 API 제거
- `src/app/api/memos/groups/suggest/route.ts` — 그룹 기반 SSE 제거
- `src/components/memos/IdeaCard.tsx` / `IdeaSuggestPanel.tsx` — 그룹 아이디어 패널 제거
- `src/components/memos/MemoGroupView.tsx` / `MemoGroupHeader.tsx` — 그룹 뷰 제거
- `src/components/memos/RelatedMemos.tsx` / `MemoGraphLegend.tsx` / `memo-graph-controls.tsx` / `memo-graph-empty.tsx` — 개별 서브컴포넌트 제거
- `src/hooks/useMemoGroups.ts` — 그룹 훅 제거
- `src/lib/ai/memo-clustering.ts` — Union-Find 클러스터링 라이브러리 제거

### 뷰 모드

`page.tsx`의 `viewMode: 'list' | 'graph'` 상태로 두 가지 뷰 전환:
- **목록**: 카드 그리드, 검색, 고정 메모 우선 정렬
- **그래프**: force-directed 그래프, 멀티셀렉트, 아이디어 생성

---

## API Surface [coverage: high -- 5 sources]

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/memos` | 메모 목록 (검색 지원, 최신순) | 필수 |
| POST | `/api/memos` | 메모 생성 | 필수 |
| PATCH | `/api/memos/[id]` | 메모 수정 (부분 업데이트) | 소유자만 |
| DELETE | `/api/memos/[id]` | 메모 삭제 | 소유자만 |
| POST | `/api/memos/[id]/embed` | 임베딩 생성 (fire-and-forget) | 소유자만 |
| GET | `/api/memos/[id]/related` | 연관 메모 3개 (pgvector RPC) | 소유자만 |
| GET | `/api/memos/graph` | 그래프 노드+링크 데이터 | 필수 |
| POST | `/api/memos/idea` | 선택 메모 기반 아이디어 생성 SSE | 필수 |
| POST | `/api/memos/graph/clusters` | AI 클러스터 명명 (Phase 2) | 필수 |
| POST | `/api/todos/from-idea` | 아이디어 텍스트 → 할일 3~7개 추출 | 필수 |

**그래프 링크 타입**:
| type | 시각 | 조건 |
|------|------|------|
| `title` | 실선 (인디고) | 제목 단어 일치율 ≥ 0.15 |
| `content` | 점선 (회색) | 제목 단어가 상대 내용에 포함 ≥ 0.20 |
| `semantic` | 점선 (파란색) | 코사인 유사도 ≥ 0.78 |

**클라이언트 클러스터 탐지** (서버 호출 없음):
- Union-Find 알고리즘으로 semantic 링크 또는 similarity ≥ 0.5 링크 기준 클러스터 탐지
- 볼록 다각형(convex hull) + 반투명 배경으로 캔버스에 시각화
- 클러스터명은 `/api/memos/graph/clusters` 호출 후 헐 중심에 렌더링

**제거된 엔드포인트**:
- ~~GET /api/memos/groups~~ — 클러스터 캐시 (제거됨)
- ~~POST /api/memos/groups/suggest~~ — 그룹 기반 SSE (제거됨)

---

## Data Schema [coverage: high -- 2 sources]

### memos (migration 016)

```sql
CREATE TABLE memos (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      TEXT NOT NULL,
  content    TEXT,
  color      TEXT NOT NULL DEFAULT 'default',  -- 'default'|'blue'|'green'|'yellow'|'red'|'purple'
  is_pinned  BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### memo_embeddings (migration 021)

```sql
CREATE TABLE memo_embeddings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id    UUID NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  embedding  vector(1536) NOT NULL,
  UNIQUE(memo_id)
);
-- ivfflat 인덱스 (lists=100, cosine)
-- match_memo_embeddings RPC: 코사인 유사도 상위 K개 반환
```

### memo_groups (migration 021 — 현재 미사용)

```sql
CREATE TABLE memo_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  memo_ids   UUID[] NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> migration 021에 테이블은 존재하나, groups API가 제거되어 현재 INSERT/SELECT하는 코드 없음. 차후 재도입 가능.

---

## RLS Policies [coverage: high -- 1 source]

| 테이블 | 정책 | 조건 |
|--------|------|------|
| `memos` | ALL | `created_by = auth.uid()` |
| `memo_embeddings` | ALL | EXISTS (memos m WHERE m.id = memo_id AND m.created_by = auth.uid()) |
| `memo_groups` | ALL | `user_id = auth.uid()` |

---

## AI Pipeline [coverage: high -- 4 sources]

### 1. 임베딩 흐름

```
메모 저장/수정 완료
  → 클라이언트: POST /api/memos/[id]/embed (fire-and-forget, 실패 무시)
  → 서버: title + "\n" + content → text-embedding-3-small → vector(1536)
  → memo_embeddings UPSERT
```

### 2. 아이디어 생성 (POST /api/memos/idea)

```
요청: { memoIds: ["uuid1", "uuid2", "uuid3"] }   // 최소 2개
  → 소유자 일치 확인 (DB filter: created_by = authUserId)
  → 각 메모 title + content 수집
  → GPT-4o 스트리밍 (temperature=0.7, max_tokens=1000)
     프롬프트: 아이디어 생성 (마크다운 4섹션 구조)
  → SSE 스트림: data: {"text": "..."}
  → 완료: data: [DONE]
```

### 3. 그래프 데이터 (GET /api/memos/graph)

```
전체 메모 조회 (created_by = authUserId)
  → memo_embeddings 조회 (전체)
  → 링크 생성 (N×N 쌍 비교, 우선순위 순):
      1. title link: 제목 단어 일치율 ≥ 0.15 → 실선
      2. content link: 제목 단어가 상대 내용에 포함 ≥ 0.20 → 점선
      3. semantic link: 코사인 유사도 ≥ 0.78 → 점선 (파란색)
      (각 쌍은 1개 링크만 — 우선순위 높은 타입 선택)
  → { nodes: GraphNode[], links: GraphLink[] } 반환
```

### 4. 연관 메모 (GET /api/memos/[id]/related)

```
대상 메모 임베딩 조회
  → match_memo_embeddings RPC (threshold=0.75, count=3, exclude=자기자신)
  → 제목 JOIN 후 반환
임베딩 없으면 빈 배열 반환 (에러 없음)
```

---

## Key Decisions [coverage: high -- 3 sources]

| 결정 | 이유 |
|------|------|
| 임베딩을 fire-and-forget으로 생성 | 메모 저장 응답 속도에 영향 없음. 실패해도 CRUD 완료 |
| groups API 제거 → memoIds 직접 전달 방식 | 별도 클러스터 캐시 없이 그래프에서 직접 선택. 단순성 향상 |
| 그래프 링크 3종 타입 (title/content/semantic) | 임베딩 없는 메모도 keyword 기반 링크로 포함. orphan 노드 최소화 |
| 클라이언트 임계값 필터링 | 그래프 API는 전체 링크 반환, 슬라이더는 클라이언트 처리. 재API 호출 없이 즉시 반응 |
| SSE 스트리밍 방식 아이디어 생성 | GPT-4o 응답 대기 시간 UX 개선. 텍스트 점진 표시 |
| react-force-graph-2d | Canvas 기반 고성능, force simulation 내장. 2D 선택 (성능/복잡성 균형) |

---

## Tech Debt [coverage: medium -- 2 sources]

- **임베딩 미생성 메모**: 생성 직후 또는 embed API 실패 시 `hasEmbedding=false`. 시맨틱 링크 없음. 일괄 재생성 배치 없음
- **memo_groups 테이블 미활용**: migration 021에 존재하나 INSERT/SELECT 코드 없음. 클린업 or 재도입 결정 필요
- **memo_embeddings generated types 미등록**: `src/lib/supabase/types.ts`에 미포함 → `rawFrom()` 캐스팅 패턴 사용 중
- **그래프 N×N 비교**: 메모 200개 초과 시 성능 저하 가능. 향후 pgvector RPC 방식 전환 권장

---

## Gotchas [coverage: high -- 4 sources]

- **SSR 불가**: `react-force-graph-2d`는 Canvas API 사용. `dynamic(() => import(...), { ssr: false })` 필수. 누락 시 서버 사이드 에러
- **링크 우선순위**: 동일 쌍에 title·content·semantic이 모두 해당되면 title만 생성 (continue). 그래프 링크 중복 방지
- **memo_embeddings embedding 타입**: DB에서 문자열로 반환될 수 있음. `typeof e.embedding === 'string'` 체크 후 JSON.parse 필요
- **idea API 소유권 확인**: memoIds를 DB에서 필터링 후 본인 소유 메모가 2개 미만이면 403. admin 클라이언트 사용이므로 코드 레벨 소유권 확인 필수
- **한글 단어 추출**: 2자 이상 한글, 3자 이상 영문만 추출 (extractWords 함수). 단어 분리 시 stopwords 없음 — 너무 흔한 단어도 연결될 수 있음

---

## Sources [coverage: high]

- /Users/watchers/Desktop/clio-project/docs/01-plan/features/clio.plan.md
- /Users/watchers/Desktop/clio-project/docs/01-plan/features/memo-insight.plan.md
- /Users/watchers/Desktop/clio-project/docs/01-plan/features/memo-graph.plan.md
- /Users/watchers/Desktop/clio-project/src/app/(app)/memos/page.tsx
- /Users/watchers/Desktop/clio-project/src/app/api/memos/graph/route.ts
- /Users/watchers/Desktop/clio-project/src/app/api/memos/idea/route.ts
- /Users/watchers/Desktop/clio-project/src/app/api/memos/[id]/embed/route.ts
- /Users/watchers/Desktop/clio-project/src/app/api/memos/[id]/related/route.ts
- /Users/watchers/Desktop/clio-project/src/hooks/useMemoGraph.ts
- /Users/watchers/Desktop/clio-project/src/types/memo-graph.ts
- /Users/watchers/Desktop/clio-project/supabase/migrations/021_memo_embeddings.sql
