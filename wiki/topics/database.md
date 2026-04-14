# 데이터베이스

[coverage: high -- sources: supabase/schema.sql, supabase/migrations/003~015, src/lib/supabase/types.ts]

---

## Purpose [coverage: high]

CLIO는 Supabase PostgreSQL을 사용한다. pgvector 확장으로 파일 청크 벡터 임베딩 및 코사인 유사도 검색을 지원하며, 모든 테이블에 Row Level Security(RLS)가 활성화되어 있다.

- **벡터 검색**: `file_chunks.embedding` 컬럼 (pgvector) + `match_file_chunks()` 함수
- **인증 연동**: `users` 테이블이 `auth.users`를 1:1 확장 (CASCADE 삭제)
- **버전 관리**: `documents.parent_id` + `version_number` (migration 008)

---

## 테이블 구조 (전체) [coverage: high]

### 현재 유효한 테이블 목록 (v6.4.0 기준)

| 테이블 | 생성 위치 | 설명 |
|--------|-----------|------|
| `departments` | schema.sql | 부서 마스터 |
| `users` | schema.sql | 사용자 프로필 (auth.users 확장) |
| `files` | schema.sql | 업로드 파일 메타데이터 |
| `file_chunks` | migration-ai-pipeline.sql | 파일 벡터 청크 (pgvector) |
| `templates` | schema.sql | 문서 템플릿 |
| `documents` | schema.sql | AI 생성 문서 (버전 관리 포함) |
| `document_comments` | migration 015 | 문서 댓글 (v6.3.0 신규, approvals 대체) |
| `document_quality_checks` | migration 010 | AI 문서 품질 검수 결과 |
| `channels` | schema.sql | 메시징 채널 |
| `channel_members` | schema.sql | 채널-사용자 매핑 |
| `messages` | schema.sql | 채팅 메시지 |
| `events` | schema.sql | 공유 캘린더 일정 |
| `todos` | schema.sql | 개인 할일 목록 |
| `audit_logs` | schema.sql | 사용자 활동 감사 로그 |
| `shared_links` | migration 009 | 외부 공유 링크 |
| `contract_risk_analyses` | migration 011 | 계약서 AI 리스크 분석 결과 |
| `todo_extractions` | migration 013 | 회의록 할일 추출 이력 |

> `approvals` 테이블은 **migration 015에서 DROP** (v6.3.0). `DocumentStatus`에서 `submitted | approved | rejected` 상태도 `completed`로 일괄 변환됨.

---

### departments

```sql
CREATE TABLE public.departments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  code       TEXT UNIQUE NOT NULL,   -- 부서 코드 (예: DEV, HR)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### users

```sql
CREATE TABLE public.users (
  id             UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email          TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  department_id  UUID REFERENCES departments(id) ON DELETE SET NULL,
  role           TEXT NOT NULL DEFAULT 'user',  -- admin | manager | user
  avatar_url     TEXT,
  position       TEXT DEFAULT '',               -- migration 006 추가
  signature_path TEXT,                          -- migration 007 추가 (서명 이미지 경로)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### files

```sql
CREATE TABLE public.files (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  type          TEXT,              -- MIME 타입
  size          BIGINT DEFAULT 0,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'completed',  -- uploading | processing | completed | error
  storage_path  TEXT,
  scope         TEXT NOT NULL DEFAULT 'department'  -- migration 014 추가
                  CHECK (scope IN ('company', 'department')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### file_chunks (벡터 검색)

```sql
CREATE TABLE file_chunks (
  id          UUID PRIMARY KEY,
  file_id     UUID REFERENCES files(id),
  content     TEXT,
  chunk_index INT,
  embedding   VECTOR,   -- pgvector 타입
  token_count INT,
  created_at  TIMESTAMPTZ
);
```

### templates

```sql
CREATE TABLE public.templates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  description   TEXT,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  scope         TEXT NOT NULL DEFAULT 'company',  -- department | company
  icon          TEXT,
  content       TEXT,
  placeholders  JSONB DEFAULT '[]',
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### documents

```sql
CREATE TABLE public.documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  content         TEXT,
  template_id     UUID REFERENCES templates(id) ON DELETE SET NULL,
  source_file_ids UUID[] DEFAULT '{}',
  instructions    TEXT,
  status          TEXT NOT NULL DEFAULT 'completed',  -- draft | completed
  storage_path    TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  parent_id       UUID REFERENCES documents(id) ON DELETE SET NULL,  -- migration 008
  version_number  INT NOT NULL DEFAULT 1,                            -- migration 008
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`parent_id`: v1 문서는 NULL, v2 이상은 루트(v1) 문서 ID 참조.

### document_comments (migration 015, v6.3.0)

```sql
CREATE TABLE document_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) > 0),
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

### document_quality_checks (migration 010)

```sql
CREATE TABLE public.document_quality_checks (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  checked_by    UUID NOT NULL REFERENCES users(id),
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  result_json   JSONB NOT NULL,   -- QualityCheckResult 타입 전체 구조
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

### shared_links (migration 009)

```sql
CREATE TABLE public.shared_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token         TEXT UNIQUE NOT NULL,                                  -- 32자 hex 토큰
  resource_type TEXT NOT NULL CHECK (resource_type IN ('document', 'file')),
  resource_id   UUID NOT NULL,
  title         TEXT,
  expires_at    TIMESTAMPTZ,
  password_hash TEXT,
  view_count    INT NOT NULL DEFAULT 0,
  created_by    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### contract_risk_analyses (migration 011)

```sql
CREATE TABLE contract_risk_analyses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  file_type     TEXT NOT NULL,     -- 'docx' | 'hwpx' | 'pdf'
  contract_type TEXT NOT NULL,     -- 'system' | 'maintenance' | 'software' | 'general'
  perspective   TEXT NOT NULL DEFAULT 'seller_side',  -- 'seller_side' | 'buyer_side'
  raw_text      TEXT,
  risk_result   JSONB NOT NULL DEFAULT '{}',
  risk_count    JSONB NOT NULL DEFAULT '{"high":0,"medium":0,"low":0}',
  status        TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'processing' | 'done' | 'error'
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### todo_extractions (migration 013)

회의록에서 할일을 추출했을 때 이력을 기록하여 동일 문서 중복 추출을 방지한다.

```sql
CREATE TABLE public.todo_extractions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id  UUID NOT NULL,                   -- documents.id (FK 없음 — 유연성 확보)
  extracted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  todo_ids     UUID[] NOT NULL DEFAULT '{}',    -- 실제 등록된 todos.id 배열
  todo_count   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### events (schema.sql + migration 012 컬럼 추가)

migration 012는 `schedules` 테이블에 컬럼을 추가한다. CLIO의 실제 일정 테이블은 schema.sql의 `events`이며, `schedules`는 별도 테이블일 가능성이 있다. migration 012 원문 기준으로 정리:

```sql
-- migration 012: schedules 테이블에 추가된 컬럼
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS source_type      TEXT,  -- 'document_expiry' | NULL
  ADD COLUMN IF NOT EXISTS source_id        UUID,  -- files.id 역참조
  ADD COLUMN IF NOT EXISTS expiry_confidence TEXT; -- 'high' | 'low' | 'none'
```

events 테이블(schema.sql):

```sql
CREATE TABLE public.events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  description   TEXT,
  location      TEXT,
  event_type    TEXT NOT NULL DEFAULT 'meeting',  -- meeting | deadline | personal | company | other
  start_at      TIMESTAMPTZ NOT NULL,
  end_at        TIMESTAMPTZ NOT NULL,
  all_day       BOOLEAN NOT NULL DEFAULT false,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_by    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### todos (schema.sql)

```sql
CREATE TABLE public.todos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  description  TEXT,
  due_date     DATE,
  priority     TEXT NOT NULL DEFAULT 'medium',  -- high | medium | low
  status       TEXT NOT NULL DEFAULT 'active',  -- active | completed
  completed_at TIMESTAMPTZ,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### channels / channel_members / messages (schema.sql)

```sql
CREATE TABLE public.channels (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'department',  -- department | direct | group
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.channel_members (
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE public.messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id      UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  sender_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  content         TEXT NOT NULL,
  attachment_name TEXT,
  attachment_size TEXT,
  document_id     UUID,  -- 문서 공유 시 참조 (migration-ai-pipeline 이후 추가)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### audit_logs (schema.sql)

```sql
CREATE TABLE public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,    -- 예: file.upload, doc.create
  target_type TEXT,
  target_id   UUID,
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 마이그레이션 히스토리 [coverage: high]

| 파일 | 내용 |
|------|------|
| `schema.sql` | 기본 9개 테이블 (departments, users, files, templates, documents, channels, channel_members, messages, audit_logs) + events + todos + RLS 전체 |
| `migration-ai-pipeline.sql` | file_chunks 테이블 + match_file_chunks 함수 (pgvector) |
| `migration-file-shares.sql` | 파일 공유 기능 |
| `migration-permissions.sql` | 추가 권한 정책 |
| `003_template_file.sql` | 템플릿 파일 연동 |
| `004_approval_workflow.sql` | approvals 테이블 (migration 015에서 DROP됨) |
| `005_schedule_todo.sql` | 일정/할일 관련 추가 |
| `006_users_position.sql` | users.position TEXT 컬럼 추가 |
| `007_users_signature.sql` | users.signature_path TEXT 컬럼 추가 |
| `008_documents_version.sql` | documents.parent_id + version_number 추가 (문서 버전 관리) |
| `009_shared_links.sql` | shared_links 테이블 생성 (외부 공유 링크, token 기반) |
| `010_document_quality_checks.sql` | document_quality_checks 테이블 생성 (AI 품질 검수 결과 캐시) |
| `011_contract_risk.sql` | contract_risk_analyses 테이블 생성 (계약서 AI 리스크 분석) |
| `012_schedules_expiry.sql` | schedules 테이블에 source_type, source_id, expiry_confidence 컬럼 추가 |
| `013_meeting_todos.sql` | todo_extractions 테이블 생성 (회의록 할일 추출 이력, 중복 방지) |
| `014_files_scope.sql` | files.scope 컬럼 추가 ('company' \| 'department') + files_select RLS 정책 교체 |
| `015_drop_approvals_add_comments.sql` | approvals DROP + documents status 정리 + document_comments 생성 |

---

## RLS 정책 [coverage: high]

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `departments` | 인증 사용자 전체 | - | - | - |
| `users` | 인증 사용자 전체 | `auth.uid() = id` | 본인만 | - |
| `files` | scope=company OR 본인 OR 같은 부서 | `uploaded_by = auth.uid()` | 본인만 | 본인만 |
| `file_chunks` | (파이프라인 내부, RLS 별도) | - | - | - |
| `templates` | scope=company OR 같은 부서 | `created_by = auth.uid()` | 본인만 | - |
| `documents` | 본인 OR 같은 부서 사용자 | `created_by = auth.uid()` | 본인만 | - |
| `document_comments` | 로그인한 모든 사용자 | `user_id = auth.uid()` | - | 본인만 |
| `document_quality_checks` | 본인 checked_by OR 문서 작성자 | `checked_by = auth.uid()` | - | - |
| `shared_links` | `created_by = auth.uid()` (ALL) | | | |
| `contract_risk_analyses` | `user_id = auth.uid()` | `user_id = auth.uid()` | `user_id = auth.uid()` | `user_id = auth.uid()` |
| `channels` | 인증 사용자 전체 | 인증 사용자 | - | - |
| `channel_members` | 인증 사용자 전체 | `user_id = auth.uid()` | - | `user_id = auth.uid()` |
| `messages` | 채널 멤버만 | `sender_id = auth.uid()` | - | - |
| `events` | 전사(NULL) OR 같은 부서 OR 본인 | `created_by = auth.uid()` | 본인만 | 본인만 |
| `todos` | `user_id = auth.uid()` (ALL) | | | |
| `audit_logs` | `user_id = auth.uid()` | `user_id = auth.uid()` | - | - |
| `todo_extractions` | `extracted_by = auth.uid()` | `extracted_by = auth.uid()` | - | - |

**files_select 주의**: migration 014에서 기존 정책이 교체됨. `scope = 'company'` 조건이 앞에 추가되어 전사 공개 파일은 모든 인증 사용자가 열람 가능하다.

---

## DB 함수 [coverage: high]

### match_file_chunks (pgvector 코사인 유사도 검색)

```sql
FUNCTION match_file_chunks(
  query_embedding TEXT,    -- 직렬화된 검색 벡터
  match_count     INT,     -- 반환할 최대 청크 수
  match_threshold FLOAT    -- 유사도 임계값 (0~1)
) RETURNS TABLE (
  id          UUID,
  file_id     UUID,
  content     TEXT,
  chunk_index INT,
  token_count INT,
  similarity  FLOAT
);
```

TypeScript 타입 위치: `src/lib/supabase/types.ts` → `Database.public.Functions.match_file_chunks`

### update_contract_risk_updated_at (migration 011)

```sql
CREATE OR REPLACE FUNCTION update_contract_risk_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

`contract_risk_analyses` 테이블에 BEFORE UPDATE 트리거로 연결됨.

### handle_updated_at (schema.sql 공통)

`files`, `templates`, `events`, `todos` 테이블의 BEFORE UPDATE 트리거로 `updated_at` 자동 갱신.

---

## 열거형 타입 [coverage: high]

TypeScript 소스(`src/lib/supabase/types.ts`) 기준:

```typescript
type UserRole       = 'admin' | 'manager' | 'user';
type FileStatus     = 'uploading' | 'processing' | 'completed' | 'indexed' | 'error';
type TemplateScope  = 'department' | 'company';
type TemplateType   = TemplateScope;                     // 레거시 alias
type DocumentStatus = 'draft' | 'completed';             // v6.3.0: submitted/approved/rejected 제거
type ChannelType    = 'department' | 'direct' | 'group';
type EventType      = 'meeting' | 'deadline' | 'personal' | 'company' | 'other';
type TodoPriority   = 'high' | 'medium' | 'low';
type TodoStatus     = 'active' | 'completed';

// AI 품질 검수 (doc-quality)
type QualityCategory = 'spelling' | 'format' | 'logic' | 'missing';
type QualitySeverity = 'error' | 'warning' | 'suggestion';
```

DB 문자열 컬럼에서 PostgreSQL CHECK 제약으로 관리되며, TypeScript 타입과 1:1 대응한다.

---

## Key Decisions [coverage: high]

1. **approvals 제거 (migration 015)**: 결재 워크플로우 대신 문서 댓글 기반 협업으로 전환. `document_comments` 테이블로 대체.
2. **files.scope 도입 (migration 014)**: 파일 공개 범위를 company/department 2단계로 관리. RLS SELECT 정책 완전 교체.
3. **문서 버전 관리 (migration 008)**: `parent_id` + `version_number`로 댓글 반영 시 이전 버전을 보존하는 불변(immutable) 버전 체인 구현.
4. **todo_extractions FK 없음 (migration 013)**: `document_id`가 외래 키 없이 UUID로만 참조됨. 문서 삭제 후에도 추출 이력 유지 목적.
5. **shared_links 토큰 방식 (migration 009)**: 32자 hex 토큰으로 URL 공유. `expires_at` + `password_hash`로 만료/비밀번호 보호 지원.

---

## Gotchas [coverage: high]

- **schedules vs events**: migration 012는 `schedules` 테이블을 ALTER하나, schema.sql에 정의된 일정 테이블은 `events`다. `schedules`가 별도 존재하거나 네이밍 혼용 가능성이 있으므로 실제 DB 확인 필요.
- **document_comments 타입 파일 미등록**: `src/lib/supabase/types.ts`의 `Database.Tables`에 `document_comments`가 아직 포함되지 않음. Supabase 쿼리 시 타입 추론 불가, 수동 타입 캐스팅 필요.
- **DocumentStatus 정리**: migration 015에서 DB는 `submitted/approved/rejected → completed`로 업데이트됐으나, 앱 레벨 타입에 `ApprovalStatus` 잔재가 있으면 제거 필요.
- **files_select 정책 교체**: migration 014가 기존 `files_select` 정책을 DROP 후 재생성함. 이전 정책(본인 OR 같은 부서)에서 `scope = 'company'` 조건이 추가됨.
- **contract_risk_analyses 스키마 한정자**: migration 011에서 `public.` 접두사 없이 생성됨. Supabase CLI 기본 search_path가 `public`이면 문제없으나, 확인 권장.

---

## Sources [coverage: high]

- `/Users/watchers/Desktop/clio-project/supabase/schema.sql`
- `/Users/watchers/Desktop/clio-project/supabase/migration-ai-pipeline.sql`
- `/Users/watchers/Desktop/clio-project/supabase/migrations/003_template_file.sql`
- `/Users/watchers/Desktop/clio-project/supabase/migrations/004_approval_workflow.sql`
- `/Users/watchers/Desktop/clio-project/supabase/migrations/005_schedule_todo.sql`
- `/Users/watchers/Desktop/clio-project/supabase/migrations/006_users_position.sql`
- `/Users/watchers/Desktop/clio-project/supabase/migrations/007_users_signature.sql`
- `/Users/watchers/Desktop/clio-project/supabase/migrations/008_documents_version.sql`
- `/Users/watchers/Desktop/clio-project/supabase/migrations/009_shared_links.sql`
- `/Users/watchers/Desktop/clio-project/supabase/migrations/010_document_quality_checks.sql`
- `/Users/watchers/Desktop/clio-project/supabase/migrations/011_contract_risk.sql`
- `/Users/watchers/Desktop/clio-project/supabase/migrations/012_schedules_expiry.sql`
- `/Users/watchers/Desktop/clio-project/supabase/migrations/013_meeting_todos.sql`
- `/Users/watchers/Desktop/clio-project/supabase/migrations/014_files_scope.sql`
- `/Users/watchers/Desktop/clio-project/supabase/migrations/015_drop_approvals_add_comments.sql`
- `/Users/watchers/Desktop/clio-project/src/lib/supabase/types.ts`
