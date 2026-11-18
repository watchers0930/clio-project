import { test } from "node:test";
import assert from "node:assert/strict";
import { isCompanyIssuedTemplateName, pickSignatureSlotImage } from "./company-seal";
import { renderLatestInputForm } from "@/lib/documents/inline-render";
import { DEFAULT_THEME } from "@/lib/renderers/types";

const SEAL = "data:image/png;base64,U0VBTA==";
const AUTHOR = "data:image/png;base64,QVVUSE9S";

test("회사 발급 문서는 직인만 — 직인이 없어도 작성자 서명으로 대신하지 않는다", () => {
  assert.equal(isCompanyIssuedTemplateName("표준근로계약서"), true);
  assert.equal(isCompanyIssuedTemplateName("재직증명서"), true);
  assert.equal(isCompanyIssuedTemplateName("휴가원"), false);
  assert.equal(pickSignatureSlotImage(true, SEAL, AUTHOR), SEAL);
  assert.equal(pickSignatureSlotImage(true, null, AUTHOR), null);
  assert.equal(pickSignatureSlotImage(false, SEAL, AUTHOR), AUTHOR);
});

test("재직증명서 최신 입력값 미리보기 — 직인 자리에 회사 직인(예전엔 빈칸)", async () => {
  const out = await renderLatestInputForm({
    document: { title: "재직증명서 (2026-11-18 생성)", content: "# 재직증명서", template_id: null,
      input_values: { __template_name: "재직증명서", employee_name: "박세영" } },
    theme: DEFAULT_THEME, companyLogoSrc: "", companyLogoPatternSize: "",
    authorSignatureSrc: AUTHOR, companySealSrc: SEAL,
  });
  assert.ok(out);
  const html = out.buffer.toString("utf-8");
  assert.ok(html.includes(SEAL), "직인 표시");
  assert.ok(!html.includes(AUTHOR), "작성자 서명은 직인 자리에 넣지 않는다");
});
