---
concept: pgvector 다목적 활용 패턴
last_compiled: 2026-04-20
topics_connected: [ai-features, database, memos]
status: active
---

# pgvector 다목적 활용 패턴

## Pattern

CLIO는 단일 pgvector 인프라를 세 가지 전혀 다른 목적에 재활용한다. 파일 시맨틱 검색(file_chunks), 법령 RAG(law_chunks), 메모 유사도(memo_embeddings) — 모두 `text-embedding-3-small` + 코사인 유사도 + ivfflat 인덱스라는 동일한 스택을 사용하지만, 각각 독립 테이블과 RPC 함수를 가진다.

공통 패턴:
1. `text-embedding-3-small`로 텍스트 → `vector(1536)` 변환
2. `ivfflat` 인덱스 (lists=100, `vector_cosine_ops`)
3. 전용 SQL 함수 (`match_*`) — threshold + count 파라미터
4. API 레이어에서 embedding → RPC 호출 → 결과 JOIN

## Instances

- **2026-04-13** in [[../topics/ai-features]]: `file_chunks.embedding` + `match_file_chunks()` — 파일 업로드 파이프라인에서 청킹 후 임베딩. `/api/search`에서 시맨틱 검색.
- **2026-04-13** in [[../topics/ai-features]]: `law_chunks.embedding` + `match_law_chunks()` — 법령 조문 시드 데이터 임베딩. 계약서 리스크 수정 제안 시 RAG 검색.
- **2026-04-20** in [[../topics/memos]]: `memo_embeddings.embedding` + `match_memo_embeddings()` — 메모 저장 후 fire-and-forget 임베딩. 연관 메모 추천 + 그래프 시각화.

## What This Means

신규 AI 기능을 추가할 때마다 새 pgvector 테이블 + RPC 패턴이 복제된다. 이는 의도적인 격리(각 도메인의 RLS 정책 독립)이지만, 동시에 `rawFrom()` 캐스팅 패턴도 반복된다 — `memo_embeddings`, `memo_groups`는 generated types에 미등록 상태로, 타입 안전성이 낮다. 다음 pgvector 도입 시 Supabase CLI로 타입 재생성하거나 수동 타입 파일을 관리하는 전략이 필요하다.

## Sources

- [[../topics/ai-features]]
- [[../topics/database]]
- [[../topics/memos]]
