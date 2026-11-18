import { test } from "node:test";
import assert from "node:assert/strict";
import { injectApprovalSignatures, buildApprovalFills, placeApprovalCells } from "./inject-signatures";

const box = (labels: string[]) =>
  `<table><tr>${labels.map((l) => `<td class="ap-label">${l}</td>`).join("")}</tr>` +
  `<tr>${labels.map(() => '<td class="ap-sign"></td>').join("")}</tr></table>`;
const cells = (html: string) => [...html.matchAll(/<td class="ap-sign">([\s\S]*?)<\/td>/g)].map((m) => m[1]);
const sig = (n: string) => `data:image/png;base64,${n}`;
const step = (order: number, rank: string, status = "approved") => ({ step_order: order, status, rank_title: rank, signatureDataUrl: status === "approved" ? sig(`S${order}`) : null });

test("휴가원 담당→대표 2단계 — 대표 서명은 '관리'가 아니라 '대표' 칸 (운영 박세영 휴가원)", () => {
  const out = cells(injectApprovalSignatures(box(["담당", "관리", "대표"]), buildApprovalFills([step(1, "담당"), step(2, "대표")])));
  assert.match(out[0], /S1/);
  assert.equal(out[1], "");
  assert.match(out[2], /S2/);
});

test("직급명이 칸 이름에 없으면(이사→부대표) 마지막 결재자를 맨 오른쪽 칸에", () => {
  const out = cells(injectApprovalSignatures(box(["담당", "팀장", "대표"]), buildApprovalFills([step(1, "담당"), step(2, "부대표")])));
  assert.deepEqual([!!out[0], out[1], /S2/.test(out[2])], [true, "", true]);
});

test("칸 이름이 맞으면 그 칸 — 사원→팀장(최종) 주간업무는 팀장 칸", () => {
  assert.deepEqual(placeApprovalCells(3, ["담당", "팀장", "대표"], buildApprovalFills([step(1, "담당"), step(2, "팀장")])), [0, 1]);
});

test("3단계 결재선은 예전처럼 순서대로, 대기 중 단계는 빈칸", () => {
  const out = cells(injectApprovalSignatures(box(["기안", "검토", "승인"]), buildApprovalFills([step(1, "담당"), step(2, "팀장"), step(3, "대표", "waiting")])));
  assert.match(out[0], /S1/);
  assert.match(out[1], /S2/);
  assert.equal(out[2], "");
});

test("2단계 대기 중이면 대표 칸은 빈칸, 관리 칸은 원본 그대로", () => {
  const html = box(["담당", "관리", "대표"]).replace('<td class="ap-sign"></td>', '<td class="ap-sign"><img src="x" /></td>');
  const out = cells(injectApprovalSignatures(html, buildApprovalFills([step(1, "담당", "approved"), step(2, "대표", "waiting")])));
  assert.match(out[0], /S1/);
  assert.deepEqual([out[1], out[2]], ["", ""]);
});

test("칸보다 결재선이 길면 앞에서부터 칸 수만큼", () => {
  assert.deepEqual(placeApprovalCells(3, [], buildApprovalFills([step(1, "담당"), step(2, "팀장"), step(3, "이사"), step(4, "대표")])), [0, 1, 2, 3]);
  const out = cells(injectApprovalSignatures(box(["담당", "관리", "대표"]), buildApprovalFills([step(1, "담당"), step(2, "팀장"), step(3, "이사"), step(4, "대표")])));
  assert.equal(out.length, 3);
  assert.match(out[2], /S3/);
});
