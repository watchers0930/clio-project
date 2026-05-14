# CLIO Preview 환경변수 체크리스트

배포 기준일: 2026-04-24  
대상 프로젝트: `/Users/watchers/Desktop/clio-project`

## 목적

Preview 배포에서도 핵심 화면 검수가 가능하도록 최소 환경변수를 정리한다.

## 최소 필요 환경변수

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `INTERNAL_API_SECRET`

## 권장 원칙

- 가능하면 Preview는 Production과 분리된 Supabase 프로젝트를 사용한다.
- `SUPABASE_SERVICE_ROLE_KEY`는 Production 것을 그대로 복사하지 않는 편이 안전하다.
- `OPENAI_API_KEY`도 Preview 전용 제한 키를 쓰는 편이 좋다.

## Preview 점검 순서

1. Vercel Preview 환경에 최소 변수 등록
2. `npx vercel` 또는 Git Preview 배포 실행
3. 로그인 페이지 로드 확인
4. `/files`, `/search`, `/documents`, `/contract-risk` 핵심 화면 확인
5. 파일 업로드, 검색, 문서 생성, 계약 분석 API 정상 응답 확인

## 현재 상태 메모

- Production 배포는 가능한 상태
- Preview는 환경변수 부족 시 실패 가능
- 이후 실사용 QA 전에 Preview 환경을 먼저 맞추는 것이 권장됨
- `middleware deprecated` 경고는 `src/proxy.ts` 전환으로 코드상 정리된 상태
- `lockfile root` 경고는 `next.config.ts`의 `turbopack.root = process.cwd()` 적용 이후 로컬 빌드에서는 재현되지 않음
- 최종 확인은 Preview 배포 로그에서 동일 경고 재발 여부를 보는 단계가 남아 있음

## 2026-05-08 로컬 검증 결과

- `npm run build` 통과
- `npx tsc --noEmit` 통과
- `next.config.ts`의 `typescript.ignoreBuildErrors` 임시 설정 제거
- 따라서 현재 남은 주요 확인 항목은 `Preview 환경변수 주입 상태`와 `Vercel Preview 런타임 검수`다
