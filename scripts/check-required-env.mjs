#!/usr/bin/env node
/**
 * 필수 환경변수 배포 게이트
 *
 * 배경: v7.75.0에서 CSRF 보호 계층(withMutation/csrfFetch)을 전역 변이 API에 도입했으나
 *       필수 env `CSRF_SECRET`을 운영에 설정하지 않아, /api/csrf가 503 → 모든 변이 요청이
 *       "보안 토큰이 만료되었거나 유효하지 않습니다." 403으로 전면 고장났다(2026-10-19).
 *       "로컬/빌드 통과 ≠ 운영 동작" — 빌드는 env 유무를 검사하지 않기 때문.
 *
 * 역할: 빌드 전(package.json build 스크립트에 체인)에 필수 env 존재를 검사한다.
 *   - Vercel/CI 빌드(process.env.VERCEL 또는 CI): 누락 시 비정상 종료(exit 1)로 "배포 차단".
 *   - 로컬: 로컬 .env.local은 의도적으로 부분적일 수 있으므로 경고만 하고 통과(exit 0).
 *     (로컬 검증 흐름 full-check 등을 막지 않기 위함)
 *
 * 의존성 없음(ESM). .env 파일은 직접 파싱한다(prebuild node 스크립트는 .env 자동 로드 안 됨).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// 하나라도 없으면 앱 전체(또는 변이 전면)가 고장나는 핵심 키.
// 배열 항목은 "대안 그룹" — 그 중 하나만 있으면 충족(예: CSRF_SECRET 또는 폴백 JWT_SECRET).
const REQUIRED = [
  ["CSRF_SECRET", "JWT_SECRET"], // 변이 CSRF 가드. 이번 사고의 원인.
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
];

// 없으면 특정 기능만 비활성 — 경고만 한다.
const RECOMMENDED = [
  "CREDENTIAL_ENCRYPTION_KEY",
  "INTERNAL_API_SECRET",
  "DAILY_API_KEY",
  "LAW_API_KEY",
];

/** 단순 .env 파서(KEY=value, 따옴표/주석/export 접두 처리). 값은 그대로 보존. */
function parseEnvFile(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (let line of readFileSync(file, "utf8").split("\n")) {
    line = line.replace(/^\s*export\s+/, "");
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=(.*)$/);
    if (!m) continue;
    let [, key, val] = m;
    val = val.trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const onVercelOrCI = Boolean(process.env.VERCEL || process.env.CI);

// 빌드 시점에 실제로 보이는 값: process.env 우선, 없으면 로컬 .env 파일로 보완.
// Vercel에는 .env 파일이 배포되지 않으므로(gitignore) process.env만 유효 — 이것이 게이트의 핵심.
const fileEnv = {
  ...parseEnvFile(resolve(ROOT, ".env")),
  ...parseEnvFile(resolve(ROOT, ".env.local")),
};
const lookup = (key) => {
  const fromProc = process.env[key];
  if (fromProc !== undefined) return fromProc;
  return fileEnv[key];
};

const present = (key) => {
  const v = lookup(key);
  return typeof v === "string" && v.trim().length > 0;
};

const missing = [];
const whitespaceWarn = [];

for (const entry of REQUIRED) {
  const alts = Array.isArray(entry) ? entry : [entry];
  if (!alts.some(present)) {
    missing.push(alts.join(" 또는 "));
  }
  // 값 끝 공백/개행 함정(클리오 고질: anon key %0A → Realtime CHANNEL_ERROR 등)
  for (const k of alts) {
    const v = lookup(k);
    if (typeof v === "string" && v.length > 0 && v !== v.trim()) {
      whitespaceWarn.push(k);
    }
  }
}

const recMissing = RECOMMENDED.filter((k) => !present(k));

const scope = onVercelOrCI ? "Vercel/CI 빌드" : "로컬 빌드";
console.log(`🔐 필수 환경변수 점검 (${scope})`);

if (whitespaceWarn.length) {
  console.warn(
    `⚠️  값 앞뒤 공백/개행 감지(함정 주의): ${whitespaceWarn.join(", ")}`,
  );
}
if (recMissing.length) {
  console.warn(`⚠️  권장 env 누락(해당 기능만 비활성): ${recMissing.join(", ")}`);
}

if (missing.length === 0) {
  console.log("✅ 필수 환경변수 모두 설정됨");
  process.exit(0);
}

console.error("");
console.error("❌ 필수 환경변수 누락:");
for (const m of missing) console.error(`   - ${m}`);
console.error("");

if (onVercelOrCI) {
  console.error(
    "🚫 배포를 중단합니다. Vercel 프로젝트 설정(Production/Preview/Development)에 위 env를 추가하세요.",
  );
  console.error("   예: vercel env add CSRF_SECRET production");
  process.exit(1);
}

// 로컬: 부분 env일 수 있으므로 차단하지 않고 경고만.
console.error(
  "ℹ️  로컬 빌드라 통과시킵니다(로컬 .env.local은 부분적일 수 있음). 운영 배포 전 반드시 설정하세요.",
);
process.exit(0);
