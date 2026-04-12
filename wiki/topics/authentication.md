# 인증 및 권한 시스템

[coverage: high -- 3 sources: src/store/auth-store.ts, src/lib/supabase/types.ts, supabase/schema.sql]

---

## Purpose

CLIO의 인증은 **Supabase Auth + JWT 이중 구조**로 동작한다.  
Supabase Auth가 세션을 관리하고, 서버 API 호출 시에는 JWT 토큰을 Authorization 헤더로 전달한다.  
클라이언트 상태는 Zustand `useAuthStore`로 단일 관리한다 (localStorage persist 사용).

---

## Authentication Flow

```
1. 로그인 요청 (POST /api/auth/login)
   └── bcryptjs 비밀번호 검증 → JWT 발급 → Supabase 세션 쿠키 설정

2. 클라이언트
   └── Zustand auth-store에 { token, user } 저장 (persist: token만)
   └── apiClient.setToken(token) → 이후 요청에 Bearer 헤더 자동 첨부

3. Supabase Auth State 리스너 (initAuthListener)
   └── supabase.auth.onAuthStateChange → 세션 갱신 시 fetchMe() 재호출

4. 로그아웃 (POST /api/auth/logout)
   └── supabase.auth.signOut() → 쿠키 삭제 → Zustand 초기화
```

---

## 역할 체계 (RBAC)

| 역할 | 값 | 권한 |
|------|-----|------|
| 관리자 | `admin` | 전체 사용자/부서 관리, 모든 데이터 접근 |
| 매니저 | `manager` | 부서 내 관리 기능 |
| 일반 사용자 | `user` | 본인 데이터 + 부서 공유 데이터 |

권한 로직은 `src/lib/permissions.ts`에 중앙화.

---

## 사용자 데이터 구조

```typescript
// src/lib/supabase/types.ts - User (앱 레벨)
interface User {
  id: string;
  email: string;
  name: string;
  position: string;        // 직급 (migration 006에서 추가)
  department_id?: string | null;
  department?: string;     // 조인 후 부서명
  role: UserRole;          // 'admin' | 'manager' | 'user'
  avatar_url: string | null;
  created_at: string;
}
```

---

## Zustand Auth Store 주요 사항

- **파일:** `src/store/auth-store.ts`
- `persist` 미들웨어 사용: `name: 'clio-auth'`, token만 영속화 (user 객체는 매번 fetchMe로 갱신)
- 앱 시작 시 저장된 token이 있으면 `fetchMe()` 호출 → 서버에서 최신 user 정보 로드

### 알려진 기술부채

- `localStorage.getItem('clio_user')`를 일부 페이지에서 직접 호출하는 코드가 남아 있음
- auth-store와 상태 이중 관리 위험 → P1-1 작업으로 단일화 예정

---

## API Routes (인증)

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/api/auth/login` | POST | 로그인, JWT 발급 |
| `/api/auth/logout` | POST | 로그아웃, 세션 삭제 |
| `/api/auth/signup` | POST | 회원가입 |
| `/api/auth/me` | GET | 현재 사용자 프로필 조회 |

---

## RLS (Row Level Security)

- `users`: 인증 사용자 전체 조회 가능, 본인만 수정 가능
- `users_insert`: `auth.uid() = id` 조건 (회원가입 시 자동 프로필 생성)
- 나머지 테이블은 RLS로 부서/본인 단위 격리

---

## Sources

- `/Users/watchers/Desktop/clio-project/src/store/auth-store.ts`
- `/Users/watchers/Desktop/clio-project/src/lib/supabase/types.ts`
- `/Users/watchers/Desktop/clio-project/supabase/schema.sql`
- `/Users/watchers/Desktop/clio-project/supabase/migrations/006_users_position.sql`
