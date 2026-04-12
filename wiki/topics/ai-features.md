# AI 기능

[coverage: high -- 2 sources: clio-next-phase.plan.md, src/lib/ai/]

---

## Purpose

CLIO의 AI 기능은 OpenAI GPT-4o를 기반으로 하며, 파일 벡터 임베딩 → 시맨틱 검색 → 문서 생성 전체 파이프라인을 포괄한다.  
STT(Speech-to-Text) 회의록 기능도 Whisper-1로 구현되어 있다.

---

## AI 파이프라인 모듈 (`src/lib/ai/`)

| 파일 | 기능 |
|------|------|
| `extract-text.ts` | 업로드 파일에서 텍스트 추출 (PDF/DOCX/XLSX/HTML) |
| `chunk-text.ts` | 추출 텍스트를 청크 단위로 분할 |
| `embeddings.ts` | OpenAI embedding API로 벡터 생성 → `file_chunks` 테이블 저장 |
| `generate-document.ts` | GPT-4o로 최종 문서 내용 생성 |
| `summarize.ts` | 검색 결과 또는 문서 AI 요약 |
| `transcribe.ts` | Whisper-1 STT (음성 → 텍스트) |
| `analyze-template.ts` | 템플릿 분석 (플레이스홀더 추출) |

---

## 파일 업로드 → AI 처리 흐름

```
1. 파일 업로드 (POST /api/files)
   ├── Supabase Storage에 원본 파일 저장
   └── status: 'uploading'

2. 텍스트 추출 (extract-text.ts)
   ├── MIME 타입에 따라 파서 선택
   └── status: 'processing'

3. 청킹 (chunk-text.ts)
   └── 일정 토큰 단위로 분할

4. 벡터 임베딩 (embeddings.ts)
   ├── OpenAI text-embedding-3-small (추정)
   └── file_chunks 테이블에 저장 (pgvector)
   └── status: 'completed' / 'indexed'
```

---

## 시맨틱 검색 (search)

```
POST /api/search
  └── 검색어 → embedding 변환
  └── match_file_chunks() DB 함수로 코사인 유사도 검색
  └── 폴백: 텍스트 LIKE 검색
  └── GPT-4o로 결과 요약 생성
```

- pgvector `match_file_chunks(query_embedding, match_count, match_threshold)`
- `match_threshold`: 유사도 임계값 (0~1)

---

## 문서 생성 AI

```
POST /api/generate
  ├── 입력: template_id, source_file_ids, instructions
  ├── source_file_ids의 청크 내용 수집
  ├── 사용자 정보 (name, position, department) 포함
  └── GPT-4o 프롬프트 구성 → 문서 내용 생성
  └── 선택 포맷 렌더러로 변환 → 다운로드 응답
```

**주의:** `userData?.position`이 `undefined`이면 문서에 직급 누락 → migration 006으로 수정됨.

---

## STT 회의록 (transcribe)

```
POST /api/transcribe
  ├── 음성 파일 업로드 (오디오 포맷)
  ├── OpenAI Whisper-1 API 호출
  ├── 텍스트 변환 완료
  └── GPT-4o로 회의록 형태로 요약 생성
```

---

## 환경 변수 (AI 관련)

| 변수 | 설명 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API 키 (필수, .env.local.example에 없었으나 P0-2에서 추가 예정) |
| `INTERNAL_API_SECRET` | 내부 API 보안 시크릿 |

---

## AI Q&A 채팅 (P2-3 완료 — v5.5.0)

```
POST /api/chat
  ├── 입력: { message, history, fileIds? }
  ├── fileIds 있으면 해당 파일 범위 내 벡터 검색
  ├── fileIds 없으면 전체 파일 검색
  └── GPT-4o-mini로 컨텍스트 기반 답변 생성 (대화 히스토리 포함)
```

- `search/page.tsx` 우측 채팅 패널에서 검색 결과 파일로 fileIds 자동 전달
- 파일 미선택 시 `fileIds: undefined` → 전체 파일 대상 검색
- 대화 히스토리 유지 (`chatMessages` 배열 상태관리)

---

## Sources

- `/Users/watchers/Desktop/clio-project/docs/01-plan/features/clio-next-phase.plan.md`
- `/Users/watchers/Desktop/clio-project/src/lib/ai/` (파일 목록 기준)
- `/Users/watchers/Desktop/clio-project/src/lib/supabase/types.ts` (SearchResult, DashboardStats)
