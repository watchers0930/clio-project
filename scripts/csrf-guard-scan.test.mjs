import { test } from "node:test";
import assert from "node:assert/strict";
import { scanRouteSource, routeFromPath } from "./csrf-guard-scan.mjs";

const delegates = { generateDocument: true };

test("withMutation(request) 를 부르는 변이 핸들러는 보호됨", () => {
  const src = `export async function POST(request: NextRequest) {\n  const mutation = await withMutation(request);\n}`;
  assert.deepEqual(scanRouteSource(src, delegates), [{ method: "POST", status: "protected" }]);
});

test("가드 없는 변이 핸들러는 미보호, GET 은 대상 아님", () => {
  const src = `export async function GET() { return 1; }\nexport async function DELETE(req: NextRequest) {\n  const supabase = await createServerSupabaseClient();\n}`;
  assert.deepEqual(scanRouteSource(src, delegates), [{ method: "DELETE", status: "unprotected" }]);
});

test("주석 안의 가드 이름은 인정하지 않는다(우회 방지)", () => {
  const src = `export async function PATCH(request: NextRequest) {\n  // withMutation(request) 나중에\n  /* feeMutationGate(request) */\n  return ok();\n}`;
  assert.deepEqual(scanRouteSource(src, delegates), [{ method: "PATCH", status: "unprotected" }]);
});

test("다른 핸들러의 가드는 인정하지 않는다(핸들러 단위)", () => {
  const src = `export async function POST(request: NextRequest) {\n  await withMutation(request);\n}\nexport async function DELETE(request: NextRequest) {\n  return ok();\n}`;
  assert.deepEqual(scanRouteSource(src, delegates), [
    { method: "POST", status: "protected" },
    { method: "DELETE", status: "unprotected" },
  ]);
});

test("handleAttendance 는 mutation=true 일 때만 보호", () => {
  const yes = `export async function POST(request: NextRequest) {\n  return handleAttendance(request, true, async () => 1);\n}`;
  const no = `export async function POST(request: NextRequest) {\n  return handleAttendance(request, false, async () => 1);\n}`;
  assert.equal(scanRouteSource(yes, delegates)[0].status, "protected");
  assert.equal(scanRouteSource(no, delegates)[0].status, "unprotected");
});

test("도메인 가드·검증된 위임 함수 인정, 미검증 위임은 미보호", () => {
  const fee = `export async function POST(request: NextRequest) {\n  const gate = await feeMutationGate(request);\n}`;
  const bt = `export async function PUT(request: NextRequest) {\n  const gate = await bulkTransferMutationGate(request);\n}`;
  const gen = `export async function POST(request: NextRequest) { return generateDocument(request); }`;
  assert.equal(scanRouteSource(fee, delegates)[0].status, "protected");
  assert.equal(scanRouteSource(bt, delegates)[0].status, "protected");
  assert.equal(scanRouteSource(gen, delegates)[0].status, "protected");
  assert.equal(scanRouteSource(gen, {})[0].status, "unprotected");
});

test("export const POST 등 해석 못 하는 형태는 unknown(조용히 통과 금지)", () => {
  const src = `export const POST = withSomething(async () => 1);`;
  assert.deepEqual(scanRouteSource(src, delegates), [{ method: "POST", status: "unknown" }]);
});

test("route 경로 변환: 동적 세그먼트·그룹 유지", () => {
  assert.equal(routeFromPath("src/app/api/files/[id]/route.ts"), "/api/files/[id]");
  assert.equal(routeFromPath("src/app/api/auth/login/route.ts"), "/api/auth/login");
});

test("핸들러 첫 매개변수 이름이 _request 여도 그 이름으로 가드를 부르면 보호", () => {
  const src = `export async function DELETE(\n  _request: NextRequest,\n  { params }: { params: Promise<{ id: string }> },\n) {\n  const mutation = await withMutation(_request);\n}`;
  assert.equal(scanRouteSource(src, delegates)[0].status, "protected");
});

test("핸들러 매개변수가 아닌 다른 값을 넘기면 인정하지 않음", () => {
  const src = `export async function POST(request: NextRequest) {\n  const fake = new Request('x');\n  await withMutation(fake);\n}`;
  assert.equal(scanRouteSource(src, delegates)[0].status, "unprotected");
});
