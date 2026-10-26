# Supabase 리전 이전 계획서 (뭄바이 → 서울)

> 작성일: 2026-10-26 · 대상: Clio 운영 Supabase (`cxsaohiwkeebgshxcypa`)
> 목적: DB 리전을 **South Asia (Mumbai) `ap-south-1`** → **Northeast Asia (Seoul) `ap-northeast-2`** 로 이전해
> Vercel(서울 icn1)과의 왕복 지연(로그인·데이터 각 1~2초)을 근본 제거.
> 결정: **Free 플랜 유지**(리전만). 다운타임은 **계획 승인 후** 별도 확정.

---

## 1. 배경 (측정 근거)
- 로그인 API: auth(bcrypt) 1~2초 + 프로필 select 1~2초, 콜드 시 3~8초.
- Supabase **edge(health)는 0.06초**로 빠름 → 네트워크가 아니라 **DB 왕복/연산**이 병목.
- 대시보드 실측: DB가 **뭄바이 `ap-south-1` · t4g.nano · Free · Disk IO budget 고갈 임박**.
- Vercel 함수는 서울(icn1) → 매 쿼리가 서울↔인도 왕복 = 지연의 최대 근본.

## 2. 핵심 제약
- **Supabase는 리전 변경 불가** → 서울에 **새 프로젝트 생성 + 전체 데이터 이전**이 유일.
- Free 플랜 = 조직당 프로젝트 2개까지. 현재 1개(뭄바이) → 서울 1개 추가 가능(이전 후 뭄바이 삭제).
- Free 서울도 compute는 Nano → 리전 왕복은 해결되나 **bcrypt(로그인 CPU)는 약간 느림 잔존**(대장 '리전만' 결정).

## 3. 이전 대상 (하나라도 빠지면 장애)
| 대상 | 누락 시 영향 | 방법 |
|---|---|---|
| public 스키마(테이블·데이터) | 데이터 전무 | pg_dump/restore 또는 `supabase db dump` |
| **auth.users (비밀번호 해시)** | **전원 로그인 불가** | auth 스키마 포함 dump/restore |
| **Storage 파일**(서명·문서 blob) | 서명·첨부 안 보임 | storage.objects(메타) + 실제 파일 API 복사 |
| RLS 정책·트리거·함수 (050/051 등) | 보안 구멍·권한 오류 | 스키마 dump에 포함 / migrations 재적용 |
| extensions (pgcrypto 등) | 함수 실패 | restore 전 활성화 |
| env (URL·anon·service_role) | 연결 실패 | Vercel 3환경 교체 |
| cron·Realtime | 동기화·알림 중단 | 재배포 후 확인(cron은 Vercel, DB만 교체) |

## 4. 준비물 (Phase 0 전에)
- [ ] **Postgres client 설치**: `brew install libpq` 후 PATH 추가 (psql/pg_dump/pg_restore) — 현재 미설치
- [ ] Supabase CLI 2.75.0 (설치됨) — 보조
- [ ] 뭄바이 프로젝트 **DB connection string + DB password** (대시보드 > Settings > Database)
- [ ] service_role 키 2개(뭄바이/서울) — Storage 파일 복사용
- [ ] 로컬 백업 보관 경로 (암호화/안전)

## 5. 단계별 절차

### Phase 0 — 백업 (파괴 없음, 최우선)
1. `brew install libpq` → psql/pg_dump 확보
2. 뭄바이 전체 덤프: `pg_dump` 로 roles·public·auth·storage 스키마+데이터 전부 (여러 파일로 분리 권장)
3. Storage 파일 전수 백업(다운로드) — node + service_role로 버킷별 object 전량
4. 백업 무결성 확인(파일 크기·건수 기록)
   - ✅ 체크포인트: 백업 없이 다음 단계 금지

### Phase 1 — 서울 프로젝트 생성 (파괴 없음)
1. 대시보드에서 **Region=Northeast Asia(Seoul)**, Free 로 새 프로젝트 생성
2. 새 connection string·anon·service_role 확보
3. 필요한 extensions 활성화(pgcrypto 등 뭄바이와 동일)

### Phase 2 — 스키마·데이터 이전 (서울에만 쓰기, 뭄바이 무손상)
1. 스키마: migrations 50개 재적용(`supabase db push`) **또는** pg_dump 스키마 restore
2. 데이터: `pg_dump --data-only` → 서울 restore (FK 순서·시퀀스 주의)
3. **auth.users**: auth 스키마 포함 dump를 서울에 restore (비번 해시 보존 확인)

### Phase 3 — Storage 이전
1. 서울에 동일 버킷 생성(이름·**private 설정 동일** — files 등)
2. 백업한 파일을 서울 버킷에 업로드(원 경로 유지: `signatures/<id>/...`)
3. storage.objects 메타와 실제 파일 일치 확인

### Phase 4 — 전환 전 검증 (뭄바이 아직 운영 중)
- 테이블별 row count 뭄바이=서울 대조(users·documents·approvals·files 등)
- auth 사용자 수 일치 + 샘플 계정 비번 로그인(서울 DB 직접 token endpoint)
- storage 파일 수·총 크기 일치, 샘플 서명 PNG 다운로드 200
- RLS·트리거 존재 확인(050/051)
  - ✅ 체크포인트: 전부 일치해야 전환

### Phase 5 — 전환 (다운타임 구간, 짧게)
1. (쓰기 중단) 유지보수 모드/공지 — 데이터 작아 수 분 예상
2. **증분 재동기화**: 중단 시점 이후 변경분만 재dump→restore (데이터 적으면 전체 재restore)
3. Vercel env 교체: `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`·`SUPABASE_SERVICE_ROLE_KEY` **3환경(prod/preview/dev)**
4. `deploy clio` (`--prod` 재빌드 — NEXT_PUBLIC은 빌드타임)
5. cron·Realtime(notifications) 연결 확인

### Phase 6 — 전환 후 검증 (운영)
- 운영 로그인 **응답시간 재측정**(뭄바이 대비 개선 확인) — 목표: 왕복 지연 소멸
- 주요 기능: 문서 생성/다운로드, 서명 표시, gmail 동기화, 결재, 알림
- 서명 이미지(storage) 로드 확인
  - ✅ 체크포인트: 이상 시 즉시 롤백(아래)

### Phase 7 — 정리
- 뭄바이 프로젝트 **일정 기간(예: 1~2주) 보관** 후 삭제(즉시 삭제 금지)
- 백업 안전 보관

## 6. 롤백 (안전망)
- **전환(Phase 5) 전까지 뭄바이가 원본** — 서울은 복제본일 뿐, 언제든 중단 가능.
- 전환 후 문제 시: Vercel env를 **뭄바이로 되돌리고 재배포** → 즉시 원복(뭄바이 보관 중이므로).
- 따라서 치명 리스크 구간은 Phase 5~6뿐이며, env 되돌리기로 분 단위 복구 가능.

## 7. 리스크 매트릭스
| 리스크 | 대비 |
|---|---|
| auth 해시 누락 → 전원 로그인 불가 | Phase 4에서 샘플 로그인 검증 필수 |
| storage 파일 누락 → 서명/문서 안 보임 | 파일 수·크기 대조 |
| 전환 중 들어온 데이터 유실 | 쓰기 중단 + 증분 재동기화 |
| env 교체 실수(일부 환경 누락) | 3환경 모두 교체 체크, 개행 함정 printf |
| RLS/트리거 누락 → 권한상승 구멍 | 050/051 존재 확인 |
| Free 2프로젝트 한계 | 이전 후 뭄바이 삭제로 해소 |

## 8. 다운타임 추정
- 데이터 소규모(users 6명 등)로 보여 **전환 다운타임 수 분~수십 분** 예상. Phase 4 검증까지는 무중단(뭄바이 운영 지속).

## 9. 미결 확인 사항
- [ ] 전환 시점(즉시 vs 새벽 예약) — 대장 확정
- [ ] 유지보수 공지 방식(앱 내 배너/점검 플래그) 필요 여부
- [ ] `brew install libpq` 승인

---
**승인 후 Phase 0(백업)부터 착수합니다. 전환(Phase 5) 직전 반드시 재확인받습니다.**
