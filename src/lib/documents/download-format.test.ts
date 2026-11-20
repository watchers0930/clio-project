import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDownloadFormat } from "./download-format";

test("형식을 지정하지 않으면 문서가 만들어진 형식을 쓴다 — 저장 PDF 문서도 최신 양식으로 다시 렌더된다", () => {
  assert.equal(resolveDownloadFormat(null, "pdf"), "pdf");
  assert.equal(resolveDownloadFormat(null, "hwpx"), "hwpx");
  assert.equal(resolveDownloadFormat(null, "docx"), "docx");
});

test("문서 형식을 모르거나 렌더 대상이 아니면 docx", () => {
  assert.equal(resolveDownloadFormat(null, null), "docx");
  assert.equal(resolveDownloadFormat(null, undefined), "docx");
  assert.equal(resolveDownloadFormat(null, "exe"), "docx");
  assert.equal(resolveDownloadFormat("", "pdf"), "pdf");
});

test("요청한 형식이 있으면 그대로, 허용 목록 밖이면 문서 형식으로", () => {
  assert.equal(resolveDownloadFormat("docx", "pdf"), "docx");
  assert.equal(resolveDownloadFormat("pdf", "docx"), "pdf");
  assert.equal(resolveDownloadFormat("xlsx", null), "xlsx");
  assert.equal(resolveDownloadFormat("../etc", "pdf"), "pdf");
  assert.equal(resolveDownloadFormat("PDF", null), "docx");
});
