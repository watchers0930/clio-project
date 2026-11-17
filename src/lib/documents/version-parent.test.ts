import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveVersionParentWith, type VersionParentDeps } from "./version-parent";

const ROOT = "0b6c1f0e-3a3b-4c4d-8e8f-9a9b0c0d1e1f";
const V2 = "1c7d2a1f-4b4c-4d5e-9f90-ab0c1d2e3f40";
const OTHER = "2d8e3b2a-5c5d-4e6f-a0a1-bc1d2e3f4051";

function deps(over: Partial<VersionParentDeps> = {}): VersionParentDeps & { accessChecked: string[] } {
  const accessChecked: string[] = [];
  const docs: Record<string, { id: string; parent_id: string | null }> = {
    [ROOT]: { id: ROOT, parent_id: null },
    [V2]: { id: V2, parent_id: ROOT },
  };
  return {
    accessChecked,
    loadDocument: async (id) => docs[id] ?? null,
    loadMaxVersion: async (rootId) => (rootId === ROOT ? 2 : null),
    canAccessRoot: async (rootId) => { accessChecked.push(rootId); return true; },
    ...over,
  };
}

test("부모가 없으면 버전 칸 없이 통과", async () => {
  for (const v of [undefined, null, ""]) {
    assert.deepEqual(await resolveVersionParentWith(deps(), v), { ok: true, fields: {} });
  }
});

test("UUID 가 아니면 400 — 필터 문자열 주입 차단", async () => {
  for (const v of [`${ROOT},created_by.eq.x`, "abc", 123, { id: ROOT }]) {
    const r = await resolveVersionParentWith(deps(), v);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 400);
  }
});

test("없는 문서면 404", async () => {
  const r = await resolveVersionParentWith(deps(), OTHER);
  assert.deepEqual(r.ok ? null : r.status, 404);
});

test("원본에 접근 권한이 없으면 404 — 존재 여부도 알리지 않는다", async () => {
  const d = deps({ canAccessRoot: async () => false });
  const r = await resolveVersionParentWith(d, ROOT);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 404);
});

test("버전 행을 부모로 주면 원본(root) 기준으로 권한을 보고 다음 번호를 매긴다", async () => {
  const d = deps();
  const r = await resolveVersionParentWith(d, V2);
  assert.deepEqual(r, { ok: true, fields: { parent_id: ROOT, version_number: 3 } });
  assert.deepEqual(d.accessChecked, [ROOT]);
});

test("원본만 있으면 2판", async () => {
  const r = await resolveVersionParentWith(deps({ loadMaxVersion: async () => null }), ROOT);
  assert.deepEqual(r, { ok: true, fields: { parent_id: ROOT, version_number: 2 } });
});

test("부모의 원본이 다시 버전 행이면(깨진 체인) 404 — DB 트리거와 같은 판정", async () => {
  const V3 = "3e9f4c3b-6d6e-4f70-b1b2-cd2e3f405162";
  const base = deps();
  const d = deps({
    loadDocument: async (id) => (id === V3 ? { id: V3, parent_id: V2 } : base.loadDocument(id)),
  });
  const r = await resolveVersionParentWith(d, V3);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 404);
});
