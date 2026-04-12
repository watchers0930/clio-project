# 메시징 및 채널

[coverage: medium -- 2 sources: supabase/schema.sql, clio-next-phase.plan.md]

---

## Purpose

CLIO는 사내 채팅 기능으로 DM/채널 기반 메시지 시스템을 제공한다.  
채널은 부서 단위 또는 그룹/개인 DM으로 구성된다.

---

## 채널 유형

| 타입 | 설명 |
|------|------|
| `department` | 부서 채널 (자동 생성) |
| `direct` | 1:1 DM |
| `group` | 그룹 채팅 |

---

## 데이터 구조

### channels
```sql
CREATE TABLE channels (
  id            uuid PRIMARY KEY,
  name          text NOT NULL,
  type          text DEFAULT 'department', -- department | direct | group
  department_id uuid REFERENCES departments(id),
  created_at    timestamptz
);
```

### channel_members
```sql
CREATE TABLE channel_members (
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  joined_at  timestamptz,
  PRIMARY KEY (channel_id, user_id)
);
```

### messages
```sql
CREATE TABLE messages (
  id              uuid PRIMARY KEY,
  channel_id      uuid REFERENCES channels(id) ON DELETE CASCADE,
  sender_id       uuid REFERENCES users(id),
  content         text NOT NULL,
  attachment_name text,   -- 첨부 파일명
  attachment_size text,   -- 첨부 파일 크기 (표시용 문자열)
  document_id     uuid,   -- 연결된 문서 ID (선택)
  created_at      timestamptz
);
```

---

## 현재 구현: Supabase Realtime (P2-1 완료 — v5.5.0)

- **setInterval 폴링 완전 제거** — Supabase Realtime `postgres_changes` 구독으로 전환
- 채널 전환 시 `removeChannel()` 정리 (메모리 누수 방지)
- 초기 메시지 로드는 기존 fetch 유지, Realtime은 신규 INSERT만 수신

```typescript
// 실제 구현 (src/app/(app)/messages/page.tsx)
const sub = supabase
  .channel(`messages:${channelId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `channel_id=eq.${channelId}`,
  }, (payload) => {
    setMessages((prev) => [...prev, payload.new as Message]);
  })
  .subscribe();

// 채널 이탈 시 정리
return () => { supabase.removeChannel(sub); };
```

**효과:** 메시지 즉시 수신, setInterval 서버 부하 완전 제거

---

## RLS 정책

| 정책 | 조건 |
|------|------|
| messages SELECT | 채널 멤버(`channel_members.user_id = auth.uid()`)만 조회 |
| messages INSERT | `sender_id = auth.uid()` |
| channel_members SELECT | 인증 사용자 전체 |
| channel_members INSERT | `user_id = auth.uid()` |
| channel_members DELETE | `user_id = auth.uid()` |

---

## API Routes (메시지)

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/api/messages` | GET/POST | 메시지 조회 / 전송 |
| `/api/chat` | POST | AI 문서 Q&A (P2-3 구현됨 — fileIds 범위 지정 지원) |

---

## Sources

- `/Users/watchers/Desktop/clio-project/supabase/schema.sql`
- `/Users/watchers/Desktop/clio-project/docs/01-plan/features/clio-next-phase.plan.md`
