import { test } from "node:test";
import assert from "node:assert/strict";
import { documentDownloadSpec, extensionFromResponse } from "./download-document";

test("문서 내려받기 형식: 제안서는 pdf 요청·html 저장, 그 밖(양식명·'AI문서'·없음)은 docx", () => {
  assert.deepEqual(documentDownloadSpec("제안서"), { format: "pdf", extension: "html" });
  assert.deepEqual(documentDownloadSpec("휴가원"), { format: "docx", extension: "docx" });
  assert.deepEqual(documentDownloadSpec("AI문서"), { format: "docx", extension: "docx" });
  assert.deepEqual(documentDownloadSpec(null), { format: "docx", extension: "docx" });
  assert.deepEqual(documentDownloadSpec(undefined), { format: "docx", extension: "docx" });
});

test("확장자는 받은 응답 기준: 파일명 → MIME → 요청 형식", () => {
  const name = encodeURIComponent("휴가원 (2026-10-23 생성).pdf");
  assert.equal(extensionFromResponse(`attachment; filename*=UTF-8''${name}`, "application/pdf", "docx"), "pdf");
  assert.equal(extensionFromResponse(`attachment; filename*=UTF-8''${encodeURIComponent("계약서.hwpx")}`, "application/haansofthwpx", "docx"), "hwpx");
  assert.equal(extensionFromResponse(null, "application/pdf", "docx"), "pdf");
  assert.equal(extensionFromResponse(null, "text/html; charset=utf-8", "docx"), "html");
  assert.equal(extensionFromResponse(null, "application/hwp+zip", "docx"), "hwpx");
  assert.equal(extensionFromResponse(null, "application/octet-stream", "docx"), "docx");
  assert.equal(extensionFromResponse(null, null, "html"), "html");
  // 확장자 없는 파일명·깨진 인코딩은 MIME 으로
  assert.equal(extensionFromResponse(`attachment; filename*=UTF-8''${encodeURIComponent("제목만")}`, "application/pdf", "docx"), "pdf");
  assert.equal(extensionFromResponse("attachment; filename*=UTF-8''%E0%A4%A", "application/pdf", "docx"), "pdf");
});
