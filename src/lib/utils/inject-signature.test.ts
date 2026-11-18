import { test } from "node:test";
import assert from "node:assert/strict";
import PizZip from "pizzip";
import { appendSignatureHtml, injectSignatureDocx } from "./inject-signature";
import { signatureBufferToDataUrl } from "./signature-data-url";
import { renderDocx } from "@/lib/renderers/docx-renderer";
import { renderPdf } from "@/lib/renderers/pdf-renderer";
import { renderLatestInputForm } from "@/lib/documents/inline-render";
import { resolveBuiltinTemplateBundleByName } from "@/lib/templates/builtin";
import { DEFAULT_THEME } from "@/lib/renderers/types";
import { injectApprovalSignatures } from "@/lib/approval/inject-signatures";

// 1×1 PNG — 서명 이미지 대용
const SIG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const LEAVE_INPUTS = {
  __template_name: "휴가원", employee_name: "박세영", department: "개발팀", leave_type: "monthly",
  leave_start_date: "2026-11-19", leave_end_date: "2026-11-19", leave_reason: "휴식", company_name: "시험회사",
};
const leave = resolveBuiltinTemplateBundleByName("휴가원")!;
const countSig = (html: string) => html.split(SIG.toString("base64")).length - 1;

test("휴가원 HTML — 양식이 결재란에 넣은 서명이 있으면 끝에 다시 붙이지 않는다", async () => {
  const rendered = await renderPdf("# 휴가원", "휴가원", DEFAULT_THEME, {
    templateBundle: leave.bundle, templateName: leave.name,
    documentInputs: { ...LEAVE_INPUTS, signature_image_src: signatureBufferToDataUrl(SIG) },
  });
  const html = rendered.buffer.toString("utf-8");
  assert.equal(countSig(html), 1, "양식이 담당 칸에 서명을 넣는다");
  assert.equal(countSig(appendSignatureHtml(html, SIG)), 1);
});

test("결재 기록에 서명이 없어 결재란이 비면(서명 등록 전 상신) 끝에 작성자 서명을 붙인다 — 0개가 되지 않게", async () => {
  const rendered = await renderPdf("# 휴가원", "휴가원", DEFAULT_THEME, {
    templateBundle: leave.bundle, templateName: leave.name,
    documentInputs: { ...LEAVE_INPUTS, signature_image_src: signatureBufferToDataUrl(SIG) },
  });
  // 1단계 승인이지만 서명 경로가 없던 결재 → 결재란 칸이 빈칸으로 바뀐다(다운로드 경로의 실제 순서: 결재란 주입 → 작성자 서명)
  const afterApproval = injectApprovalSignatures(rendered.buffer.toString("utf-8"), [{ signatureDataUrl: null }, { signatureDataUrl: null }]);
  assert.equal(countSig(afterApproval), 0);
  assert.equal(countSig(appendSignatureHtml(afterApproval, SIG)), 1);
});

test("양식 없는 일반 문서 HTML — 작성자 서명을 끝에 붙인다", () => {
  const out = appendSignatureHtml("<html><body><p>본문</p></body></html>", SIG);
  assert.equal(countSig(out), 1);
  assert.match(out, /alt="서명" \/><\/div><\/body>/);
});

test("휴가원 DOCX — 신청인 칸에 넣은 서명이 있으면 문서 끝에 다시 붙이지 않는다", async () => {
  const rendered = await renderDocx("# 휴가원", "휴가원", DEFAULT_THEME, {
    templateBundle: leave.bundle,
    documentInputs: { ...LEAVE_INPUTS, signature_image_src: signatureBufferToDataUrl(SIG) },
  });
  const out = injectSignatureDocx(rendered.buffer, SIG);
  assert.ok(out.equals(rendered.buffer), "원본 그대로");
});

test("서명 칸 없는 DOCX — 서명을 넣는다", async () => {
  const rendered = await renderDocx("# 메모\n\n본문", "메모", DEFAULT_THEME);
  const out = injectSignatureDocx(rendered.buffer, SIG);
  const zip = new PizZip(out);
  assert.ok(zip.file("word/media/signature.png"), "서명 이미지 추가");
});

test("입력값이 칸(input_values)에만 있는 휴가원도 양식 미리보기로 그린다 — 060 이후 본문에 주석 없음", async () => {
  const out = await renderLatestInputForm({
    document: { title: "휴가원 (2026-11-17 생성)", content: "# 휴가원\n\n본문", template_id: null, input_values: LEAVE_INPUTS },
    theme: DEFAULT_THEME, companyLogoSrc: "", companyLogoPatternSize: "",
    authorSignatureSrc: signatureBufferToDataUrl(SIG),
  });
  assert.ok(out, "null 이면 서명을 덧붙이는 옛 경로로 떨어진다");
  const html = out.buffer.toString("utf-8");
  assert.match(html, /leave-app/);
  assert.equal(countSig(html), 1);
});
