# CLIO P2 설계서

**작성일:** 2026-04-12
**버전:** v1.0
**대상:** P2-1 실시간 메시지 / P2-2 전자서명 삽입 / P2-3 AI Q&A

---

## 현재 구현 상태

| 항목 | API | DB | UI | 렌더러 |
|------|-----|----|----|--------|
| P2-2 전자서명 | ✅ 완료 | ✅ 완료 | ✅ 완료 | ❌ 미구현 |
| P2-3 AI Q&A | ✅ 완료 | — | ✅ 완료 | — |

---

## P2-1. 실시간 메시지

설계서 불필요. 단순 교체 작업.

### 변경 내용

```
현재: setInterval(5초) → fetch('/api/messages')
변경: supabase.channel().on('postgres_changes') → 즉시 수신
```

### 구현 패턴

```typescript
// 채널 구독
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

// 채널 이탈 시 반드시 정리
return () => { supabase.removeChannel(sub); };
```

### 수정 파일

- `src/app/(app)/messages/page.tsx` — setInterval 제거, Realtime 구독으로 교체

### 주의사항

- 채널 전환 시 이전 구독 해제 필수 (메모리 누수 방지)
- 초기 메시지 로드는 기존 fetch 유지 (Realtime은 신규 메시지만 수신)
- 폴링 코드(`setInterval`) 완전 제거

---

## P2-2. 전자서명 삽입

### 삽입 방식: A+C 혼합

| 방식 | 조건 | 동작 |
|------|------|------|
| A. 키워드 탐색 | 템플릿에 "서명" 텍스트 셀 존재 시 | 해당 셀에 이미지 삽입 |
| C. 고정 블록 추가 | 서명 셀 없을 때 | 문서 마지막에 서명 Table 블록 추가 |

### 서명 없을 때 동작

- `signature_path = null` → `signatureBuffer = null` → 삽입 단계 스킵, 기존 동작 유지
- 에러 없음, 서명란 빈칸 유지

### 구현 흐름

```
POST /api/generate
  ├── 1. users.signature_path 조회
  ├── 2. signature_path 있으면 Storage에서 이미지 Buffer 다운로드
  └── 3. 렌더러에 signatureBuffer 전달

docx-renderer.ts
  ├── signatureBuffer 없으면 → 기존 동작 그대로
  ├── "서명" 키워드 셀 탐색 (w:tc 내 텍스트 검색)
  │     있으면 → ImageRun으로 해당 위치에 삽입
  └── 없으면 → 문서 마지막에 서명 Table 블록 추가

hwpx-renderer.ts
  ├── signatureBuffer 없으면 → 기존 동작 그대로
  ├── "서명" 키워드 hp:tc 탐색
  │     있으면 → <hp:picture> XML 삽입
  └── 없으면 → 마지막 단락에 이미지 블록 추가
```

### 수정 파일

```
src/app/api/generate/route.ts        — signature_path 조회 + Buffer 다운로드 + 렌더러에 전달
src/lib/renderers/types.ts           — RenderOptions에 signatureBuffer?: Buffer 추가
src/lib/renderers/docx-renderer.ts   — 서명 이미지 삽입 로직
src/lib/renderers/hwpx-renderer.ts   — 서명 이미지 삽입 로직
```

### DOCX 서명 삽입 상세

```typescript
// docx ImageRun
new ImageRun({
  data: signatureBuffer,
  transformation: { width: 120, height: 40 },  // 서명 크기 고정
  type: 'png',
})
```

### HWPX 서명 삽입 상세

```xml
<!-- hp:picture 태그로 이미지 삽입 -->
<hp:picture>
  <hp:inst id="..." zOrder="0" numberingType="pic" textWrap="square">
    <hp:sz width="3402" height="1134"/>  <!-- 120x40 HWP 단위 환산 -->
  </hp:inst>
</hp:picture>
```

---

## P2-3. AI Q&A

### 현재 상태

- `/api/chat`: 벡터 검색 → GPT-4o-mini → fileIds 필터 완전 구현
- `search/page.tsx`: 채팅 패널 UI 구현됨

### 확인 및 패치 항목

1. `sendChat()`에서 fileIds가 검색 결과 file_id 배열로 전달되는지 확인
2. 채팅 패널 UX 점검 (입력창, 메시지 목록, 로딩 상태)
3. 파일 미선택 시 안내 메시지 표시 여부

### 수정 파일

- `src/app/(app)/search/page.tsx` — fileIds 연동 확인 및 UX 개선

---

## 작업 순서

```
Step 1. P2-1 실시간 메시지     (30분)
Step 2. P2-3 AI Q&A 확인/패치  (1시간)
Step 3. P2-2 전자서명 렌더러    (3시간)
```

---

## 절대 하지 말 것

- 설계서에 없는 파일 임의 수정 금지
- 서명 위치를 하드코딩하지 말 것 (A+C 혼합 방식 준수)
- HWPX ZIP 생성 시 mimetype STORE 규칙 유지 (기존 구현 참조)
- 임의 판단으로 설계 변경 시 대장님 확인 먼저
