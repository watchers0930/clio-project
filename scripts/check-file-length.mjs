#!/usr/bin/env node
/**
 * 파일 줄 수 배포 게이트 — 플랫폼 원칙 "파일 500줄 제한"
 *
 * 배경: 500줄 상한을 막는 장치가 Claude 세션 훅뿐이라, 다른 경로로 수정하면 그대로 통과해
 *       500줄 초과 파일이 6개까지 쌓였다(2026-11-14 전수 확인 후 분리).
 *       린트는 배포 때 돌지 않고 기존 오류가 있어 게이트로 쓸 수 없어, 별도 스크립트로 둔다.
 *
 * 역할: 빌드 전(package.json prebuild 체인)에 src 의 .ts/.tsx 줄 수를 검사한다.
 *   - 500줄 초과: 비정상 종료(exit 1)로 빌드·배포 차단(로컬·Vercel 동일 — 결과가 환경에 따라 달라지지 않음)
 *   - 450줄 초과: 경고만 출력(분리 예고)
 *   - 제외: .d.ts(타입 선언), src/.next(빌드 산출물)
 * 줄 수는 `wc -l`과 같은 방식(줄바꿈 개수)으로 센다.
 *
 * 의존성 없음(ESM).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_LINES = 500;
const WARN_LINES = 450;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src");

function collect(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".next" || entry.name === "node_modules") continue;
      collect(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

const countLines = (file) => (readFileSync(file, "utf8").match(/\n/g) ?? []).length;

const rows = collect(srcDir, [])
  .map((file) => ({ path: relative(root, file), lines: countLines(file) }))
  .sort((a, b) => b.lines - a.lines);

const over = rows.filter((r) => r.lines > MAX_LINES);
const near = rows.filter((r) => r.lines > WARN_LINES && r.lines <= MAX_LINES);

console.log(`📏 파일 줄 수 점검 (상한 ${MAX_LINES}줄, 경고 ${WARN_LINES}줄 초과)`);

if (near.length) {
  console.warn(`⚠️  ${WARN_LINES}줄 초과 ${near.length}개 — 다음 수정 전에 분리 권장:`);
  for (const r of near) console.warn(`   - ${r.path} (${r.lines}줄)`);
}

if (over.length === 0) {
  console.log(`✅ ${MAX_LINES}줄 초과 파일 없음`);
  process.exit(0);
}

console.error("");
console.error(`❌ ${MAX_LINES}줄 초과 파일:`);
for (const r of over) console.error(`   - ${r.path} (${r.lines}줄)`);
console.error("");
console.error("🚫 빌드를 중단합니다. 책임 단위로 파일을 분리한 뒤 다시 배포하세요.");
process.exit(1);
