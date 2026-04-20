# 메모 그래프 뷰 기획서

> **Summary**: 유사도 기반 force-directed 그래프로 메모 간 연결 관계를 시각화하는 Obsidian 스타일 그래프 뷰
>
> **Project**: CLIO
> **Version**: v6.9.0
> **Author**: Product Manager
> **Date**: 2026-04-20
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

현재 CLIO 메모 페이지는 목록 뷰와 그룹 뷰를 제공하지만, 메모 간 의미적 연결 관계를 시각적으로 파악할 방법이 없다. 사용자가 방대한 메모 중에서 주제적으로 유사한 메모들의 클러스터를 한눈에 파악하고, 아이디어의 흐름과 연결을 탐색할 수 있도록 그래프 뷰를 제공한다.

이 기능은 이미 구축되어 있는 `memo_embeddings` 테이블(pgvector)과 `match_memo_embeddings` RPC, `/api/memos/[id]/related` API를 적극 활용하여 추가 AI 비용 없이 구현한다.

### 1.2 Background

- Obsidian의 그래프 뷰는 지식 관리 도구에서 가장 인기 있는 기능 중 하나로, 메모 간 연결을 노드-엣지 형태로 시각화한다.
- CLIO는 이미 OpenAI embedding 기반의 유사도 검색 인프라를 보유하고 있으므로, 그래프 뷰 구현에 필요한 데이터 파이프라인이 사실상 완성되어 있다.
- 현재 메모 목록/그룹 탭에 "그래프" 탭을 추가하는 방식으로 기존 UI 패턴을 확장한다.

### 1.3 Related Documents

- 기존 메모 페이지: `src/app/(app)/memos/page.tsx`
- 메모 목록 컴포넌트: `src/components/memos/memo-list.tsx`
- 메모 그룹 훅: `src/hooks/useMemoGroups.ts`
- Related API: `src/app/api/memos/[id]/related/route.ts`

---

## 2. Scope

### 2.1 In Scope

- [ ] 메모 목록 컴포넌트의 탭에 "그래프" 탭 추가 (목록 / 그룹 / 그래프)
- [ ] force-directed 그래프 렌더링 (react-force-graph-2d 라이브러리)
- [ ] 노드 = 메모, 링크 = 유사도 연결선 (유사도 임계값 이상인 쌍만 연결)
- [ ] 노드 클릭 시 메모 상세 뷰 모달 열기 (기존 MemoViewModal 재사용)
- [ ] 노드 호버 시 메모 제목 툴팁 표시
- [ ] 그래프 데이터 로딩 API 엔드포인트 신규 추가 (`GET /api/memos/graph`)
- [ ] 유사도 임계값 슬라이더 (사용자가 연결 밀도 조절 가능)
- [ ] 그래프 초기화/리셋 버튼
- [ ] 다크/라이트 테마 대응

### 2.2 Out of Scope

- 메모 간 수동 링크 생성 (Obsidian의 `[[링크]]` 문법) — 다음 이터레이션
- 그래프 레이아웃 저장/복원 — 다음 이터레이션
- 3D 그래프 뷰 — 다음 이터레이션
- 클러스터 레이블 자동 표시 — 다음 이터레이션
- 그래프에서 직접 메모 생성/편집 — 다음 이터레이션

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | 요구사항 | 우선순위 | 상태 | MoSCoW |
|----|---------|---------|------|--------|
| FR-01 | 메모 목록 탭 영역에 "그래프" 탭 버튼 추가 | High | Pending | Must |
| FR-02 | 전체 메모와 유사도 링크 데이터를 반환하는 `/api/memos/graph` API 구현 | High | Pending | Must |
| FR-03 | react-force-graph-2d로 노드/링크 그래프 렌더링 | High | Pending | Must |
| FR-04 | 노드 클릭 시 기존 MemoViewModal 열기 | High | Pending | Must |
| FR-05 | 노드 호버 시 메모 제목 툴팁 표시 | Medium | Pending | Should |
| FR-06 | 유사도 임계값 슬라이더 (0.7~0.95 범위, 기본값 0.80) | Medium | Pending | Should |
| FR-07 | 그래프 뷰 진입 시 로딩 스피너 표시 | High | Pending | Must |
| FR-08 | 메모가 0개 또는 임계값 초과 연결 없을 때 빈 상태 메시지 표시 | Medium | Pending | Should |
| FR-09 | 노드 색상을 메모 그룹별로 구분 (그룹 없으면 기본 색상) | Low | Pending | Could |
| FR-10 | 그래프 초기화(fit to screen) 버튼 | Low | Pending | Could |

### 3.2 Non-Functional Requirements

| 카테고리 | 기준 | 측정 방법 |
|---------|------|---------|
| 성능 | 그래프 데이터 API 응답 3초 이내 (메모 200개 기준) | 브라우저 DevTools Network 탭 |
| 성능 | 메모 100개 이하 그래프 렌더링 시 60fps 유지 | Chrome Performance 탭 |
| 보안 | 인증된 사용자의 메모만 그래프에 노출 | Supabase RLS 정책 확인 |
| 접근성 | 그래프 뷰 비활성화 환경에서 목록 뷰로 폴백 | 수동 테스트 |
| UX | 최초 진입 시 그래프 캔버스가 뷰포트에 맞게 fit | 시각적 확인 |

---

## 4. 사용자 스토리

### US-01: 그래프 탭 전환
**As a** CLIO 메모 사용자  
**I want to** 메모 페이지 상단 탭에서 "그래프" 탭을 클릭하고  
**So that** 내 메모들이 유사도에 따라 노드와 선으로 연결된 그래프로 시각화되어 전체 지식 구조를 한눈에 파악할 수 있다.

**Acceptance Criteria:**
- 그래프 탭 클릭 시 force-directed 그래프가 렌더링된다
- 각 노드는 메모 제목을 레이블로 표시한다
- 유사도가 임계값 이상인 메모 쌍은 선으로 연결된다

### US-02: 메모 상세 열기
**As a** 그래프 뷰 사용자  
**I want to** 그래프에서 노드를 클릭하면  
**So that** 해당 메모의 상세 내용을 모달로 확인할 수 있다.

**Acceptance Criteria:**
- 노드 클릭 시 기존 MemoViewModal이 열린다
- 모달에서 편집/삭제 등 기존 기능이 정상 동작한다

### US-03: 연결 밀도 조절
**As a** 그래프 뷰 사용자  
**I want to** 유사도 임계값 슬라이더를 조절하여  
**So that** 연결선의 밀도를 조절해 원하는 수준의 관계도를 볼 수 있다.

**Acceptance Criteria:**
- 슬라이더를 높이면 강한 유사도의 연결만 표시된다
- 슬라이더를 낮추면 약한 유사도의 연결도 표시된다
- 슬라이더 변경은 클라이언트 사이드에서 즉시 반영된다 (재API 호출 없음)

---

## 5. 화면 구성 (ASCII 목업)

### 5.1 탭 영역 변경

```
현재:
┌─────────────────────────────────────────────────────┐
│ [검색창                      ] [목록|그룹] [+ 새 메모] │
└─────────────────────────────────────────────────────┘

변경 후:
┌──────────────────────────────────────────────────────────┐
│ [검색창                      ] [목록|그룹|그래프] [+ 새 메모] │
└──────────────────────────────────────────────────────────┘
```

### 5.2 그래프 뷰 전체 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│ [검색창                      ] [목록|그룹|그래프] [+ 새 메모]   │
├──────────────────────────────────────────────────────────────┤
│ 컨트롤 패널:                                                   │
│  연결 강도  [━━━━●━━━━━] 0.80   [⊙ 화면 맞추기]              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│        ●──────●                                              │
│       /        \     ●                                       │
│      ●          ●───●                                        │
│       \        /                                             │
│        ●──────●              ●                               │
│              \              /                                │
│               ●────────────●                                 │
│                                                              │
│  ← 드래그/줌 가능한 캔버스 영역 →                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 노드 호버 상태

```
        ┌────────────────────┐
        │ 회의록 2026-04-15  │  ← 툴팁
        └────────────────────┘
              ↓
        ●──────●
       /
      ●  ← 호버 노드 (확대 + 강조 색상)
```

### 5.4 빈 상태

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                   (그래프 아이콘)                             │
│             연결된 메모가 없습니다                            │
│       유사도 임계값을 낮추거나 메모를 더 추가해보세요           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. API 설계

### 6.1 신규 API: `GET /api/memos/graph`

**목적**: 그래프 렌더링에 필요한 노드와 링크 데이터를 한 번에 반환

**Request**
```
GET /api/memos/graph?threshold=0.80
```

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|-------|------|
| `threshold` | number | — | (클라이언트 필터링 방식으로 대체 — API 파라미터 불필요) |

**Response (200 OK)**
```json
{
  "success": true,
  "nodes": [
    {
      "id": "uuid",
      "title": "메모 제목",
      "color": "blue",
      "hasEmbedding": true
    }
  ],
  "links": [
    {
      "source": "uuid-A",
      "target": "uuid-B",
      "similarity": 0.87
    }
  ]
}
```

> 참고: 응답은 `data` 래핑 없이 최상위에 `nodes`, `links` 키를 직접 포함합니다. 클라이언트 필터링 방식으로 threshold 슬라이더를 적용하므로 API에 threshold 파라미터는 불필요합니다.

**구현 방식**
1. 인증된 사용자의 전체 메모 ID 목록 조회
2. `memo_embeddings` 테이블에서 해당 메모들의 임베딩 조회
3. `match_memo_embeddings` RPC를 순회하거나, 직접 코사인 유사도 계산으로 threshold 이상 쌍 추출
4. 노드 + 링크 조합 반환

**성능 고려사항**
- 메모 수가 많으면 N×N 유사도 계산이 비쌀 수 있음 → 최초 구현은 서버에서 threshold=0.7 고정으로 필터링, 클라이언트에서 threshold 슬라이더로 추가 필터링
- API는 threshold 없이 기본값(0.7) 이상의 링크 전체를 반환하고, 클라이언트에서 슬라이더 값(0.7~0.95)으로 실시간 필터링

### 6.2 기존 API 활용

| API | 활용 방식 |
|-----|---------|
| `GET /api/memos` | 그래프 뷰 진입 시 메모 목록 재사용 (page.tsx 기존 데이터) |
| `GET /api/memos/[id]/related` | 단일 메모의 연관 메모 조회 (노드 클릭 시 하이라이트 후보) |

---

## 7. 컴포넌트 구조

### 7.1 신규 파일 목록

```
src/
├── components/
│   └── memos/
│       ├── memo-graph-view.tsx         # 그래프 뷰 메인 컴포넌트 (캔버스 + 컨트롤)
│       ├── memo-graph-controls.tsx     # 임계값 슬라이더, 리셋 버튼 컨트롤 패널
│       └── memo-graph-empty.tsx        # 빈 상태 컴포넌트
├── hooks/
│   └── useMemoGraph.ts                 # 그래프 데이터 fetching + 상태 관리 훅
├── types/
│   └── graph.ts                        # GraphNode, GraphEdge, GraphData 타입 정의
└── app/
    └── api/
        └── memos/
            └── graph/
                └── route.ts            # GET /api/memos/graph 핸들러
```

### 7.2 컴포넌트 책임 분리

| 파일 | 책임 | 포함 금지 |
|------|------|---------|
| `memo-graph-view.tsx` | react-force-graph-2d 렌더링, 노드 이벤트 처리 | API 호출, 비즈니스 로직 |
| `memo-graph-controls.tsx` | 슬라이더 UI, 리셋 버튼 UI | 상태 관리, API 호출 |
| `memo-graph-empty.tsx` | 빈 상태 안내 UI | 모든 로직 |
| `useMemoGraph.ts` | `/api/memos/graph` 호출, threshold 상태, 필터링 | UI 렌더링 |
| `route.ts` | 서버: 인증, DB 쿼리, 유사도 계산, 응답 직렬화 | 클라이언트 로직 |

### 7.3 memo-list.tsx 수정 사항

기존 `isGroupView: boolean` 상태를 `viewMode: 'list' | 'group' | 'graph'` 로 확장하여 탭 3개를 지원한다.

```tsx
// 변경 전
const [isGroupView, setIsGroupView] = useState(false);

// 변경 후
type ViewMode = 'list' | 'group' | 'graph';
const [viewMode, setViewMode] = useState<ViewMode>('list');
```

---

## 8. 구현 순서

| 단계 | 작업 | 파일 | 예상 소요 |
|------|------|------|---------|
| 1 | 타입 정의 | `src/types/graph.ts` | 30분 |
| 2 | API 엔드포인트 구현 | `src/app/api/memos/graph/route.ts` | 2시간 |
| 3 | useMemoGraph 훅 | `src/hooks/useMemoGraph.ts` | 1시간 |
| 4 | react-force-graph-2d 설치 | `package.json` | 10분 |
| 5 | MemoGraphView 컴포넌트 | `src/components/memos/memo-graph-view.tsx` | 2시간 |
| 6 | MemoGraphControls 컴포넌트 | `src/components/memos/memo-graph-controls.tsx` | 1시간 |
| 7 | MemoGraphEmpty 컴포넌트 | `src/components/memos/memo-graph-empty.tsx` | 30분 |
| 8 | memo-list.tsx 탭 확장 | `src/components/memos/memo-list.tsx` | 1시간 |
| 9 | 통합 테스트 및 경계 케이스 처리 | — | 1시간 |

**총 예상 소요: 약 9시간**

---

## 9. 성공 기준

### 9.1 Definition of Done

- [ ] 그래프 탭 클릭 시 force-directed 그래프가 정상 렌더링됨
- [ ] 노드 클릭 시 MemoViewModal이 올바른 메모 내용으로 열림
- [ ] 유사도 임계값 슬라이더 조작 시 링크 수가 실시간 변경됨
- [ ] 메모 0개 / 연결 없음 상태에서 빈 상태 메시지가 표시됨
- [ ] 인증되지 않은 요청에 대해 `/api/memos/graph`가 401을 반환함
- [ ] 기존 목록/그룹 탭 기능이 정상 동작함 (회귀 없음)
- [ ] 500줄 제한 준수 (모든 신규 파일)

### 9.2 Quality Criteria

- [ ] Zero lint errors
- [ ] TypeScript strict 모드 통과
- [ ] 빌드 성공
- [ ] 메모 50개 기준 그래프 API 응답 3초 이내

---

## 10. 위험 요소 및 대응

| 위험 | 영향도 | 발생 가능성 | 대응 방안 |
|------|-------|-----------|---------|
| react-force-graph-2d SSR 충돌 (Next.js) | High | High | `dynamic(() => import(...), { ssr: false })`로 클라이언트 전용 렌더링 |
| 메모 수 증가 시 유사도 계산 성능 저하 | High | Medium | 각 메모당 상위 5개 유사도만 계산, 향후 pre-compute 캐싱 검토 |
| memo_embeddings 누락 메모 존재 | Medium | Medium | embedding 없는 메모는 노드만 표시 (링크 없음), 별도 안내 불필요 |
| 모바일 환경에서 캔버스 터치 이슈 | Low | Medium | react-force-graph-2d 기본 터치 지원 확인, 미지원 시 모바일 fallback 안내 |

---

## 11. Architecture Considerations

### 11.1 프로젝트 레벨

**Dynamic** — 기존 CLIO 프로젝트 레벨 유지. feature 기반 컴포넌트 분리 패턴 적용.

### 11.2 주요 기술 결정

| 결정 | 선택 | 근거 |
|------|------|------|
| 그래프 라이브러리 | react-force-graph-2d | Canvas 기반 고성능 렌더링, force simulation 내장, React 친화적 |
| 유사도 임계값 적용 | 클라이언트 필터링 | API는 threshold=0.7 이상 링크 전체 반환 → 클라이언트에서 threshold 슬라이더로 실시간 필터. 재API 호출 불필요 |
| SSR 처리 | dynamic import (ssr: false) | Canvas API는 서버 환경에서 동작하지 않음 |
| 기존 API 재사용 | match_memo_embeddings RPC | 신규 AI 비용 없이 기존 인프라 활용 |

### 11.3 폴더 역할 분리 (5대 원칙 #5)

```
components/memos/     → UI 렌더링만 (memo-graph-view, controls, empty)
hooks/                → 상태 + API 호출 (useMemoGraph)
types/                → 타입 정의 (graph.ts)
app/api/memos/graph/  → 서버 API 라우트
```

---

## 12. Convention Prerequisites

### 12.1 환경 변수

신규 환경 변수 불필요. 기존 Supabase 연결 정보 재사용.

### 12.2 의존성 추가

```bash
npm install react-force-graph-2d
```

| 패키지 | 버전 | 용도 |
|-------|------|------|
| react-force-graph-2d | latest | force-directed 그래프 렌더링 |

---

## 13. Next Steps

1. [ ] CTO(대장) 검토 및 Plan 승인
2. [ ] Design 문서 작성 (`memo-graph.design.md`)
3. [ ] `react-force-graph-2d` 라이브러리 사전 조사 (SSR 이슈 확인)
4. [ ] 구현 시작

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-20 | 초안 작성 | Product Manager |
