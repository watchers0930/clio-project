---
concept: 비동기 AI 처리 + Graceful Degradation 패턴
last_compiled: 2026-04-20
topics_connected: [ai-features, memos, work-logs]
status: active
---

# 비동기 AI 처리 + Graceful Degradation 패턴

## Pattern

CLIO의 모든 AI 후처리는 기본 CRUD 작업을 절대 중단시키지 않는다. 파일 업로드, 메모 저장, 회의록 STT — 어느 경우에도 AI 실패가 사용자 워크플로를 막지 않는다. 패턴은 항상 동일하다: 기본 작업 완료 → AI 처리 비동기 트리거 → 실패 시 빈 값/기본값 fallback.

구체적 구현 전략:
- **fire-and-forget**: 클라이언트에서 await 없이 fetch 호출 (메모 임베딩)
- **try/catch 격리**: 서버 파이프라인 내 AI 단계를 try/catch로 감싸고 로그만 출력 (만료일 추출, 할일 추출)
- **캐시 MISS → 재계산**: 클라이언트는 항상 결과를 받지만, 캐시 없으면 즉시 생성 (메모 그룹)
- **confidence=none 처리**: AI가 확신 없으면 아무것도 하지 않음 (만료일 추출)

## Instances

- **2026-04-17** in [[../topics/ai-features]]: 파일 업로드 후 만료일 추출(`/api/files/[id]/extract-expiry`) — try/catch 격리, confidence='none' 시 INSERT 생략. 업로드 성공이 우선.
- **2026-04-17** in [[../topics/ai-features]]: STT 회의록에서 할일 추출 실패 시 `extractedTodos: []` fallback. 회의록 생성 중단 없음.
- **2026-04-20** in [[../topics/memos]]: 메모 저장 후 임베딩 생성 fire-and-forget. 실패해도 메모 CRUD는 완료. 임베딩 없으면 시맨틱 링크 없이 키워드 링크로만 표시.
- **2026-04-17** in [[../topics/work-logs]]: 주간 요약 AI 생성 실패 시 사용자에게 에러 표시, 기존 일지 데이터는 보존.

## What This Means

이 패턴은 CLIO의 AI가 "선택적 향상(progressive enhancement)" 역할임을 보여준다 — AI가 작동하면 더 좋고, 안 작동해도 기본 기능은 유지된다. 이것이 의도적 설계라면 앞으로도 일관되게 유지해야 한다. 신규 AI 기능 추가 시 반드시 "AI 실패 시나리오"를 먼저 정의하고, 그 fallback이 사용자 경험을 크게 해치지 않는지 확인해야 한다. AI가 없어도 핵심 워크플로가 동작하는가? — 이것이 설계 검증 질문이 되어야 한다.

## Sources

- [[../topics/ai-features]]
- [[../topics/memos]]
- [[../topics/work-logs]]
