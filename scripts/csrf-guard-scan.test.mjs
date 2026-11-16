import { test } from "node:test";
import assert from "node:assert/strict";
import { scanRouteSource, routeFromPath, verifyDelegate } from "./csrf-guard-scan.mjs";

const IMP = `import { withMutation } from '@/lib/http/mutation-guard';\nimport { feeMutationGate } from '@/lib/maintenance-fees/route-guard';\nimport { bulkTransferMutationGate } from '@/lib/bulk-transfer/route-guard';\nimport { handleAttendance } from '@/lib/http/attendance-handler';\nimport { generateDocument } from '@/lib/generation/generate-document';\n`;
const verified = { generateDocument: true, handleAttendance: true };
const scan = (body, delegates = verified) => scanRouteSource(IMP + body, delegates);
const status = (body, delegates) => scan(body, delegates).map((r) => `${r.method}:${r.status}`).join(",");

test("가드 + 결과 확인(if x.error return) → 보호", () => {
  assert.equal(status(`export async function POST(request: NextRequest) {\n  const mutation = await withMutation(request);\n  if (mutation.error) return mutation.error;\n  return ok();\n}`), "POST:protected");
});

test("가드 결과를 확인하지 않으면 미보호", () => {
  assert.equal(status(`export async function POST(request) { await withMutation(request); return doWrite(); }`), "POST:unprotected");
  assert.equal(status(`export async function POST(request) { const m = await withMutation(request); return doWrite(); }`), "POST:unprotected");
});

test("핸들러 밖 helper·중첩 함수·죽은 코드·문자열 안의 가드는 인정 안 함", () => {
  assert.equal(status(`export async function POST(req) { return doWrite() }\nasync function helper(req) { const m = await withMutation(req); if (m.error) return m.error; }`), "POST:unprotected");
  assert.equal(status(`export async function POST(request) { if (false) { const m = await withMutation(request); if (m.error) return m.error; } return doWrite() }`), "POST:unprotected");
  assert.equal(status(`export async function POST(request) { const f = async () => { const m = await withMutation(request); if (m.error) return m.error; }; return doWrite() }`), "POST:unprotected");
  assert.equal(status(`export async function POST(request) { const s = "const m = await withMutation(request); if (m.error) return m.error;"; return doWrite() }`), "POST:unprotected");
});

test("가드 앞에 await 쓰기가 있으면 미보호, await params·검증 return 은 허용", () => {
  assert.equal(status(`export async function POST(request) { await doWrite(); const m = await withMutation(request); if (m.error) return m.error; }`), "POST:unprotected");
  assert.equal(status(`export async function PATCH(request, { params }) {\n  const { id } = await params;\n  if (!UUID_RE.test(id)) return NextResponse.json({}, { status: 400 });\n  const gate = await bulkTransferMutationGate(request);\n  if (gate.error) return gate.error;\n}`), "PATCH:protected");
});

test("MIME 문자열('image/*')·URL('https://')이 판정을 흐리지 않음", () => {
  const src = `export async function POST(request) { const a = 'image/*'; return doWrite() }\nexport async function DELETE(request) { const b = '*/'; const u = 'https://x.y'; const m = await withMutation(request); if (m.error) return m.error; }`;
  assert.equal(status(src), "POST:unprotected,DELETE:protected");
});

test("매개변수 이름 그대로(_request) 인정, 다른 값을 넘기면 불인정", () => {
  assert.equal(status(`export async function DELETE(_request: NextRequest, { params }) {\n  const mutation = await withMutation(_request);\n  if (mutation.error) return mutation.error;\n}`), "DELETE:protected");
  assert.equal(status(`export async function POST(request) { const fake = new Request('x'); const m = await withMutation(fake); if (m.error) return m.error; }`), "POST:unprotected");
});

test("다른 모듈에서 가져온 같은 이름의 가드는 불인정", () => {
  const src = `import { withMutation } from './fake';\nexport async function POST(request) { const m = await withMutation(request); if (m.error) return m.error; }`;
  assert.equal(scanRouteSource(src, verified).map((r) => r.status).join(), "unprotected");
});

test("handleAttendance 는 true 일 때만, generateDocument 는 검증된 위임일 때만", () => {
  assert.equal(status(`export async function POST(request) {\n  return handleAttendance(request, true, async () => 1);\n}`), "POST:protected");
  assert.equal(status(`export async function POST(request) {\n  return handleAttendance(request, false, async () => 1);\n}`), "POST:unprotected");
  assert.equal(status(`export async function POST(request: NextRequest) { return generateDocument(request); }`), "POST:protected");
  assert.equal(status(`export async function POST(request: NextRequest) { return generateDocument(request); }`, { handleAttendance: true }), "POST:unprotected");
});

test("async 없는 선언·화살표 export 도 집계, 재내보내기·export * 는 판정불가", () => {
  assert.equal(status(`export function POST(request) { return doWrite() }`), "POST:unprotected");
  assert.equal(status(`export const DELETE = async (request) => { const m = await withMutation(request); if (m.error) return m.error; };`), "DELETE:protected");
  assert.equal(status(`async function h(request) {}\nexport { h as PATCH };`), "PATCH:unknown");
  assert.equal(status(`export * from './other';`), "*:unknown");
  assert.equal(status(`export async function GET() { return 1 }`), "");
});

test("상대 경로 import 도 실제 모듈 위치로 풀어서 비교", () => {
  const ok = `import { withMutation } from '../../../lib/http/mutation-guard';\nexport async function POST(request) { const m = await withMutation(request); if (m.error) return m.error; }`;
  const bad = `import { withMutation } from '../../../lib/fake/mutation-guard';\nexport async function POST(request) { const m = await withMutation(request); if (m.error) return m.error; }`;
  assert.equal(scanRouteSource(ok, verified, "src/app/api/x/route.ts").map((r) => r.status).join(), "protected");
  assert.equal(scanRouteSource(bad, verified, "src/app/api/x/route.ts").map((r) => r.status).join(), "unprotected");
});

test("위임 함수 검증: 상대 import 로 withMutation 을 부르는 handleAttendance 인정", () => {
  const src = `import { withMutation } from "./mutation-guard";\nexport async function handleAttendance(request, mutation, run) {\n  const auth = mutation ? await withMutation(request) : await withAuth();\n  if (auth.error) return auth.error;\n}`;
  assert.equal(verifyDelegate("handleAttendance", src, "src/lib/http/attendance-handler.ts"), true);
  assert.equal(verifyDelegate("handleAttendance", src.replace("./mutation-guard", "./other"), "src/lib/http/attendance-handler.ts"), false);
});

test("내부 호출 겸용 가드 withMutationOrInternal 도 결과 확인 구조면 보호", () => {
  const src = `import { withMutationOrInternal } from '@/lib/http/mutation-guard';\nexport async function POST(request, { params }) {\n  const access = await withMutationOrInternal(request);\n  if (access.error) return access.error;\n}`;
  assert.equal(scanRouteSource(src, verified).map((r) => r.status).join(), "protected");
  const unchecked = src.replace("  if (access.error) return access.error;\n", "");
  assert.equal(scanRouteSource(unchecked, verified).map((r) => r.status).join(), "unprotected");
});

test("route 경로 변환", () => {
  assert.equal(routeFromPath("src/app/api/files/[id]/route.ts"), "/api/files/[id]");
  assert.equal(routeFromPath("src/app/(app)/x/route.tsx"), "/(app)/x");
});

test("출처만 보는 가드(withSameOrigin)는 로그아웃 라우트에서만 보호로 인정", () => {
  const src = `import { withSameOrigin } from '@/lib/http/mutation-guard';\nexport async function POST(request) {\n  const origin = await withSameOrigin(request);\n  if (origin.error) return origin.error;\n  return ok();\n}`;
  const at = (file) => scanRouteSource(src, verified, file).map((r) => `${r.method}:${r.status}`).join(",");
  assert.equal(at("src/app/api/auth/logout/route.ts"), "POST:protected");
  assert.equal(at("src/app/api/memos/route.ts"), "POST:unprotected");
  assert.equal(at(undefined), "POST:unprotected");
});
