import { test } from "node:test";
import assert from "node:assert/strict";
import { documentDownloadSpec } from "./download-document";

test("문서 내려받기 형식: 제안서는 pdf 요청·html 저장, 그 밖(양식명·'AI문서'·없음)은 docx", () => {
  assert.deepEqual(documentDownloadSpec("제안서"), { format: "pdf", extension: "html" });
  assert.deepEqual(documentDownloadSpec("휴가원"), { format: "docx", extension: "docx" });
  assert.deepEqual(documentDownloadSpec("AI문서"), { format: "docx", extension: "docx" });
  assert.deepEqual(documentDownloadSpec(null), { format: "docx", extension: "docx" });
  assert.deepEqual(documentDownloadSpec(undefined), { format: "docx", extension: "docx" });
});
