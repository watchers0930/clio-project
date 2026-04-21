# CLIO 데이터 스키마 빠른 참조

**최종 업데이트:** 2026-04-20 (v7.2.0 기준)

---

## 테이블 관계도

```
auth.users (Supabase Auth)
    │
    └── users (1:1 확장)
           ├── department_id → departments
           └── role: admin | manager | user

departments
    └── 여러 users, files, templates, channels, events

files ──→ file_chunks (1:N, 벡터 임베딩)
    ├── uploaded_by → users
    └── scope: 'company' | 'department'  ← migration 014

templates
    └── created_by → users

documents
    ├── template_id → templates
    ├── source_file_ids: uuid[] (다중 파일 참조)
    ├── created_by → users
    ├── parent_id → documents (이전 버전 루트 ID)  ← migration 008
    └── version_number: int (기본값 1)              ← migration 008

document_comments  ← migration 015 (approvals 대체)
    ├── document_id → documents
    └── user_id → users

document_quality_checks  ← migration 010
    ├── document_id → documents
    └── checked_by → users

shared_links  ← migration 009
    └── created_by → users

contract_risk_analyses  ← migration 011
    └── user_id → users

todo_extractions  ← migration 013
    └── extracted_by → users

channels
    └── channel_members (N:M, users ↔ channels)
    └── messages
          └── sender_id → users

events
    └── created_by → users

todos
    └── user_id → users

audit_logs
    └── user_id → users

memos  ← migration 016
    └── created_by → users
    ├── memo_embeddings  ← migration 021 (pgvector, 1:1)
    └── memo_groups      ← migration 021 (클러스터 캐시, TTL 1h)

autofill_sessions  ← migration 017
    └── user_id → users

contract_clause_fixes  ← migration 018
    ├── analysis_id → contract_risk_analyses
    └── user_id → users

law_chunks  ← migration 019
    └── (독립 테이블, 공공 법령 데이터)

work_logs  ← migration 020
    ├── user_id → users
    └── UNIQUE(user_id, log_date)

work_log_attachments  ← migration 020
    ├── log_id → work_logs
    ├── document_id → documents (nullable)
    └── file_id → files (nullable, 둘 중 하나만 non-NULL)
```

> `approvals` 테이블은 **migration 015에서 DROP** (v6.3.0). `document_comments`로 대체.

---

## 열거형 타입 (TypeScript)

```typescript
type UserRole       = 'admin' | 'manager' | 'user';
type FileStatus     = 'uploading' | 'processing' | 'completed' | 'indexed' | 'error';
type TemplateScope  = 'department' | 'company';
type TemplateType   = TemplateScope;                 // 레거시 alias
type DocumentStatus = 'draft' | 'completed';         // v6.3.0: submitted/approved/rejected 제거
type ChannelType    = 'department' | 'direct' | 'group';
type EventType      = 'meeting' | 'deadline' | 'personal' | 'company' | 'other';
type TodoPriority   = 'high' | 'medium' | 'low';
type TodoStatus     = 'active' | 'completed';

// AI 품질 검수 (migration 010)
type QualityCategory = 'spelling' | 'format' | 'logic' | 'missing';
type QualitySeverity = 'error' | 'warning' | 'suggestion';
```

---

## 마이그레이션 순서

```
schema.sql                       → 기본 9개 테이블 + events + todos + RLS 전체
migration-ai-pipeline.sql        → file_chunks + match_file_chunks 함수
migration-file-shares.sql        → 파일 공유
migration-permissions.sql        → 추가 권한
003_template_file.sql            → 템플릿 파일 연동
004_approval_workflow.sql        → approvals 테이블 (015에서 DROP됨)
005_schedule_todo.sql            → 일정/할일 추가
006_users_position.sql           → users.position TEXT 컬럼
007_users_signature.sql          → users.signature_path TEXT 컬럼
008_documents_version.sql        → documents.parent_id + version_number
009_shared_links.sql             → shared_links 테이블 (외부 공유 링크)
010_document_quality_checks.sql  → document_quality_checks 테이블 (AI 검수)
011_contract_risk.sql            → contract_risk_analyses 테이블 (계약서 리스크)
012_schedules_expiry.sql         → schedules: source_type, source_id, expiry_confidence 컬럼
013_meeting_todos.sql            → todo_extractions 테이블 (회의록 할일 추출 이력)
014_files_scope.sql              → files.scope 컬럼 + files_select RLS 교체
015_drop_approvals_add_comments.sql → approvals DROP + document_comments 생성
016_memos.sql                    → memos 테이블 (개인 메모)
017_autofill_sessions.sql        → autofill_sessions 테이블 (문서 자동채우기)
018_contract_clause_fixes.sql    → contract_clause_fixes 테이블 (계약 조항 수정 이력)
019_law_chunks.sql               → law_chunks 테이블 + match_law_chunks RPC (법령 RAG)
020_work_logs.sql                → work_logs + work_log_attachments 테이블 (업무일지)
021_memo_embeddings.sql          → memo_embeddings + memo_groups + match_memo_embeddings RPC (메모 pgvector 인사이트)
```

---

## 주요 DB 함수

```sql
-- pgvector 코사인 유사도 검색
match_file_chunks(
  query_embedding TEXT,    -- 검색 벡터 (직렬화)
  match_count     INT,     -- 반환 최대 개수
  match_threshold FLOAT    -- 유사도 임계값 (0~1)
) RETURNS TABLE(
  id, file_id, content, chunk_index, token_count, similarity
);

-- contract_risk_analyses updated_at 자동 갱신 트리거 함수 (migration 011)
update_contract_risk_updated_at() RETURNS TRIGGER;

-- files, templates, events, todos updated_at 자동 갱신 (schema.sql 공통)
handle_updated_at() RETURNS TRIGGER;

-- 메모 연관 유사도 검색 (migration 021)
match_memo_embeddings(
  query_embedding      vector(1536),
  match_user_id        UUID,
  exclude_memo_id      UUID,
  match_count          INT DEFAULT 3,
  similarity_threshold FLOAT DEFAULT 0.75
) RETURNS TABLE(memo_id UUID, similarity FLOAT);
```

---

## API 응답 표준 형식

```typescript
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}
```
