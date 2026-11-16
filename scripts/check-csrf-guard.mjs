#!/usr/bin/env node
/**
 * CSRF 가드 배포 게이트 — 쿠키 세션으로 동작하는 변이 API 는 반드시 CSRF·출처 확인을 거친다
 *
 * 배경(2026-11-16 전수 집계): 변이 라우트 110개 중 78개가 CSRF 확인 없이 열려 있었다.
 *   라우트마다 손으로 붙이는 방식은 새 API 에서 빠지기 쉬워, 빌드 전에 검사해 빠짐을 막는다.
 *
 * 판정: scripts/csrf-guard-scan.mjs (핸들러 본문 단위, 주석 제외, 해석 불가=unknown)
 * 예외: src/lib/http/csrf-exempt-routes.json (사유 필수, 실제 라우트에 없는 예외는 오류)
 * 모드: 기본=보고(목록만 출력, 빌드는 통과) / --strict=미보호·unknown 이 있으면 exit 1
 *   단계적 전환 중이라 보고 모드로 시작하고, 마지막 단계에서 prebuild 를 --strict 로 바꾼다.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { scanRouteSource, routeFromPath, verifyDelegate } from "./csrf-guard-scan.mjs";

const strict = process.argv.includes("--strict");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// API 밖 route 핸들러도 쿠키 세션으로 변이할 수 있으므로 src/app 전체를 본다
const appDir = join(root, "src/app");

// 위임 함수: 그 함수 파일이 실제로 가드를 거치는지 구문 트리로 확인한 뒤에만 인정
const DELEGATE_FILES = {
  generateDocument: "src/lib/generation/generate-document.ts",
  handleAttendance: "src/lib/http/attendance-handler.ts",
};
const delegates = {};
for (const [name, file] of Object.entries(DELEGATE_FILES)) {
  const path = join(root, file);
  delegates[name] = existsSync(path) && verifyDelegate(name, readFileSync(path, "utf8"), file);
  if (!delegates[name]) console.log(`⚠️  위임 함수 ${name} 의 가드를 확인하지 못해 인정하지 않음 (${file})`);
}

function collect(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      collect(full, out);
    }
    else if (/^route\.(ts|tsx|js|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const exempt = JSON.parse(readFileSync(join(root, "src/lib/http/csrf-exempt-routes.json"), "utf8"));
const noReason = exempt.filter((e) => typeof e.reason !== "string" || e.reason.trim().length < 5);
if (noReason.length) {
  console.error(`❌ 예외 목록에 사유가 없는 항목: ${noReason.map((e) => e.route).join(", ")}`);
  process.exit(1);
}
const exemptKey = new Set(exempt.flatMap((e) => e.methods.map((m) => `${m} ${e.route}`)));
const problems = [];
const seenExempt = new Set();
let total = 0;
let protectedCount = 0;

for (const file of collect(appDir, []).sort()) {
  const route = routeFromPath(relative(root, file));
  for (const r of scanRouteSource(readFileSync(file, "utf8"), delegates, relative(root, file))) {
    total++;
    const key = `${r.method} ${route}`;
    if (exemptKey.has(key)) {
      seenExempt.add(key);
      continue;
    }
    if (r.status === "protected") protectedCount++;
    else problems.push(`${r.status === "unknown" ? "판정불가" : "미보호"}  ${key}`);
  }
}

const staleExempt = [...exemptKey].filter((k) => !seenExempt.has(k));
console.log(`🛡️  CSRF 가드 점검 — 변이 핸들러 ${total}개: 보호 ${protectedCount} · 예외 ${seenExempt.size} · 미보호/판정불가 ${problems.length}`);
if (staleExempt.length) {
  console.error("❌ 예외 목록에 있지만 실제 라우트가 없는 항목(목록 정리 필요):");
  for (const k of staleExempt) console.error(`   - ${k}`);
  process.exit(1);
}
if (problems.length) {
  const head = strict ? "❌" : "⚠️ ";
  console.log(`${head} CSRF 확인 없는 변이 핸들러 ${problems.length}개${strict ? " — 빌드 차단" : " (보고 모드: 빌드는 계속)"}:`);
  for (const p of problems) console.log(`   - ${p}`);
  if (strict) process.exit(1);
} else {
  console.log("✅ 모든 변이 핸들러가 CSRF 확인을 거친다");
}
