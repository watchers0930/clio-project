# 데이터베이스 스키마 및 RLS 정책

[coverage: high -- 3 sources: supabase/schema.sql, supabase/migrations/, src/lib/supabase/types.ts]

---

## Purpose

CLIO는 Supabase PostgreSQL을 사용하며, pgvector 확장으로 파일 청크 벡터 검색을 지원한다.  
모든 테이블에 Row Level Security(RLS)가 활성화되어 있다.

---

## 테이블 목록

| 테이블 | 설명 |
|--------|------|
| `departments` | 부서 마스터 |
| `users` | 사용자 프로필 (auth.users 확장) |
| `files` | 업로드 파일 메타데이터 |
| `file_chunks` | 파일 벡터 청크 (pgvector) |
| `templates` | 문서 템플릿 |
| `documents` | AI 생성 문서 |
| `channels` | 메시징 채널 |
| `channel_members` | 채널-사용자 매핑 |
| `messages` | 채팅 메시지 |
| `approvals` | 결재 요청/처리 |
| `events` | 공유 캘린더 일정 |
| `todos` | 개인 할일 목록 |
| `audit_logs` | 사용자 활동 감사 로그 |

---

## 핵심 스키마

### users

```sql
CREATE TABLE public.users (
  id            uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email         text UNIQUE NOT NULL,
  name          text NOT NULL,
  position      text DEFAULT '',    -- migration 006에서 추가
  department_id uuid REFERENCES departments(id),
  role          text DEFAULT 'user', -- admin | manager | user
  avatar_url    text,
  signature_path text,             -- migration 007에서 추가 (서명 이미지 경로)
  created_at    timestamptz DEFAULT now()
);
```

### file_chunks (벡터 검색)

```sql
-- pgvector 확장 필요
-- match_file_chunks 함수로 코사인 유사도 검색
CREATE TABLE file_chunks (
  id          uuid PRIMARY KEY,
  file_id     uuid REFERENCES files(id),
  content     text,
  chunk_index int,
  embedding   vector,   -- pgvector 타입
  token_count int,
  created_at  timestamptz
);
```

**DB 함수:**
```sql
FUNCTION match_file_chunks(
  query_embedding: string,
  match_count: number,
  match_threshold: number
) RETURNS { id, file_id, content, chunk_index, token_count, similarity }[]
```

### approvals

```sql
CREATE TABLE public.approvals (
  id           uuid PRIMARY KEY,
  document_id  uuid REFERENCES documents(id) ON DELETE CASCADE,
  requester_id uuid REFERENCES users(id) ON DELETE CASCADE,
  approver_id  uuid REFERENCES users(id) ON DELETE CASCADE,
  status       text DEFAULT 'pending', -- pending | approved | rejected
  comment      text,
  requested_at timestamptz DEFAULT now(),
  decided_at   timestamptz
);
```

---

## 마이그레이션 파일 목록

| 파일 | 내용 |
|------|------|
| `schema.sql` | 기본 스키마 (departments, users, files, templates, documents, channels, messages, audit_logs, events, todos) |
| `migration-ai-pipeline.sql` | AI 파이프라인 (file_chunks, match_file_chunks 함수) |
| `migration-file-shares.sql` | 파일 공유 기능 |
| `migration-permissions.sql` | 추가 권한 정책 |
| `003_template_file.sql` | 템플릿 파일 연동 |
| `004_approval_workflow.sql` | 결재 워크플로우 (approvals 테이블) |
| `005_schedule_todo.sql` | 일정/할일 |
| `006_users_position.sql` | users.position 컬럼 추가 |
| `007_users_signature.sql` | users.signature_path 컬럼 추가 |
| `008_documents_version.sql` | 문서 버전 관리 (parent_id) |

---

## RLS 정책 요약

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| departments | 인증 사용자 전체 | - | - | - |
| users | 인증 사용자 전체 | `auth.uid() = id` | 본인만 | - |
| files | 본인 또는 같은 부서 | `uploaded_by = auth.uid()` | 본인만 | 본인만 |
| templates | 전사(company) 또는 같은 부서 | `created_by = auth.uid()` | 본인만 | - |
| documents | 본인 또는 같은 부서 사용자 | `created_by = auth.uid()` | 본인만 | - |
| channels | 인증 사용자 전체 | 인증 사용자 | - | - |
| messages | 채널 멤버만 | `sender_id = auth.uid()` | - | - |
| approvals | 요청자 또는 결재자 | `requester_id = auth.uid()` | `approver_id = auth.uid()` | - |
| events | 전사 또는 같은 부서 또는 본인 | `created_by = auth.uid()` | 본인만 | 본인만 |
| todos | 본인만 (all) | 본인만 | - | - |
| audit_logs | 본인 로그만 | `user_id = auth.uid()` | - | - |

---

## 트리거

```sql
-- files, templates 업데이트 시 updated_at 자동 갱신
handle_updated_at() → set_files_updated_at, set_templates_updated_at

-- events, todos 동일 패턴
set_events_updated_at, set_todos_updated_at
```

---

## Supabase 클라이언트 파일

| 파일 | 용도 |
|------|------|
| `src/lib/supabase/client.ts` | 브라우저 클라이언트 (CSR) |
| `src/lib/supabase/server.ts` | 서버 클라이언트 (SSR/API Routes) |
| `src/lib/supabase/middleware.ts` | 미들웨어용 클라이언트 |
| `src/lib/supabase/admin.ts` | 서비스 롤 클라이언트 (RLS 우회) |
| `src/lib/supabase/types.ts` | DB 타입 정의 전체 |

---

## Sources

- `/Users/watchers/Desktop/clio-project/supabase/schema.sql`
- `/Users/watchers/Desktop/clio-project/supabase/migrations/`
- `/Users/watchers/Desktop/clio-project/src/lib/supabase/types.ts`
