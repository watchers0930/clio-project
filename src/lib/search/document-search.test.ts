import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDocumentAccessFilter, collapseVersionChains, vectorAccessArgs } from "./document-search";

const U = "0b6c1f0e-3a3b-4c4d-8e8f-9a9b0c0d1e1f";
const D1 = "1c7d2a1f-4b4c-4d5e-9f90-ab0c1d2e3f40";
const D2 = "2d8e3b2a-5c5d-4e6f-a0a1-bc1d2e3f4051";
const ROOT = "3e9f4c3b-6d6e-4f70-b1b2-cd2e3f405162";

test("관리자는 권한 조건 없음, 직원은 본인 작성 + 공유받은 문서", () => {
  assert.equal(buildDocumentAccessFilter({ id: U, role: "admin" }, []), null);
  assert.equal(buildDocumentAccessFilter({ id: U, role: "member" }, []), `created_by.eq.${U}`);
  assert.equal(buildDocumentAccessFilter({ id: U, role: "member" }, [D1, D2]), `created_by.eq.${U},id.in.(${D1},${D2})`);
});

test("UUID 가 아닌 값은 조건에 넣지 않는다(조건 문법 주입 차단)", () => {
  assert.equal(buildDocumentAccessFilter({ id: U, role: "member" }, [D1, "x),id.neq.(0"]), `created_by.eq.${U},id.in.(${D1})`);
  assert.throws(() => buildDocumentAccessFilter({ id: "bad", role: "member" }, []));
});

test("벡터 검색 인자: 관리자는 조건 없음, 직원은 작성자 + 공유 id(빈 배열이어도 조건은 건다)", () => {
  assert.deepEqual(vectorAccessArgs({ id: U, role: "admin" }, [D1]), {});
  assert.deepEqual(vectorAccessArgs({ id: U, role: "member" }, []), { filter_owner: U, filter_document_ids: [] });
});

test("버전 묶음은 가장 높은 판 하나만(같으면 최신 생성)", () => {
  const rows = [
    { id: ROOT, parent_id: null, version_number: 1, created_at: "2026-11-01T00:00:00Z" },
    { id: D1, parent_id: ROOT, version_number: 3, created_at: "2026-11-03T00:00:00Z" },
    { id: D2, parent_id: ROOT, version_number: 2, created_at: "2026-11-02T00:00:00Z" },
    { id: U, parent_id: null, version_number: 1, created_at: "2026-11-04T00:00:00Z" },
  ];
  const out = collapseVersionChains(rows);
  assert.deepEqual(out.map((r) => r.id).sort(), [D1, U].sort());
  assert.equal(out.find((r) => r.id === D1)?.chainId, ROOT);
});
