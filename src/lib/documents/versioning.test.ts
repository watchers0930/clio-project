import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSnapshotInsertPayload } from "./versioning";

const base = {
  id: "d1", title: "표준근로계약서", content: "본문", status: "completed", parent_id: null,
  version_number: 1, created_by: "u1", storage_path: "generated/u1/a.pdf",
};

test("버전 스냅샷은 출력 형식을 함께 복사한다(형식 미지정 다운로드가 같은 형식으로 렌더되도록)", () => {
  assert.equal(buildSnapshotInsertPayload({ ...base, output_format: "pdf" }).output_format, "pdf");
  assert.equal(buildSnapshotInsertPayload({ ...base, output_format: null }).output_format, null);
});

test("조회에 출력 형식이 없으면 칸을 넣지 않는다(DB 기본값 유지)", () => {
  assert.equal("output_format" in buildSnapshotInsertPayload(base), false);
});
