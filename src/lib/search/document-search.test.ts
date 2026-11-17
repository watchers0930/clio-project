import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDocumentAccessFilter, combineTextAndAccess, vectorAccessArgs } from "./document-search";

const U = "0b6c1f0e-3a3b-4c4d-8e8f-9a9b0c0d1e1f";
const D1 = "1c7d2a1f-4b4c-4d5e-9f90-ab0c1d2e3f40";
const D2 = "2d8e3b2a-5c5d-4e6f-a0a1-bc1d2e3f4051";

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

test("텍스트·권한 조건은 한 논리식의 AND 로(관리자는 텍스트만)", () => {
  assert.equal(combineTextAndAccess("title.ilike.\"%a%\"", null), "title.ilike.\"%a%\"");
  assert.equal(
    combineTextAndAccess("title.ilike.\"%a%\",and(content.ilike.\"%a%\")", `created_by.eq.${U}`),
    `and(or(title.ilike.\"%a%\",and(content.ilike.\"%a%\")),or(created_by.eq.${U}))`,
  );
});
