# 브라우저 녹음 + STT 연계 계획서

**버전:** v1.0.0  
**작성일:** 2026-04-12  
**프로젝트:** CLIO v5.11.0  
**배포:** https://clioai.vercel.app  
**상태:** Draft

---

## 1. 개요 (Overview)

### 1-1. 기능 목적

CLIO에는 이미 Whisper 기반 STT 파이프라인(`/api/transcribe`)이 있지만, 사용자가 **오디오 파일을 직접 업로드**해야만 사용할 수 있다. 회의 현장에서 스마트폰이나 노트북으로 바로 녹음한 뒤 업로드하는 마찰이 존재한다.

이 기능은 **브라우저 내 직접 녹음 UI**를 제공하여, 파일 변환 없이 녹음 → STT → 회의록 생성 → 할일 추출까지 원스톱으로 완성되는 파이프라인을 구축한다.

### 1-2. 기존 기능과의 시너지

| 기존 기능 | 시너지 내용 | 강도 |
|-----------|-------------|------|
| **meeting-todo** (v5.10.0) | 회의 중 녹음 → STT → 회의록 생성 → 할일 자동 추출까지 원스톱 완성 | ★★★ |
| **STT 회의록** (v1.9.1) | 기존 파일 업로드 방식을 브라우저 녹음으로 대체/보완 | ★★★ |
| **contract-risk** (v5.9.0) | 계약 협의 구두 내용 녹음 → 텍스트 변환 → 리스크 분석 | ★★ |
| **AI Q&A 채팅** (v5.5.0) | 타이핑 대신 음성으로 질문 → STT → RAG 검색 | ★★ |
| **문서생성** | 음성 지시사항 녹음 → 텍스트 변환 → 문서 생성 Step 3 지시사항 자동 입력 | ★ |

### 1-3. 사용자 가치

| 역할 | 현재 불편 | 기능 도입 후 |
|------|-----------|--------------|
| 회의 주관자 | 별도 앱으로 녹음 후 파일 변환·업로드 | 브라우저에서 녹음 시작 → 회의록+할일 자동 완성 |
| 계약 담당자 | 구두 협의 내용 수동 타이핑 | 협의 녹음 → 계약서 리스크 즉시 분석 |
| 일반 사용자 | 검색어 타이핑 | 음성으로 질문 → 문서 검색 |

### 1-4. 기술 배경

- **MediaRecorder API**: 브라우저 표준 API, Chrome/Safari/Firefox 지원. 별도 라이브러리 불필요
- **출력 포맷**: `audio/webm` (Chrome) / `audio/mp4` (Safari) — Whisper-1은 두 포맷 모두 지원
- **기존 STT API**: `src/app/api/transcribe/route.ts` — FormData `file` 필드로 오디오 수신, Whisper-1 호출
- **파일 크기 제한**: Whisper API 25MB 제한, Vercel 요청 4.5MB 제한 (→ 10분 이내 녹음 대상)
- **Vercel 함수 타임아웃**: Hobby 플랜 10초 → 기존 transcribe와 동일 제약 적용

---

## 2. 범위 (Scope)

### 2-1. In Scope

- [ ] 브라우저 녹음 훅 `useAudioRecorder` (시작/정지/일시정지/재개/재생)
- [ ] 녹음 UI 컴포넌트 `AudioRecorder` (파형 시각화 포함)
- [ ] 녹음 완료 후 `/api/transcribe` 자동 전송 (기존 API 재사용)
- [ ] 회의록 페이지(STT 탭)에 녹음 UI 통합 — 파일 업로드와 탭으로 병렬 제공
- [ ] 계약 리스크 페이지에 녹음 옵션 추가 (음성 협의 내용 분석)
- [ ] AI 검색 채팅창에 마이크 버튼 추가 (음성 질문 지원)
- [ ] 마이크 권한 요청 및 미지원 브라우저 graceful fallback

### 2-2. Out of Scope

- 실시간 스트리밍 트랜스크립션 (Whisper 배치 방식 유지)
- 서버사이드 녹음 저장 (브라우저 메모리에서 바로 전송, Storage 미저장)
- 음성 인식 후 자동 명령 실행 (음성 지시 기반 워크플로우 자동화)
- 모바일 앱 전용 네이티브 녹음 기능
- 녹음 파일의 영구 보관 (Supabase Storage 업로드)

---

## 3. 요구사항 (Requirements)

### 3-1. 기능 요구사항

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| FR-01 | `useAudioRecorder` 훅: 시작/정지/일시정지/재개, `audioBlob` 반환 | P0 | Pending |
| FR-02 | `AudioRecorder` 컴포넌트: 녹음 버튼, 타이머, 정지 버튼, 파형 애니메이션 | P0 | Pending |
| FR-03 | 녹음 완료 시 `/api/transcribe`로 자동 전송, 회의록 생성까지 연결 | P0 | Pending |
| FR-04 | 회의록(STT) 페이지에 "녹음하기" 탭 추가 (기존 "파일 업로드" 탭과 병렬) | P0 | Pending |
| FR-05 | 마이크 권한 미허용 시 안내 메시지 + 파일 업로드 탭으로 자동 전환 | P0 | Pending |
| FR-06 | 계약 리스크 페이지에 "음성 녹음" 옵션 추가 (협의 내용 직접 녹음) | P1 | Pending |
| FR-07 | AI 검색 입력창 우측에 마이크 버튼 → 녹음 → STT → 검색창 자동 입력 | P1 | Pending |
| FR-08 | 녹음 완료 후 meeting-todo 추출까지 원스톱 파이프라인 UI 제공 | P1 | Pending |
| FR-09 | 파형 시각화: `AnalyserNode` 기반 실시간 볼륨 바 애니메이션 | P2 | Pending |
| FR-10 | 녹음 중 탭 이탈 경고 (beforeunload 이벤트) | P2 | Pending |

### 3-2. 비기능 요구사항

| 분류 | 기준 | 측정 방법 |
|------|------|-----------|
| 브라우저 지원 | Chrome 88+, Safari 15+, Firefox 110+ | MediaRecorder API 지원 확인 |
| 파일 크기 | 녹음 10분 기준 약 8~12MB (webm 기준) — Whisper 25MB 제한 여유 | 실제 녹음 테스트 |
| 응답 시간 | Whisper STT 응답 20초 이내 (기존 transcribe 동일 기준) | Vercel 함수 로그 |
| 보안 | 마이크 접근은 HTTPS 필수 (Vercel 배포 환경에서 충족) | 배포 URL 확인 |
| UX | 녹음 중 CPU/메모리 이슈 없음 (1시간 이상 녹음 시 스트리밍 고려) | 장시간 테스트 |

---

## 4. 우선순위 (Priority)

```
P0 — 핵심 녹음 파이프라인 (Must)
  ├── FR-01: useAudioRecorder 훅
  ├── FR-02: AudioRecorder UI 컴포넌트
  ├── FR-03: /api/transcribe 자동 연결
  ├── FR-04: 회의록 페이지 "녹음하기" 탭 통합
  └── FR-05: 마이크 권한 오류 처리

P1 — 기존 기능 시너지 확장 (Should)
  ├── FR-06: 계약 리스크 페이지 음성 입력
  ├── FR-07: AI 검색 음성 질문
  └── FR-08: 녹음 → meeting-todo 원스톱 파이프라인

P2 — UX 고도화 (Could)
  ├── FR-09: 파형 시각화
  └── FR-10: 녹음 중 탭 이탈 경고

P3 — 이후 검토 (Won't — 현재 범위 외)
  ├── 실시간 스트리밍 트랜스크립션
  ├── 녹음 파일 영구 저장
  └── 음성 명령 기반 워크플로우 자동화
```

---

## 5. 구현 범위 상세

### 5-1. 신규 파일

| 파일 경로 | 역할 |
|-----------|------|
| `src/hooks/useAudioRecorder.ts` | MediaRecorder API 래퍼 훅 (시작/정지/일시정지/재개, blob 반환) |
| `src/components/common/AudioRecorder.tsx` | 녹음 UI (버튼, 타이머, 파형 애니메이션) |
| `src/components/common/VoiceInputButton.tsx` | 검색창/입력창에 삽입되는 마이크 버튼 (소형 컴포넌트) |

### 5-2. 수정 파일

| 파일 경로 | 변경 내용 |
|-----------|-----------|
| `src/app/(dashboard)/search/page.tsx` | AI 검색 입력창에 `VoiceInputButton` 추가 |
| `src/app/(dashboard)/contract-risk/page.tsx` | 텍스트 업로드 외 녹음 탭 추가 |
| STT 회의록 관련 페이지/컴포넌트 | "녹음하기" 탭 + `AudioRecorder` 통합, 결과를 transcribe API로 전송 |

### 5-3. 핵심 데이터 흐름

```
[브라우저 마이크]
      ↓  MediaRecorder API
[audioBlob (webm/mp4)]
      ↓  FormData { file: blob, fileName: 'recording.webm' }
[POST /api/transcribe]  ← 기존 API 재사용 (변경 없음)
      ↓  Whisper-1
[transcript text]
      ↓  summarizeTranscript() + extractTodosFromText()
[회의록 + extractedTodos]
      ↓  TodoExtractModal
[할일 선택 등록]
```

### 5-4. useAudioRecorder 핵심 인터페이스

```typescript
interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;           // 녹음 경과 시간 (초)
  audioBlob: Blob | null;     // 완료 시 오디오 데이터
  audioUrl: string | null;    // 재생용 Object URL
  analyserNode: AnalyserNode | null; // 파형 시각화용
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
}
```

---

## 6. 검증 기준 (Acceptance Criteria)

### 6-1. P0 검증 — 녹음 → STT 파이프라인

| 검증 항목 | 테스트 방법 | 기대 결과 |
|-----------|-------------|-----------|
| 녹음 시작/정지 | 버튼 클릭 | 타이머 동작, 정지 후 audioBlob 생성 |
| STT 전송 | 정지 후 자동 전송 | `/api/transcribe` 호출, 회의록 텍스트 반환 |
| Chrome/Safari 포맷 | 각 브라우저에서 녹음 | webm/mp4 모두 Whisper 처리 정상 |
| 마이크 권한 거부 | 권한 거부 후 녹음 시도 | 안내 메시지 + 파일 업로드 탭 자동 선택 |
| HTTPS 환경 | 배포 URL에서 테스트 | 마이크 접근 정상 (localhost도 허용) |

### 6-2. P1 검증 — 시너지 기능

| 검증 항목 | 테스트 방법 | 기대 결과 |
|-----------|-------------|-----------|
| 회의 녹음 → 할일 추출 원스톱 | 녹음 → 정지 → 자동 처리 | 회의록 생성 + TodoExtractModal 자동 표시 |
| 계약 협의 녹음 | contract-risk 페이지에서 녹음 | STT 텍스트를 리스크 분석 입력으로 사용 |
| 음성 검색 | 마이크 버튼 → 질문 말하기 | 검색창에 텍스트 자동 입력 + 검색 실행 |

### 6-3. 회귀 테스트

| 항목 | 확인 방법 |
|------|-----------|
| 기존 파일 업로드 STT 정상 동작 | 오디오 파일 업로드 → 회의록 생성 확인 |
| meeting-todo 기존 경로 정상 동작 | 기존 문서에서 "할일 자동 추출" 버튼 동작 |
| contract-risk 파일 업로드 경로 | 기존 계약서 파일 업로드 → 리스크 분석 |
| AI 검색 텍스트 입력 경로 | 기존 타이핑 검색 정상 동작 |

---

## 7. 예상 작업 항목 (Task Breakdown)

```
[P0] useAudioRecorder 훅 구현                       (2시간)
  └── src/hooks/useAudioRecorder.ts
      - MediaRecorder 시작/정지/일시정지
      - AnalyserNode 연결 (파형용)
      - Blob → Object URL 변환
      - cleanup (stream track 해제)

[P0] AudioRecorder 컴포넌트 구현                    (2시간)
  └── src/components/common/AudioRecorder.tsx
      - 녹음 버튼 (빨간 원 → 녹음 중 펄스 애니메이션)
      - 타이머 표시 (MM:SS)
      - 정지 버튼 + 재생 미리듣기
      - 마이크 권한 오류 처리

[P0] 회의록 페이지 녹음 탭 통합                     (1시간)
  └── "파일 업로드" / "직접 녹음" 탭 UI
      - 탭 전환 상태 관리
      - 녹음 완료 → FormData → transcribe API 호출 연결

[P1] VoiceInputButton + AI 검색 통합                (1시간)
  └── src/components/common/VoiceInputButton.tsx
      - 마이크 버튼 (소형, 입력창 우측)
      - 클릭 → 녹음 시작 → 정지 → STT → 입력창 채우기

[P1] contract-risk 페이지 음성 입력 추가             (1시간)
  └── 기존 파일 업로드 탭 옆 "음성 녹음" 탭
      - 녹음 → STT → 텍스트를 분석 입력으로 전달

[P1] 회의 원스톱 파이프라인 UX 개선                 (1시간)
  └── 녹음 완료 → STT 완료 시 자동으로 TodoExtractModal 트리거
      - 사용자 확인 단계 최소화

[P2] 파형 시각화                                    (1시간)
[P2] 탭 이탈 경고                                   (0.5시간)
```

**총 예상 소요 시간:** P0+P1 기준 8~10시간

---

## 8. 리스크 및 완화 방안

| 리스크 | 영향 | 가능성 | 완화 방안 |
|--------|------|--------|-----------|
| Vercel 4.5MB 요청 제한 | 긴 녹음 업로드 실패 | 중간 | 10분(약 8MB) 초과 시 경고 + 중간 정지 안내 |
| Safari `audio/mp4` 포맷 처리 | STT 실패 | 낮음 | Whisper mp4 지원 확인됨, MIME 타입 명시 전송 |
| HTTPS 미적용 환경 | 마이크 API 접근 불가 | 낮음 | Vercel 배포 환경은 HTTPS 기본 제공 |
| 장시간 녹음 메모리 부족 | 브라우저 탭 크래시 | 낮음 | 최대 30분 제한 + 경고 메시지 표시 |
| 기존 transcribe API 변경 없음 | 호환성 우려 | 없음 | 기존 API 그대로 재사용, 변경 없음 |

---

## 9. 버전 계획

| 버전 | 내용 |
|------|------|
| v5.12.0 | P0 완료 — useAudioRecorder + AudioRecorder + 회의록 녹음 탭 |
| v5.13.0 | P1 완료 — AI 검색 음성 입력 + contract-risk 음성 + 원스톱 파이프라인 |
| v5.14.0 | P2 완료 — 파형 시각화 + 탭 이탈 경고 |

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-04-12 | 최초 작성 | 크로미 (PM) |
