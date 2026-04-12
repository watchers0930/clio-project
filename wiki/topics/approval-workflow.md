# 결재 워크플로우

[coverage: high -- 2 sources: supabase/migrations/004_approval_workflow.sql, src/lib/supabase/types.ts]

---

## Purpose

CLIO의 결재 시스템은 AI로 생성된 문서를 조직 내에서 공식 승인·반려하는 워크플로우를 제공한다.  
문서 작성자(requester)가 결재자(approver)를 지정하고, 결재자가 승인 또는 반려한다.

---

## 결재 상태 흐름

```
[문서 생성] 
    ↓
[결재 요청] → status: 'pending'
    ↓
[결재자 검토]
    ├── 승인 → status: 'approved', decided_at 기록
    └── 반려 → status: 'rejected', comment 기록, decided_at 기록
```

---

## 데이터 스키마 (approvals 테이블)

```sql
CREATE TABLE public.approvals (
  id            uuid PRIMARY KEY,
  document_id   uuid REFERENCES documents(id) ON DELETE CASCADE,
  requester_id  uuid REFERENCES users(id) ON DELETE CASCADE,
  approver_id   uuid REFERENCES users(id) ON DELETE CASCADE,
  status        text DEFAULT 'pending',   -- pending | approved | rejected
  comment       text,                     -- 반려 사유 또는 승인 메모
  requested_at  timestamptz DEFAULT now(),
  decided_at    timestamptz               -- 결재 처리 시각
);
```

---

## RLS 정책

| 정책 | 조건 |
|------|------|
| SELECT | 요청자(`requester_id`) 또는 결재자(`approver_id`) 본인만 조회 |
| INSERT | 요청자 본인만 (`requester_id = auth.uid()`) |
| UPDATE | 결재자 본인만 (`approver_id = auth.uid()`) — 승인/반려 처리 |

---

## 인덱스

```sql
idx_approvals_document   -- document_id 기준
idx_approvals_approver   -- (approver_id, status) 복합 — 결재함 조회 최적화
idx_approvals_requester  -- requester_id 기준
```

---

## API Routes (결재)

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/api/approvals` | GET/POST | 결재 목록 조회 / 결재 요청 |
| `/api/approvals/[id]` | PATCH | 승인 또는 반려 처리 |

---

## UI 구조

- `src/app/(app)/approvals/` — 결재함 페이지
- 결재 대기함 / 처리된 결재 / 내가 요청한 결재 탭 구분
- 문서 상태(`documents.status`)도 함께 업데이트: `submitted` → `approved` / `rejected`

---

## 연관 타입

```typescript
type ApprovalStatus = 'pending' | 'approved' | 'rejected';
type DocumentStatus = 'draft' | 'completed' | 'submitted' | 'approved' | 'rejected';
```

---

## Sources

- `/Users/watchers/Desktop/clio-project/supabase/migrations/004_approval_workflow.sql`
- `/Users/watchers/Desktop/clio-project/src/lib/supabase/types.ts`
- `/Users/watchers/Desktop/clio-project/docs/01-plan/features/clio-next-phase.plan.md`
