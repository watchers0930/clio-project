# CLIO 메모 인사이트 — 아이디어 허브 계획서

**버전:** v1.0.0  
**작성일:** 2026-04-20  
**상태:** 계획 수립  
**목표 버전:** v7.1.0  
**연계 기능:** 메모(memos), 문서생성(generate), AI 파이프라인(pgvector)

---

## 1. 기능 개요

### 한 줄 정의
"PC·모바일에서 틈틈이 기록한 아이디어들을 AI가 자동으로 연결하고, 새로운 것을 만들어낼 수 있는 허브"

### 배경
현재 클리오의 메모 기능은 단순 CRUD 수준이다.  
파일·문서·회의록 등 완성된 결과물은 잘 관리되지만,  
그 결과물이 만들어지기 **이전 단계 — 생각의 파편들** 을 다루는 기능이 없다.

옵시디언이 "제2의 뇌(second brain)"로 불리듯,  
메모 인사이트는 클리오 안에서 **생각을 조직화하고 실행 가능한 산출물로 연결하는 허브** 가 된다.

### 핵심 가치
- **기록**: PC·모바일 어디서든 아이디어를 빠르게 메모
- **연결**: AI가 유사한 메모들을 자동으로 그룹화
- **창출**: 그룹화된 메모에서 AI가 새로운 아이디어·실행안 제안
- **실행**: 제안 결과를 문서로 생성하거나 새 메모로 저장

---

## 2. 사용자 스토리

| 역할 | 스토리 | 완료 조건 |
|------|--------|----------|
| 일반 직원 | 틈틈이 적어둔 메모들이 자동으로 묶여 있으면 좋겠다 | 그룹 뷰 토글 시 유사 메모 섹션별 표시 |
| 일반 직원 | 비슷한 메모 보다가 "이거 합치면 뭔가 나올 것 같다" 싶을 때 AI 제안을 받고 싶다 | "아이디어 제안받기" 버튼 → 슬라이드 패널에 결과 표시 |
| 일반 직원 | AI 제안 결과를 바로 문서로 만들고 싶다 | 제안 패널에서 "문서로 생성" 클릭 → 기존 문서생성 파이프라인 연결 |
| 일반 직원 | 지금 보는 메모와 비슷한 메모가 뭐가 있는지 알고 싶다 | 메모 열람 시 "관련 메모 N개" 자동 표시 |
| 부서장 | 팀원이 공유한 메모들 중 연관된 아이디어를 한눈에 보고 싶다 | 공유 메모 그룹 뷰 지원 (향후 확장) |

---

## 3. 기능 상세

### 3-1. 자동 그룹화

**동작 방식**
1. 메모 저장·수정 시 `text-embedding-3-small`로 임베딩 생성 (fire-and-forget)
2. `/api/memos/groups` 호출 시 전체 메모 임베딩 로드
3. 코사인 유사도 0.75 이상인 메모끼리 클러스터링
4. 클러스터별로 GPT-4o-mini가 그룹명 자동 작명 (메모 제목 3개 보고 한 줄 요약)
5. 결과를 `memo_groups` 테이블에 저장 (TTL 1시간, 이후 재계산)

**UI**
- 메모 목록 우상단 "그룹 보기" 토글 버튼
- 토글 ON: 그룹별 섹션으로 재정렬 (그룹명 + 소속 메모 카드)
- 그룹에 속하지 않는 메모는 "기타" 섹션으로 분류
- 토글 OFF: 기존 카드 그리드 뷰 (기본값)

---

### 3-2. AI 아이디어 제안

**트리거:** 그룹 섹션 헤더의 "아이디어 제안받기" 버튼 클릭

**처리 흐름**
```
그룹 선택
    ↓
해당 그룹 메모 전체 내용 수집
    ↓
GPT-4o 프롬프트:
  "다음 메모들의 공통 맥락을 파악하고,
   실행 가능한 아이디어 3~5개를 제안하라.
   각 아이디어는 제목·설명·예상 효과로 구성한다."
    ↓
결과: 우측 슬라이드 패널에 표시
    ↓
[이 아이디어를 문서로 만들기] → 문서생성 파이프라인 연결
[새 메모로 저장] → 제안 내용을 메모로 저장
```

**제안 결과 포맷**
```
💡 아이디어 제안 (SNS 마케팅 전략 그룹 기반)

1. Q2 인스타그램 캠페인 기획
   설명: 기록된 트렌드 분석과 경쟁사 사례를 결합해 ...
   예상 효과: 브랜드 인지도 20% 향상 예상

2. 콘텐츠 캘린더 자동화
   ...

[문서로 생성]  [메모로 저장]  [닫기]
```

---

### 3-3. 연관 메모 추천

**동작:** 메모 상세 열람 시 자동으로 유사도 상위 3개 메모 표시

**UI:** 뷰 모달 하단 "관련 메모" 섹션
- 메모 제목 + 유사도 뱃지 (높음/보통)
- 클릭 시 해당 메모로 이동

---

## 4. 화면 구성

### 4-1. 메모 목록 — 그룹 뷰

```
┌─────────────────────────────────────────────┐
│  메모          [+ 새 메모]    [목록 보기 / 그룹 보기]  │
│                                             │
│  ─── SNS 마케팅 전략 (4개) ─────  [아이디어 제안받기] │
│  [메모카드] [메모카드] [메모카드] [메모카드]           │
│                                             │
│  ─── 기술 스택 검토 (3개) ──────  [아이디어 제안받기] │
│  [메모카드] [메모카드] [메모카드]                     │
│                                             │
│  ─── 기타 (2개) ─────────────────────────── │
│  [메모카드] [메모카드]                              │
└─────────────────────────────────────────────┘
```

### 4-2. 아이디어 제안 슬라이드 패널

```
┌──────────────────────┬─────────────────────┐
│  메모 목록           │  💡 아이디어 제안     │
│  (그룹 뷰)           │  SNS 마케팅 전략 기반 │
│                      │                     │
│                      │  1. 캠페인 기획       │
│                      │     설명 ...         │
│                      │                     │
│                      │  2. 콘텐츠 자동화     │
│                      │     설명 ...         │
│                      │                     │
│                      │  [문서로 생성]        │
│                      │  [메모로 저장]        │
└──────────────────────┴─────────────────────┘
```

### 4-3. 메모 뷰 모달 — 관련 메모

```
┌──────────────────────────────────────┐
│  메모 제목                           │
│  내용 ...                            │
│                                      │
│  ─── 관련 메모 ───────────────────── │
│  • SNS 트렌드 분석 노트   [유사도 높음] │
│  • 경쟁사 캠페인 분석     [유사도 보통] │
│  • Q1 마케팅 회고         [유사도 보통] │
└──────────────────────────────────────┘
```

---

## 5. API 설계

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| POST | `/api/memos/[id]/embed` | 메모 임베딩 생성·갱신 | 본인 |
| GET | `/api/memos/groups` | 전체 메모 그룹 조회 (클러스터링) | 본인 |
| POST | `/api/memos/groups/suggest` | 그룹 기반 AI 아이디어 제안 | 본인 |
| GET | `/api/memos/[id]/related` | 연관 메모 상위 3개 조회 | 본인 |

---

## 6. DB 설계

```sql
-- 마이그레이션: 021_memo_embeddings.sql

-- 메모 임베딩
CREATE TABLE memo_embeddings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id    UUID NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  embedding  vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(memo_id)
);

CREATE INDEX idx_memo_embeddings_vector
  ON memo_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 메모 그룹 (클러스터 캐시)
CREATE TABLE memo_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,              -- AI 자동 작명
  memo_ids   UUID[] NOT NULL,            -- 소속 메모 ID 배열
  expires_at TIMESTAMPTZ NOT NULL,       -- TTL 1시간
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memo_groups_user ON memo_groups(user_id);

-- RLS
ALTER TABLE memo_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE memo_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memo_embeddings_own" ON memo_embeddings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memos m
      WHERE m.id = memo_embeddings.memo_id
        AND m.created_by = auth.uid()
    )
  );

CREATE POLICY "memo_groups_own" ON memo_groups
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

---

## 7. 컴포넌트 구조

```
src/
├── app/api/memos/
│   ├── [id]/
│   │   ├── embed/route.ts          # 임베딩 생성
│   │   └── related/route.ts        # 연관 메모
│   └── groups/
│       ├── route.ts                # 그룹 조회
│       └── suggest/route.ts        # AI 아이디어 제안
├── components/memos/
│   ├── MemoGroupView.tsx            # 그룹 섹션 뷰
│   ├── MemoGroupHeader.tsx          # 그룹 헤더 + 제안받기 버튼
│   ├── IdeaSuggestPanel.tsx         # 우측 슬라이드 패널
│   └── RelatedMemos.tsx             # 연관 메모 목록
├── hooks/
│   └── useMemoGroups.ts             # 그룹 조회 + 토글 상태
└── lib/ai/
    └── memo-insight.ts              # 클러스터링 + 제안 프롬프트 로직
```

---

## 8. 구현 순서 및 예상 일정

| 단계 | 작업 | 예상 시간 |
|------|------|----------|
| P1 | DB 마이그레이션 (021_memo_embeddings.sql) | 30분 |
| P1 | 임베딩 API (`/api/memos/[id]/embed`) | 1시간 |
| P1 | 메모 저장·수정 시 임베딩 자동 생성 연결 | 30분 |
| P2 | 클러스터링 + 그룹명 AI 작명 API | 2시간 |
| P2 | 연관 메모 API (`/api/memos/[id]/related`) | 1시간 |
| P3 | 아이디어 제안 API (GPT-4o) | 1시간 |
| P4 | MemoGroupView + MemoGroupHeader UI | 2시간 |
| P4 | IdeaSuggestPanel (슬라이드 패널) | 1.5시간 |
| P4 | RelatedMemos (뷰 모달 내) | 1시간 |
| P5 | 문서생성 파이프라인 연결 | 1시간 |
| **합계** | | **약 11시간** |

---

## 9. 검증 계획

| 항목 | 검증 방법 | 기대 결과 |
|------|----------|----------|
| 임베딩 자동 생성 | 메모 저장 후 memo_embeddings 테이블 확인 | 해당 memo_id 레코드 존재 |
| 그룹화 정확도 | 유사한 주제 메모 5개 + 다른 주제 3개 작성 후 그룹 뷰 | 유사 메모끼리 같은 섹션에 묶임 |
| 그룹명 작명 | 그룹 뷰 토글 시 그룹명 확인 | 내용을 반영한 자연스러운 이름 |
| 아이디어 제안 | 그룹에서 "제안받기" 클릭 | 3~5개 아이디어 슬라이드 패널 표시 |
| 연관 메모 | 메모 열람 시 하단 확인 | 유사도 높은 메모 최대 3개 표시 |
| 문서 연결 | 제안 결과에서 "문서로 생성" 클릭 | 문서생성 모달로 이동, 제안 내용 자동 입력 |
| TTL 캐시 | 1시간 후 그룹 재조회 | 재계산 후 갱신된 그룹 표시 |
| 메모 0개 | 메모 없는 상태에서 그룹 뷰 토글 | "메모를 작성하면 자동으로 그룹화됩니다" 안내 |

---

## 10. 확정 사항

| 항목 | 결정 내용 |
|------|----------|
| 임베딩 모델 | `text-embedding-3-small` (기존 파일 파이프라인과 동일) |
| 유사도 임계값 | 코사인 유사도 0.75 이상 (조정 가능) |
| 그룹 캐시 TTL | 1시간 (메모 수정 시 즉시 무효화) |
| 제안 모델 | GPT-4o (아이디어 제안) / GPT-4o-mini (그룹명 작명) |
| 기본 뷰 | 목록 보기 유지 (그룹 뷰는 토글로 진입) |
| 모바일 지원 | 반응형 (기존 클리오 반응형 기준 동일 적용) |
