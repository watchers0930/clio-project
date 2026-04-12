# 문서 관리

[coverage: high -- 3 sources: clio-next-phase.plan.md, src/lib/supabase/types.ts, src/lib/renderers/]

---

## Purpose

CLIO의 문서 관리는 두 축으로 구성된다:
1. **파일 저장소** — 원본 파일 업로드 + 벡터 임베딩 (검색 소스)
2. **AI 생성 문서** — 파일 기반으로 AI가 생성하는 구조화된 문서 (다운로드 가능)

---

## 파일 관리 (files)

### 업로드 제한
- 최대 파일 크기: **50MB**
- 파일명 NFC 정규화 처리 (한글 파일명 호환성)
- 멀티파트 업로드 지원

### 지원 파일 형식 (텍스트 추출 가능)
- PDF: `pdf-parse` 라이브러리
- DOCX: `mammoth` 라이브러리
- XLSX: `xlsx` 라이브러리
- HTML: `cheerio` 라이브러리

### 파일 상태 흐름
```
uploading → processing → completed (indexed)
                      ↘ error
```

### Storage 경로
Supabase Storage에 저장. `storage_path` 필드에 경로 기록.

---

## 문서 생성 (documents)

### AI 문서 생성 플로우
```
1. 사용자가 템플릿 + 참조 파일 선택 + 작성 지시사항 입력
2. POST /api/generate
   ├── source_file_ids로 파일 청크 조회
   ├── 사용자 정보 (name, position, department) 포함
   └── GPT-4o로 문서 내용 생성
3. 생성된 문서를 포맷별 렌더러로 변환
4. 브라우저에서 다운로드
```

### 지원 출력 포맷

| 포맷 | 렌더러 파일 | 라이브러리 |
|------|------------|-----------|
| DOCX | `docx-renderer.ts` | `docx` |
| HWPX | `hwpx-renderer.ts` | `adm-zip` (XML 조작) |
| XLSX | `xlsx-renderer.ts` | `exceljs` |
| PPTX | `pptx-renderer.ts` | `pptxgenjs` |
| PDF | `pdf-renderer.ts` | `jspdf` |

렌더러 공통 진입점: `src/lib/renderers/index.ts`

---

## 템플릿 시스템 (templates)

### 구조
- `placeholders: jsonb` — 치환 필드 목록 (예: `["작성자명", "날짜", "부서"]`)
- `content: text` — 템플릿 본문 (플레이스홀더 포함)
- `scope: 'department' | 'company'` — 공개 범위

### 계약서 특수 처리
- `src/lib/contract-fields.ts` — 계약서 타입별 입력 필드 스키마 정의
- 구현 완료: 시스템구축계약서, 유지보수계약서, 소프트웨어구축계약서 (P1-3 완료)

### 템플릿 자가등록 (v5.0.0)
사용자가 직접 템플릿 등록 가능 (관리자 승인 없이).

---

## 문서 버전 관리 (migration 008, 예정 P3)

`documents` 테이블에 `parent_id` 컬럼으로 버전 체인 예정.  
현재는 단일 버전만 관리.

---

## API Routes (문서/파일)

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/api/files` | GET/POST | 파일 목록 / 업로드 |
| `/api/files/[id]` | DELETE | 파일 삭제 |
| `/api/generate` | POST | AI 문서 생성 |
| `/api/documents` | GET | 문서 목록 |
| `/api/templates` | GET/POST | 템플릿 목록 / 생성 |
| `/api/transcribe` | POST | STT 회의록 (Whisper-1) |

---

## 전자서명 삽입 (P2-2 완료 — v5.5.0)

### 흐름

```
POST /api/generate
  ├── users.signature_path 조회
  ├── signature_path 있으면 Storage('files')에서 이미지 Buffer 다운로드
  └── renderDocument() 이후 injectSignature* 호출

src/lib/utils/inject-signature.ts
  injectSignatureDocx(docxBuffer, sigBuffer)
    ├── (A) "(서명)" 또는 "(인)" 텍스트 마커 탐색 → 해당 위치에 이미지 삽입
    └── (C) 마커 없으면 </w:body> 직전에 서명 단락 추가 (우측 정렬)

  injectSignatureHwpx(hwpxBuffer, sigBuffer, userName)
    ├── (A) "(서명)" 또는 "(인)" 마커 탐색 → hp:picture 교체
    └── (C) 마커 없으면 </hp:subList> 직전에 이름 + "(서명)" 단락 추가
```

### 서명 이미지 Storage 경로

```
files 버킷 > signatures/{userId}/signature.{ext}
```

- `signature_path = null` → 주입 스킵, 기존 동작 유지 (에러 없음)
- 적용 대상: DOCX FormData / HWPX FormData / DOCX Template / 마크다운 기반 새 문서

---

## 알려진 문제

- `generate` API에서 `userData?.position` 참조 — DB에 position 컬럼 없으면 undefined (migration 006으로 수정됨)

---

## Sources

- `/Users/watchers/Desktop/clio-project/docs/01-plan/features/clio-next-phase.plan.md`
- `/Users/watchers/Desktop/clio-project/src/lib/supabase/types.ts`
- `/Users/watchers/Desktop/clio-project/src/lib/renderers/`
- `/Users/watchers/Desktop/clio-project/src/lib/contract-fields.ts`
