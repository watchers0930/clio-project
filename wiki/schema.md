# CLIO 데이터 스키마 빠른 참조

**최종 업데이트:** 2026-04-12 (v5.4.0 기준)

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
    └── uploaded_by → users

templates
    └── created_by → users

documents
    ├── template_id → templates
    ├── source_file_ids: uuid[] (다중 파일 참조)
    └── created_by → users

approvals
    ├── document_id → documents
    ├── requester_id → users
    └── approver_id → users

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

---

## 열거형 타입 (TypeScript)

```typescript
type UserRole       = 'admin' | 'manager' | 'user';
type FileStatus     = 'uploading' | 'processing' | 'completed' | 'indexed' | 'error';
type TemplateScope  = 'department' | 'company';
type DocumentStatus = 'draft' | 'completed' | 'submitted' | 'approved' | 'rejected';
type ApprovalStatus = 'pending' | 'approved' | 'rejected';
type ChannelType    = 'department' | 'direct' | 'group';
type EventType      = 'meeting' | 'deadline' | 'personal' | 'company' | 'other';
type TodoPriority   = 'high' | 'medium' | 'low';
type TodoStatus     = 'active' | 'completed';
```

---

## 마이그레이션 순서

```
schema.sql                  → 기본 9개 테이블
migration-ai-pipeline.sql   → file_chunks + match_file_chunks 함수
migration-file-shares.sql   → 파일 공유
migration-permissions.sql   → 추가 권한
003_template_file.sql       → 템플릿 파일
004_approval_workflow.sql   → approvals 테이블
005_schedule_todo.sql       → events, todos
006_users_position.sql      → users.position TEXT 컬럼
007_users_signature.sql     → users.signature_path TEXT 컬럼
008_documents_version.sql   → 문서 버전 (parent_id 등)
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
