# 파일 관리

[coverage: high -- sources: src/app/(app)/files/page.tsx, src/app/api/files/route.ts, src/app/api/files/[id]/route.ts, src/app/api/files/[id]/reprocess/route.ts, src/app/api/files/process/route.ts, src/app/api/files/[id]/expiry/route.ts, src/app/api/files/[id]/share/route.ts, src/components/expiry/ExpiryAlertModal.tsx, src/types/expiry.ts, docs/02-design/features/clio-expiry-alert.design.md]

---

## Purpose [coverage: high]

CLIO의 파일 관리 시스템은 문서 업로드부터 벡터 색인, 공개 범위 제어, 만료일 알림, 내부 공유까지 문서 라이프사이클 전체를 관리한다. 업로드된 파일은 Supabase Storage에 저장되고 `files` 테이블에 메타데이터가 기록된다. 이후 비동기 파이프라인이 텍스트 추출 → 청킹 → 임베딩 순서로 RAG 색인을 완성하며, 별도 파이프라인에서 GPT-4o가 문서에서 만료일을 추출해 `schedules` 테이블에 등록한다.

---

## 파일 업로드 플로우 [coverage: high]

업로드는 `POST /api/files`에 `multipart/form-data`로 전송한다.

**단계별 처리**:
1. 인증(`getAuthUserId`) 및 파일 유효성 검사(`validateFile`)
2. macOS NFD → NFC 정규화 (`file.name.normalize('NFC')`) — 한글 파일명 검색 호환
3. 파일명 충돌 방지를 위해 UUID 경로로 Storage 업로드: `uploads/{department_id}/{uuid}.{ext}`
4. 브라우저가 MIME을 비워서 보낼 경우 `EXTENSION_MIME_MAP`으로 폴백 설정
5. `files` 테이블에 메타데이터 INSERT (초기 `status: 'processing'`)
6. `audit_logs`에 `file.upload` 이벤트 기록
7. `POST /api/files/process` 를 fire-and-forget으로 호출 — 텍스트 추출/청킹/임베딩 파이프라인 시작

**지원 포맷 및 크기 제한**:

| 확장자 | MIME |
|--------|------|
| pdf | `application/pdf` |
| docx | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| xlsx | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| pptx | `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| md | `text/markdown` |
| txt | `text/plain` |
| csv | `text/csv` |
| hwp | `application/haansofthwp` |

최대 파일 크기: **50MB**

**파일 상태 전이**:

```
uploading → processing → indexed (완료)
                       → error (오류)
                         ↑
                   재처리 가능 (POST /api/files/[id]/reprocess)
```

`STATUS_MAP`이 DB 내부 상태를 프론트 표시 문자열로 변환한다 (`indexed`/`completed` → '완료').

**JSON body 모드**: `multipart` 없이 JSON body만 보내면 메타데이터 전용 레코드를 `status: 'indexed'`로 즉시 생성한다 (Storage 업로드 없음).

---

## 파일 재처리 (Reprocess) [coverage: high]

`POST /api/files/[id]/reprocess` — `'오류'` 또는 `'처리중'` 상태 파일을 재처리한다.

**처리 흐름**:
1. 인증 확인 (`getAuthUserId`)
2. 파일 소유자 확인 (`file.uploaded_by === authUserId`) — 403 반환
3. `storage_path` 유무 확인 — 없으면 400 반환
4. 기존 `file_chunks` 삭제 (`DELETE WHERE file_id = fileId`)
5. `files.status` → `'processing'`으로 초기화
6. `POST /api/files/process` fire-and-forget 호출
7. 즉시 `{ success: true }` 반환

**UI 표시 조건**: 파일 목록(테이블/그리드 뷰)에서 `status === '오류' || status === '처리중'` **이고** `isOwner === true`인 경우에만 재처리 버튼 표시. 타인 파일은 버튼 자체가 숨겨진다.

---

## 파일 처리 파이프라인 (벡터화) [coverage: high]

업로드 완료 즉시 백그라운드에서 `POST /api/files/process`가 fire-and-forget으로 호출된다. 이 엔드포인트가 아래 파이프라인을 순차 실행한다.

**`export const maxDuration = 60`** — Vercel Hobby Plan 기본 10초 제한을 60초로 확장. 이 설정 없이는 대용량 파일 처리 중 함수가 강제 종료되어 `file_chunks`가 생성되지 않는다.

```
파일 업로드 (status: processing)
    │
    ▼
텍스트 추출 (PDF/DOCX/PPTX/XLSX/MD 포맷별 파서)
    │
    ▼
청킹 (Chunk 단위 분할)
    │
    ▼
임베딩 생성 (OpenAI Embeddings API)
    │
    ▼
벡터 색인 저장 → status: indexed
    │
    ▼ (비동기, 독립 실행)
만료일 추출 POST /api/files/[id]/extract-expiry
    → GPT-4o → schedules INSERT
```

**멱등성**: `status === 'indexed'` 이고 `file_chunks` 건수 > 0이면 재처리 없이 즉시 성공 반환.

**오디오 파일**: `isAudioFile()` 판별 후 STT 별도 처리 필요 표시 → `status: 'indexed'`로 즉시 완료 처리.

파이프라인 중 오류 발생 시 `files.status`가 `'error'`로 갱신된다. 만료일 추출 단계는 try/catch로 격리되어 실패해도 파이프라인 전체는 `'indexed'`로 완료된다.

---

## 공개 범위 (scope) 관리 [coverage: high]

파일마다 `scope` 필드로 공개 범위를 제어한다.

| 값 | 의미 |
|----|------|
| `'department'` | 업로드한 사용자의 부서 내에서만 공개 (기본값) |
| `'company'` | 전사 공개 |

**설정 방법**:
- 업로드 시 FormData의 `scope` 필드로 전달 (미전달 시 `'department'` 적용)
- 업로드 후 변경: `PATCH /api/files/[id]` — body `{ scope: 'company' | 'department' }`
  - 본인이 업로드한 파일만 변경 가능 (`uploaded_by === authUserId` 검사)

**목록 조회 필터**: `GET /api/files?scope=company` 또는 `?scope=department`로 필터링 가능. `전체` 또는 미전달 시 전체 조회.

---

## 파일 관리 페이지 UI — AI 생성 문서 통합 [coverage: high]

`src/app/(app)/files/page.tsx`는 마운트 시점에 업로드된 파일과 AI 생성 문서를 모두 불러와 단일 `files` 상태 배열로 병합하여 렌더링한다.

### 데이터 로드 방식

컴포넌트 마운트 `useEffect`에서 세 가지 API 호출이 병렬로 실행된다.

```
Promise.all([
  GET /api/files       → 업로드된 파일 목록
  GET /api/documents   → AI 생성 문서 목록
  GET /api/departments → 부서 목록 (필터 UI용)
])
```

문서(`/api/documents` 응답)는 아래 형태로 `FileItem` 포맷에 맞게 변환된 뒤 파일 목록과 합쳐진다.

```typescript
{
  id: d.id,
  name: d.title,
  type: d.template ?? 'AI문서',
  department: '미분류',
  size: '-',
  uploadDate: d.createdAt,
  status: '완료',
  scope: 'company',
  isOwner: false,
  sourceType: 'document',   // 핵심 구분자
}
```

### FileItem 인터페이스 변경

`FileItem` 인터페이스에 `sourceType?: 'file' | 'document'` 필드가 추가되었다. 업로드된 파일은 이 필드가 없거나 `'file'`이고, AI 생성 문서는 `'document'`다.

### UI 차이점 — 문서 아이템 (`sourceType === 'document'`)

| 항목 | 일반 파일 | AI 생성 문서 |
|------|-----------|-------------|
| 파일 타입 배지 | 확장자/MIME 기반 배지 | 보라색 `AI문서` 배지 |
| 아이템 클릭 | 상세 패널(모달) 열기 | `/documents` 페이지로 이동 |
| 다운로드 버튼 | 표시 | 숨김 |
| 재처리 버튼 | 소유자이고 오류 상태면 표시 | 숨김 |
| 삭제 버튼 | 표시 (권한 있을 때) | 숨김 |
| 상세 모달 하단 버튼 | "다운로드" | "문서 보기" (파란색, `/documents` 이동) |

리스트 뷰와 그리드 뷰 모두 동일하게 적용된다.

---

## 만료일 알림 시스템 [coverage: high]

### 개요

외부 cron, 이메일, notifications 테이블 없이 **순수 클라이언트 사이드 모달 팝업** 방식으로 구현된다. 앱 진입 시 `ExpiryAlertProvider`가 localStorage를 확인한 뒤 `GET /api/dashboard/expiry-summary`를 호출하여 D-30 이내 만료 문서가 있으면 `ExpiryAlertModal`을 띄운다.

### 데이터 모델

만료일 정보는 기존 `schedules` 테이블에 컬럼 3개를 추가하여 저장한다 (마이그레이션: `012_schedules_expiry.sql`).

| 컬럼 | 타입 | 허용값 | 의미 |
|------|------|--------|------|
| `source_type` | TEXT | `'document_expiry'` \| NULL | 자동 추출된 만료일 일정. 수동 일정은 NULL |
| `source_id` | UUID | `files.id` 참조 | 원본 파일 역참조 |
| `expiry_confidence` | TEXT | `'high'` \| `'low'` \| `'none'` | AI 추출 신뢰도 |

### AI 자동 추출 파이프라인

파일 처리 파이프라인 마지막 단계에서 `POST /api/files/[id]/extract-expiry`를 비동기 호출한다.

1. `files.extracted_text`에서 앞 2000토큰 슬라이싱
2. GPT-4o 호출 → `ExpiryExtractResult` JSON 파싱
3. `confidence !== 'none'`이면 `schedules` INSERT:
   - `title`: `'{파일명} 만료일'`
   - `start_date`, `end_date`: 만료일 (동일값)
   - `source_type`: `'document_expiry'`
   - `source_id`: `file_id`
4. 추출 실패 시 `try/catch` 격리 — 업로드 파이프라인 전체는 성공으로 처리

### 만료일 수동 수정

`PATCH /api/files/[id]/expiry` — AI 추출이 틀렸을 때 담당자가 직접 수정한다.

- body: `{ expiry_date: 'YYYY-MM-DD', reason?: string }`
- 기존 `schedules` 레코드가 있으면 `end_date`, `start_date` 업데이트 + `expiry_confidence → 'high'`
- 없으면 신규 INSERT (`description`에 `'[수동 등록]'` 또는 `'[수동 수정]'` 접두어 기록)

### 모달 표시 로직

`ExpiryAlertProvider`의 `fetchAndCheck` 함수:

1. localStorage `expiry_modal_suppressed_date` === 오늘 날짜(`YYYY-MM-DD`)이면 API 호출 없이 종료
2. `GET /api/dashboard/expiry-summary?days=30&limit=10` 호출
3. `items.length > 0`이면 `ExpiryAlertModal` 표시

**"오늘 다시 보지 않기"**: localStorage에 오늘 날짜를 저장하여 당일 재표시 억제. 다음날 앱 진입 시 다시 표시된다.

### D-day 배지 색상 기준 (`ExpiryAlertModal`)

| 조건 | 배경 | 텍스트 | 표시 |
|------|------|--------|------|
| `days <= 0` | `bg-red-100` | `text-red-700` | 만료됨 |
| `days <= 7` | `bg-orange-100` | `text-orange-700` | D-N |
| `days <= 14` | `bg-yellow-100` | `text-yellow-700` | D-N |
| `days > 14` | `bg-gray-100` | `text-gray-600` | D-N |

### 관련 타입 (`src/types/expiry.ts`)

```typescript
interface ExpiryItem {
  schedule_id: string;
  file_id: string;
  file_name: string;
  expiry_date: string;       // 'YYYY-MM-DD'
  days_remaining: number;    // 음수 = 이미 만료
  confidence: 'high' | 'low' | 'none';
  owner_name: string | null;
}

interface ExpirySummaryResponse {
  items: ExpiryItem[];
  total: number;
  has_expired: boolean;
}
```

---

## 외부 공유 링크 [coverage: high]

`/api/files/[id]/share` 엔드포인트로 파일별 내부 공유 권한을 관리한다. 공유 정보는 `file_permissions` 테이블에 저장된다.

**공유 권한 부여 조건** (POST):
- 파일 소유자(`uploaded_by === authUserId`)
- `admin` 또는 `manager` 역할
- manager의 경우 동일 부서 파일만 공유 가능 (`file.department_id === roleInfo.department_id`)

**공유 대상**: 개별 사용자(`userId`) 또는 부서(`departmentId`) 중 하나 필수

**권한 종류**: `'read'` (기본값) | `'edit'`

**조회** (`GET /api/files/[id]/share`): `file_permissions` 테이블에서 공유 현황 반환. users/departments/granter 조인 포함.

**권한 제거** (`DELETE /api/files/[id]/share?permissionId=xxx`): `permissionId` query param 필수.

**파일 접근 권한 판별** (`GET /api/files/[id]`): adminClient로 조회 후 아래 순서로 `accessType` 결정:

| 조건 | accessType |
|------|------------|
| 파일 소유자 | `'owner'` |
| 같은 부서 구성원 | `'department'` |
| `file_shares` 테이블에 유효한 공유 레코드 존재 | `'shared'` |
| 위 조건 모두 불해당 | 403 반환 |

`file_shares` 공유 유효성 조건: `expires_at > now()`.

모든 공유/삭제 작업은 `audit_logs`에 `file.share` 액션으로 기록된다.

---

## API Surface [coverage: high]

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/files` | 파일 목록 조회 (페이지네이션, 필터) | 필수 |
| POST | `/api/files` | 파일 업로드 (multipart) 또는 메타데이터 등록 (JSON) | 필수 |
| GET | `/api/files/[id]` | 파일 상세 조회 (접근 권한 판별 포함) | 필수 |
| PATCH | `/api/files/[id]` | 공개 범위(scope) 변경 | 필수 (소유자만) |
| DELETE | `/api/files/[id]` | 파일 삭제 (Storage + DB) | 필수 (권한 검사) |
| POST | `/api/files/[id]/reprocess` | 파일 재처리 (청크 삭제 후 재색인) | 필수 (소유자만) |
| PATCH | `/api/files/[id]/expiry` | 만료일 수동 수정 | 필수 |
| POST | `/api/files/[id]/extract-expiry` | AI 만료일 추출 + schedules 등록 | 필수 |
| GET | `/api/dashboard/expiry-summary` | D-30 이내 만료 문서 목록 | 필수 |
| GET | `/api/files/[id]/share` | 파일 공유 현황 조회 | 필수 |
| POST | `/api/files/[id]/share` | 공유 권한 부여 | 필수 |
| DELETE | `/api/files/[id]/share` | 공유 권한 제거 | 필수 |
| POST | `/api/files/process` | 내부 처리 파이프라인 (내부 호출 전용) | X-Internal-Secret |

**목록 조회 쿼리 파라미터** (`GET /api/files`):

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `page` | number | 1 | 페이지 번호 |
| `limit` | number | 20 | 페이지 크기 (최대 500) |
| `department` | string | — | 부서명 필터 |
| `scope` | `'company'`\|`'department'` | — | 공개 범위 필터 |
| `type` | string | — | 파일 타입 필터 (프론트 표시용 타입) |
| `status` | string | — | 상태 필터 (`'완료'`, `'처리중'` 등 한글 표시값) |
| `search` | string | — | 파일명 부분 검색 (ilike, 특수문자 이스케이프 처리) |

---

## Key Decisions [coverage: high]

**maxDuration = 60 (Vercel 함수 타임아웃 확장)**
Vercel Hobby Plan 기본값 10초로는 대용량 파일의 텍스트 추출 → 임베딩 파이프라인 완료 불가. `export const maxDuration = 60`을 `/api/files/process/route.ts`에 추가하여 60초로 확장. 이 설정 누락 시 파일이 `'처리중'` 또는 `'오류'` 상태로 고착되고 RAG 검색에서 제외된다.

**재처리는 소유자 본인만 허용**
`POST /api/files/[id]/reprocess`에서 `uploaded_by !== authUserId`이면 403. 타인 파일의 청크 삭제는 데이터 무결성 위반. UI에서도 `isOwner === true`일 때만 버튼 표시.

**만료일 알림은 cron/이메일 없이 모달 팝업**
외부 알림 서비스 의존도를 제거하기 위해 앱 진입 시 클라이언트가 직접 API를 호출하는 방식을 선택했다. "오늘 다시 보지 않기" 상태는 localStorage로만 관리하여 서버 부하 없이 동작한다.

**Storage 경로에 UUID 사용**
한글 파일명이나 특수문자가 포함된 경우 Storage 경로 문제가 발생하므로 실제 경로는 `uploads/{dept_id}/{uuid}.{ext}`로 저장하고, 파일명은 DB `name` 컬럼에 NFC 정규화하여 별도 관리한다.

**scope는 files 테이블 컬럼, 내부 공유는 file_permissions 테이블 분리**
전사/부서 범위 공개는 `files.scope`로 단순하게 처리하고, 특정 사용자/부서 지정 공유는 `file_permissions` 테이블로 별도 관리한다.

**만료일 AI 추출 실패 격리**
GPT-4o 호출 실패가 파일 업로드 전체를 실패시키지 않도록 try/catch로 격리한다. 추출 실패 시 `schedules` 레코드가 생성되지 않을 뿐 파일은 정상 색인된다.

---

## Gotchas [coverage: high]

- **Vercel 10초 타임아웃**: `/api/files/process`에 `maxDuration = 60` 누락 시 대용량 파일 처리 중 함수가 강제 종료된다. `file_chunks`가 0건이 되고 파일은 RAG 검색에서 제외된다. 재처리 버튼으로 복구 가능.

- **`/api/files/process`는 내부 전용**: `INTERNAL_API_SECRET` 헤더(`X-Internal-Secret`) 검증. 프로덕션에서 미설정 시 500 반환. 개발 환경에서는 경고 로그 후 허용.

- **macOS 한글 파일명 NFD 문제**: macOS에서 업로드된 한글 파일명은 NFD로 인코딩되어 검색이 깨진다. `file.name.normalize('NFC')` 처리가 필수이며, 이를 누락하면 `ilike` 검색이 동작하지 않는다.

- **type 필터는 DB가 아닌 메모리에서 수행**: `type` 파라미터 필터는 Supabase 쿼리가 아닌 결과 배열에 대해 `.filter()`를 적용한다. 따라서 `total` 카운트가 type 필터 적용 전 DB 전체 건수로 반환될 수 있다.

- **만료일 쿼리 범위**: `GET /api/dashboard/expiry-summary`는 `end_date >= today`를 조건으로 포함하지 않는다. 이미 만료된 문서(음수 days_remaining)도 D-30 이내면 포함된다 (`has_expired: true`로 표시).

- **공유 권한 조회는 adminClient 사용**: `GET /api/files/[id]`는 RLS를 우회하기 위해 adminClient로 파일을 조회한다. 이후 코드 레벨에서 소유자/부서/공유 권한을 직접 판별한다.

- **EXTENSION_MIME_MAP에 doc/xls/ppt/hwp 포함**: 구형 Office 포맷 및 HWP도 MIME 폴백 매핑에 존재하지만 `validateFile` 함수에서 실제 허용 여부를 별도로 검증하므로 이 매핑 자체가 허용을 보장하지 않는다.

- **일괄 삭제·scope 변경 시 문서 아이템 포함 주의**: 파일 목록에서 전체 선택 후 일괄 삭제 또는 scope 변경을 실행하면 `sourceType === 'document'` 아이템도 선택 대상에 포함된다. UI는 해당 작업을 시도하지만 내부적으로 `DELETE /api/files/[id]` 및 `PATCH /api/files/[id]`를 호출하며, 이 엔드포인트들은 업로드된 파일만 처리하도록 설계되어 있다. 문서 아이템에 대한 호출은 해당 `id`가 `files` 테이블에 존재하지 않아 404 또는 오류로 **조용히 실패**한다. 사용자에게 별도 에러 메시지가 표시되지 않을 수 있으므로 향후 일괄 작업 시 `sourceType` 기준으로 문서 아이템을 사전 필터링하는 처리가 필요하다.

---

## Sources [coverage: high]

- `src/app/(app)/files/page.tsx` — 파일 관리 페이지 (업로드 파일 + AI 문서 병합 렌더링)
- `src/app/api/files/route.ts` — 파일 목록/업로드 API
- `src/app/api/files/[id]/route.ts` — 파일 상세/scope 변경/삭제 API
- `src/app/api/files/[id]/reprocess/route.ts` — 파일 재처리 API (소유자 전용)
- `src/app/api/files/process/route.ts` — 내부 처리 파이프라인 (maxDuration=60)
- `src/app/api/files/[id]/expiry/route.ts` — 만료일 수동 수정 API
- `src/app/api/files/[id]/share/route.ts` — 공유 권한 관리 API
- `src/components/expiry/ExpiryAlertModal.tsx` — 만료 알림 모달 컴포넌트
- `src/types/expiry.ts` — 만료일 관련 TypeScript 타입 정의
- `docs/02-design/features/clio-expiry-alert.design.md` — 만료일 알림 기술 설계서 (v5.3.0)
