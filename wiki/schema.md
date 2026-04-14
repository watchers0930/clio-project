# CLIO 데이터 스키마 빠른 참조

**최종 업데이트:** 2026-04-13 (v6.4.0 기준)

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
