# 브라우저 녹음 + STT 연계 설계서

> **요약**: MediaRecorder API로 브라우저에서 직접 녹음하고, 기존 `/api/transcribe`(Whisper)에 전송하여 회의록·할일 추출까지 원스톱으로 완성하는 기능의 기술 명세
>
> **프로젝트**: CLIO v5.11.0  
> **작성일**: 2026-04-12  
> **상태**: Draft  
> **계획서**: [clio-recording-stt.plan.md](../../01-plan/features/clio-recording-stt.plan.md)

---

## 관련 문서

| 단계 | 문서 | 상태 |
|------|------|------|
| 계획서 | `docs/01-plan/features/clio-recording-stt.plan.md` | ✅ Approved |
| 기존 STT API | `src/app/api/transcribe/route.ts` | ✅ 참조 (변경 없음) |
| 회의록 할일 추출 설계서 | `docs/02-design/features/clio-meeting-todo.design.md` | ✅ 참조 |
| TodoExtractModal | `src/components/meetings/TodoExtractModal.tsx` | ✅ 기존 컴포넌트 활용 |

---

## 1. 개요

### 1-1. 기능 요약

브라우저의 `MediaRecorder API`와 `Web Audio API`를 이용해 마이크 녹음을 수행하고, 생성된 `Blob`을 기존 `/api/transcribe` API에 FormData로 전송한다. 기존 STT 파이프라인(Whisper → 회의록 생성 → 할일 추출)은 **완전히 그대로 유지**되며, 이 기능은 "파일 업로드" 단계를 대체하는 프론트엔드 레이어만 추가한다.

### 1-2. 기술 스택

| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 녹음 API | `MediaRecorder API` (브라우저 네이티브, 라이브러리 없음) |
| 파형 시각화 | `Web Audio API` — `AnalyserNode` (P2) |
| 오디오 포맷 | Chrome: `audio/webm;codecs=opus`, Safari: `audio/mp4` (Whisper 양쪽 지원) |
| STT | 기존 `/api/transcribe` (Whisper-1) — 변경 없음 |
| 언어 | TypeScript |
| 상태관리 | 컴포넌트 로컬 state (훅 내부) |

### 1-3. 신규 기능이 변경하지 않는 것

- `/api/transcribe` 서버 코드 — **변경 없음**
- DB 스키마 — **마이그레이션 없음**
- 기존 파일 업로드 방식 — **병렬 유지** (탭으로 선택)

---

## 2. 데이터베이스 설계

**마이그레이션 없음.** 녹음 기능은 프론트엔드 레이어에서만 동작하며, 처리 결과는 기존 `documents`, `todos` 테이블에 저장된다 (기존 STT 파이프라인 그대로).

---

## 3. API 설계

### 3-1. 엔드포인트 목록

| 메서드 | 경로 | 변경 여부 | 역할 |
|--------|------|-----------|------|
| POST | `/api/transcribe` | **변경 없음** | 오디오 파일(또는 녹음 blob) 수신 → STT → 회의록 |

### 3-2. 녹음 Blob → 기존 API 전송 방법

```typescript
// 기존 파일 업로드와 동일한 FormData 구조로 전송
const formData = new FormData();

// audioBlob: MediaRecorder가 생성한 Blob (webm 또는 mp4)
// 파일명에 확장자 명시 필수 (Whisper MIME 타입 감지용)
const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
formData.append('file', audioBlob, `recording.${ext}`);

// 기존 파일 업로드 코드와 동일한 fetch 호출
const response = await fetch('/api/transcribe', {
  method: 'POST',
  body: formData,
  // Content-Type은 자동 설정 (multipart/form-data + boundary)
});
```

**변경 없음 이유**: Whisper-1 API는 `File` 객체와 `Blob` 객체를 동일하게 처리. FormData에서 `file` 필드로 전달되는 것이 같으므로 서버 수정 불필요.

---

## 4. 컴포넌트 설계

### 4-1. 신규 파일 목록

| 파일 경로 | 역할 | 우선순위 |
|-----------|------|----------|
| `src/hooks/useAudioRecorder.ts` | MediaRecorder 래퍼 훅 | P0 |
| `src/components/common/AudioRecorder.tsx` | 녹음 UI 컴포넌트 (버튼, 타이머, 파형) | P0 |
| `src/components/common/VoiceInputButton.tsx` | 입력창 내 마이크 버튼 (소형) | P1 |

### 4-2. 수정 파일 목록

| 파일 경로 | 변경 내용 | 우선순위 |
|-----------|-----------|----------|
| STT 회의록 관련 페이지/컴포넌트 | "직접 녹음" 탭 추가 + `AudioRecorder` 연결 | P0 |
| `src/app/(dashboard)/search/page.tsx` | 검색 입력창에 `VoiceInputButton` 추가 | P1 |
| `src/app/(dashboard)/contract-risk/page.tsx` | 업로드 탭 외 "음성 녹음" 탭 추가 | P1 |

---

### 4-3. `src/hooks/useAudioRecorder.ts`

#### 반환 인터페이스

```typescript
export interface UseAudioRecorderReturn {
  // 상태
  status: 'idle' | 'recording' | 'paused' | 'stopped';
  duration: number;           // 경과 시간 (초)
  audioBlob: Blob | null;     // 녹음 완료 후 데이터
  audioUrl: string | null;    // 미리듣기용 Object URL
  analyserNode: AnalyserNode | null; // P2 파형 시각화용
  error: string | null;       // 마이크 권한 거부 등 에러 메시지

  // 액션
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;  // 초기 상태로 복귀 (Object URL 해제 포함)
}
```

#### 내부 구현 흐름

```typescript
// 녹음 시작
async function startRecording() {
  // 1. getUserMedia — 마이크 권한 요청
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // 2. AnalyserNode 연결 (P2 파형용, P0에서는 연결만 해두고 UI 미사용)
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  source.connect(analyser);
  setAnalyserNode(analyser);

  // 3. MIME 타입 결정 (브라우저 호환)
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/mp4';

  // 4. MediaRecorder 시작
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType });
    setAudioBlob(blob);
    setAudioUrl(URL.createObjectURL(blob));
    stream.getTracks().forEach((t) => t.stop()); // 마이크 해제
    audioCtx.close();
  };

  recorder.start(1000); // 1초 간격으로 dataavailable 이벤트 발생
  setMediaRecorder(recorder);
  setStatus('recording');

  // 5. 타이머 시작 (1초 간격)
  timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
}

// 중단
function stopRecording() {
  mediaRecorder?.stop();
  clearInterval(timerRef.current);
  setStatus('stopped');
}

// 클린업 (resetRecording)
function resetRecording() {
  if (audioUrl) URL.revokeObjectURL(audioUrl); // 메모리 해제
  setAudioBlob(null);
  setAudioUrl(null);
  setDuration(0);
  setStatus('idle');
  setError(null);
}

// 마이크 권한 에러 처리
// getUserMedia 실패 시 → error 상태에 메시지 저장
```

#### 브라우저 미지원 처리

```typescript
// startRecording 최상단
if (!navigator.mediaDevices?.getUserMedia) {
  setError('이 브라우저는 마이크 녹음을 지원하지 않습니다. 파일을 직접 업로드해 주세요.');
  return;
}
```

---

### 4-4. `src/components/common/AudioRecorder.tsx`

#### Props 인터페이스

```typescript
interface AudioRecorderProps {
  onComplete: (blob: Blob) => void;  // 녹음 완료 시 blob 전달 (부모에서 API 호출)
  maxDurationSecs?: number;          // 기본값: 1800 (30분)
  className?: string;
}
```

#### ASCII 와이어프레임

```
[idle 상태]
┌────────────────────────────────────────────────┐
│                                                │
│   🎙  마이크로 직접 녹음하기                    │
│                                                │
│        [ ● 녹음 시작 ]                         │
│                                                │
└────────────────────────────────────────────────┘

[recording 상태]
┌────────────────────────────────────────────────┐
│                                                │
│   ● 녹음 중  00:42                             │
│   ▁▂▄▆▄▂▁▂▄▇▄▂▁  (파형 — P2)                 │
│                                                │
│   [ ⏸ 일시정지 ]    [ ⬛ 정지 ]               │
│                                                │
└────────────────────────────────────────────────┘

[stopped 상태]
┌────────────────────────────────────────────────┐
│                                                │
│   ✅ 녹음 완료  (00:42)                        │
│   ▶ [미리듣기]          [🔄 다시 녹음]         │
│                                                │
│               [ → 변환 시작 ]                  │
│                                                │
└────────────────────────────────────────────────┘

[error 상태]
┌────────────────────────────────────────────────┐
│                                                │
│   ⚠️ 마이크 접근 권한이 없습니다.              │
│   브라우저 주소창의 마이크 아이콘을 클릭하여   │
│   권한을 허용해 주세요.                        │
│                                                │
│   또는  [ 파일 업로드로 전환 ]                 │
│                                                │
└────────────────────────────────────────────────┘
```

#### 핵심 동작 흐름

```
[● 녹음 시작] 클릭
  → useAudioRecorder.startRecording()
  → 마이크 권한 요청 팝업
    ├── 허용: 녹음 상태로 전환, 타이머 시작
    └── 거부: error 상태 → 안내 메시지 표시

[⬛ 정지] 클릭
  → useAudioRecorder.stopRecording()
  → stopped 상태로 전환

[→ 변환 시작] 클릭
  → onComplete(audioBlob) 호출
  → 부모 컴포넌트에서 /api/transcribe 전송 처리

[🔄 다시 녹음] 클릭
  → useAudioRecorder.resetRecording()
  → idle 상태로 복귀
```

#### 30분 초과 처리

```typescript
// maxDurationSecs(1800) 도달 시 자동 정지
useEffect(() => {
  if (duration >= maxDurationSecs) {
    stopRecording();
    // 사용자에게 토스트: "최대 녹음 시간(30분)에 도달하여 자동으로 정지되었습니다."
  }
}, [duration]);
```

---

### 4-5. `src/components/common/VoiceInputButton.tsx` (P1)

#### Props 인터페이스

```typescript
interface VoiceInputButtonProps {
  onTranscript: (text: string) => void; // STT 결과 텍스트를 부모로 전달
  className?: string;
}
```

#### 동작 흐름

```
마이크 아이콘 버튼 클릭
  → [녹음 중] 상태로 전환 (버튼 빨간색 펄스 애니메이션)
  → 버튼 재클릭 (정지)
  → audioBlob 생성
  → /api/transcribe 호출 (로딩 스피너)
  → transcript 수신
  → onTranscript(transcript.split('\n')[0].trim()) 호출
     (첫 줄만 사용 — 검색창 입력 목적)
  → 입력창에 텍스트 자동 입력
```

#### 사용 위치

```tsx
// 검색 페이지 입력창 우측
<div className="relative">
  <input type="text" value={query} onChange={...} placeholder="문서 검색..." />
  <VoiceInputButton
    className="absolute right-3 top-1/2 -translate-y-1/2"
    onTranscript={(text) => setQuery(text)}
  />
</div>
```

---

### 4-6. STT 회의록 페이지 탭 통합 (P0)

기존 파일 업로드 UI가 있는 페이지/컴포넌트를 파악한 후, "파일 업로드" / "직접 녹음" 탭을 추가한다.

#### 탭 상태 관리

```typescript
const [inputMode, setInputMode] = useState<'file' | 'record'>('file');
```

#### 탭 레이아웃

```
┌──────────────────────────────────────────────────┐
│  [📁 파일 업로드]   [🎙 직접 녹음]               │
├──────────────────────────────────────────────────┤
│                                                  │
│  (inputMode === 'file' ? 기존 업로드 UI : )      │
│  (inputMode === 'record' ? AudioRecorder : )     │
│                                                  │
└──────────────────────────────────────────────────┘
```

#### AudioRecorder onComplete 처리

```typescript
// 녹음 완료 시 기존 파일 업로드와 동일한 처리 흐름
async function handleRecordingComplete(blob: Blob) {
  setIsTranscribing(true);
  try {
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const formData = new FormData();
    formData.append('file', blob, `recording.${ext}`);

    const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      // 기존 파일 업로드 성공 이후와 동일한 처리
      setTranscriptResult(data.data);

      // P1: extractedTodos가 있으면 TodoExtractModal 자동 열기
      if (data.data.extractedTodos?.length > 0) {
        setExtractedTodos(data.data.extractedTodos);
        setIsTodoModalOpen(true);
      }
    }
  } finally {
    setIsTranscribing(false);
  }
}
```

---

### 4-7. contract-risk 페이지 음성 입력 (P1)

계약 리스크 분석 페이지에서 텍스트 파일 업로드 외 음성 녹음 탭을 추가한다.

**특이점**: contract-risk는 텍스트 분석이 목적이므로, 녹음 완료 후 `/api/transcribe`로 STT만 수행(회의록 생성 불필요). transcript 텍스트를 리스크 분석 입력으로 직접 전달한다.

```typescript
// contract-risk 페이지의 녹음 완료 처리
async function handleContractRecordingComplete(blob: Blob) {
  // 1. STT 수행 (회의록 저장 목적 아님 — transcript만 추출)
  const formData = new FormData();
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  formData.append('file', blob, `recording.${ext}`);

  const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
  const data = await res.json();

  if (data.success) {
    // 2. transcript를 계약서 텍스트로 사용하여 리스크 분석 시작
    await analyzeContractRisk(data.data.transcript);
  }
}
```

---

## 5. 파형 시각화 설계 (P2)

### 5-1. 원리

`AnalyserNode.getByteFrequencyData()`로 실시간 주파수 데이터를 가져와 Canvas 또는 div 배열로 렌더링한다.

### 5-2. `WaveformVisualizer.tsx` (P2 전용 하위 컴포넌트)

```typescript
interface WaveformVisualizerProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
  barCount?: number; // 기본값: 20
}
```

```typescript
// requestAnimationFrame 기반 실시간 렌더링
useEffect(() => {
  if (!analyserNode || !isRecording) return;

  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  let animId: number;
  function draw() {
    animId = requestAnimationFrame(draw);
    analyserNode!.getByteFrequencyData(dataArray);
    // barCount개 구간으로 평균 내어 높이 계산
    setBarHeights(computeBarHeights(dataArray, barCount ?? 20));
  }
  draw();

  return () => cancelAnimationFrame(animId);
}, [analyserNode, isRecording]);
```

---

## 6. 에러 처리 설계

### 6-1. 에러 케이스별 처리

| 케이스 | 발생 위치 | 처리 방법 |
|--------|-----------|-----------|
| 마이크 권한 거부 | `startRecording()` | `error` 상태 설정 → 안내 UI + "파일 업로드로 전환" 버튼 표시 |
| MediaRecorder 미지원 브라우저 | `startRecording()` | `error` 상태 설정 → "파일 업로드" 탭으로 자동 전환 |
| 30분 초과 자동 정지 | `useAudioRecorder` 내부 | 자동 `stopRecording()` + 토스트 안내 |
| 파일 크기 초과 (>4.5MB Vercel 제한) | `handleRecordingComplete` | 전송 전 `blob.size` 체크 → 초과 시 "녹음이 너무 깁니다. 10분 이내로 녹음해 주세요." 토스트 |
| `/api/transcribe` 오류 | `handleRecordingComplete` | 기존 파일 업로드 에러 처리와 동일 (토스트 에러 메시지) |
| `AudioContext` 생성 실패 | `startRecording()` | 파형 없이 녹음만 진행 (`analyserNode: null`, 파형 UI 비표시) |

### 6-2. Vercel 4.5MB 제한 대응

```typescript
// 전송 전 파일 크기 검사
const MAX_SIZE = 4 * 1024 * 1024; // 4MB (여유 확보)

if (audioBlob.size > MAX_SIZE) {
  showToast('녹음 파일이 너무 큽니다. 10분 이내 녹음만 전송 가능합니다.', 'error');
  return;
}
```

**보완책**: `maxDurationSecs` 기본값을 600초(10분)로 낮추는 것을 권장. 10분 webm 파일은 약 6~8MB이므로 주의. 실제 테스트 후 조정 필요.

---

## 7. 구현 순서 (Phase별 체크리스트)

### Phase 1 — useAudioRecorder 훅 (P0)

- [ ] `src/hooks/useAudioRecorder.ts` 신규 생성
  - [ ] `UseAudioRecorderReturn` 인터페이스 정의
  - [ ] `startRecording()` — getUserMedia + MediaRecorder 시작 + 타이머
  - [ ] `stopRecording()` — MediaRecorder 정지 + 타이머 해제
  - [ ] `pauseRecording()` / `resumeRecording()` — MediaRecorder pause/resume
  - [ ] `resetRecording()` — Object URL 해제 + 상태 초기화
  - [ ] MIME 타입 자동 감지 (webm/mp4 분기)
  - [ ] 마이크 권한 거부 에러 처리
  - [ ] 브라우저 미지원 체크
  - [ ] AnalyserNode 연결 (P2 준비 — 변수만 세팅, 시각화 미구현)
  - [ ] 컴포넌트 언마운트 시 stream.getTracks().stop() 정리

### Phase 2 — AudioRecorder 컴포넌트 (P0)

- [ ] `src/components/common/AudioRecorder.tsx` 신규 생성
  - [ ] idle / recording / paused / stopped / error 상태별 UI 분기
  - [ ] 녹음 버튼 (펄스 애니메이션: `animate-pulse` Tailwind)
  - [ ] 타이머 표시 (MM:SS 포맷)
  - [ ] 일시정지 / 재개 버튼
  - [ ] 정지 버튼 → `onComplete(blob)` 호출 전 "변환 시작" 확인 단계
  - [ ] 미리듣기 `<audio>` 엘리먼트 (stopped 상태)
  - [ ] 다시 녹음 버튼 (`resetRecording()`)
  - [ ] 마이크 권한 에러 UI 및 "파일 업로드로 전환" 콜백
  - [ ] maxDurationSecs 도달 시 자동 정지 + 안내 토스트

### Phase 3 — STT 회의록 페이지 탭 통합 (P0)

- [ ] STT 회의록 페이지/컴포넌트 파악 (실제 파일 경로 확인 필요)
- [ ] "파일 업로드" / "직접 녹음" 탭 UI 추가
  - [ ] `inputMode` state (`'file' | 'record'`)
  - [ ] 탭 전환 UI (기존 디자인 시스템 탭 컴포넌트 활용)
- [ ] `AudioRecorder` 컴포넌트 연결
- [ ] `handleRecordingComplete()` 구현 (blob → FormData → `/api/transcribe`)
- [ ] isTranscribing 로딩 상태 기존 UI에 통합
- [ ] P1 연동: extractedTodos 있으면 `TodoExtractModal` 자동 표시

### Phase 4 — VoiceInputButton (P1)

- [ ] `src/components/common/VoiceInputButton.tsx` 신규 생성
  - [ ] 마이크 아이콘 버튼 (소형, Lucide `Mic` 아이콘 활용)
  - [ ] 클릭 → 녹음 시작/정지 토글
  - [ ] 녹음 중: 빨간색 + 펄스 애니메이션
  - [ ] 정지 후 `/api/transcribe` 호출 (인라인, 로딩 스피너)
  - [ ] transcript → `onTranscript()` 콜백 호출
- [ ] `src/app/(dashboard)/search/page.tsx` 수정
  - [ ] `VoiceInputButton` import + 검색 입력창 우측 삽입
  - [ ] `onTranscript` → `setQuery()` 연결

### Phase 5 — contract-risk 음성 입력 (P1)

- [ ] `src/app/(dashboard)/contract-risk/page.tsx` 수정
  - [ ] "텍스트/파일 업로드" / "음성 녹음" 탭 추가
  - [ ] `AudioRecorder` 연결
  - [ ] `handleContractRecordingComplete()` 구현 (STT → 리스크 분석)

### Phase 6 — 파형 시각화 (P2)

- [ ] `src/components/common/WaveformVisualizer.tsx` 신규 생성
  - [ ] `AnalyserNode` 기반 `requestAnimationFrame` 루프
  - [ ] 주파수 데이터 → 막대 높이 계산 (`computeBarHeights`)
  - [ ] 언마운트 시 `cancelAnimationFrame` 정리
- [ ] `AudioRecorder.tsx`에 `WaveformVisualizer` 통합 (recording 상태에서만 표시)

### Phase 7 — 검증

- [ ] Chrome에서 녹음 시작 → 권한 허용 → webm blob 생성 확인
- [ ] Safari에서 녹음 → mp4 blob 생성 확인
- [ ] 녹음 blob → `/api/transcribe` → 회의록 생성 정상 확인
- [ ] 마이크 권한 거부 시 에러 UI 표시 + "파일 업로드로 전환" 동작
- [ ] P1: AI 검색창 마이크 버튼 → STT → 검색창 자동 입력
- [ ] P1: 녹음 → meeting-todo 원스톱 (STT 완료 후 TodoExtractModal 자동 표시)
- [ ] 기존 파일 업로드 STT 경로 회귀 없음 확인
- [ ] Object URL 메모리 누수 없음 (DevTools Memory 탭 확인)

---

## 8. 주요 기술 결정

| 결정 | 이유 |
|------|------|
| 서버 변경 없음 | 기존 `/api/transcribe`가 FormData `file` 필드로 Blob을 동일하게 처리 가능 |
| 라이브러리 미사용 | `MediaRecorder API`가 브라우저 표준으로 추가 의존성 불필요 |
| MIME 타입 동적 감지 | Chrome(webm)/Safari(mp4) 호환을 위해 `MediaRecorder.isTypeSupported()`로 런타임 분기 |
| Object URL 수동 해제 | `URL.revokeObjectURL()` — 메모리 누수 방지 필수. `resetRecording()`에서 반드시 호출 |
| admin 클라이언트 미사용 | 프론트엔드 레이어만 추가이므로 서버 권한 변경 없음 |
| maxDurationSecs 기본 600초 | Vercel 4.5MB 요청 제한 대응 (10분 webm ≈ 6~8MB, 실제 테스트 필요) |

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-04-12 | 최초 작성 | 크로미 (PM/Design) |
