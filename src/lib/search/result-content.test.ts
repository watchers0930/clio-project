import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadResultTexts } from "./result-content";
import { parseResultIds, MAX_RESULT_IDS } from "./result-ids";

const ME = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const DEPT = "00000000-0000-4000-8000-0000000000d1";
const DOC_MINE = "10000000-0000-4000-8000-000000000001";
const DOC_SHARED = "10000000-0000-4000-8000-000000000002";
const DOC_SAME_DEPT = "10000000-0000-4000-8000-000000000003"; // 같은 부서 동료 문서 — 공유 없으면 못 본다(앱 규칙)
const FILE_DEPT = "20000000-0000-4000-8000-000000000001";
const FILE_GMAIL_OTHER = "20000000-0000-4000-8000-000000000002";
const LOCAL_MINE = "30000000-0000-4000-8000-000000000001";
const LOCAL_OTHER = "30000000-0000-4000-8000-000000000002";

type Row = Record<string, unknown>;
const TABLES: Record<string, Row[]> = {
  documents: [
    { id: DOC_MINE, title: "내 문서", content: "<!--DOCUMENT_INPUTS:{\"a\":1}-->\n본문", created_by: ME },
    { id: DOC_SHARED, title: "공유 문서", content: "공유 본문", created_by: OTHER },
    { id: DOC_SAME_DEPT, title: "동료 문서", content: "동료 본문", created_by: OTHER },
  ],
  document_permissions: [{ document_id: DOC_SHARED, granted_to_user: ME, granted_to_dept: null }],
  files: [
    { id: FILE_DEPT, name: "부서 파일.pdf", uploaded_by: OTHER, department_id: DEPT, source: "upload" },
    { id: FILE_GMAIL_OTHER, name: "남의 메일", uploaded_by: OTHER, department_id: DEPT, source: "gmail" },
  ],
  file_permissions: [],
  file_chunks: [2, 0, 1, 5].map((i) => ({ file_id: FILE_DEPT, chunk_index: i, content: `청크${i}` }))
    .concat([{ file_id: FILE_GMAIL_OTHER, chunk_index: 0, content: "메일 본문" }]),
  local_file_index: [
    { id: LOCAL_MINE, file_name: "로컬.txt", user_id: ME },
    { id: LOCAL_OTHER, file_name: "남의 로컬.txt", user_id: OTHER },
  ],
  local_file_chunks: [{ local_file_id: LOCAL_MINE, chunk_index: 0, content: "로컬 본문" }],
};

/** failTable 조회만 오류를 내는 가짜 */
function fakeClientWith(failTable?: string): SupabaseClient {
  const base = fakeClient();
  return {
    from: (t: string) => t === failTable
      ? { select: () => ({ in: () => ({ lt: () => Promise.resolve({ data: null, error: { message: "timeout" } }) }) }) }
      : base.from(t),
  } as unknown as SupabaseClient;
}

/** select·in·eq·lt·or(`a.eq.x,b.eq.y`)만 흉내 내는 PostgREST 가짜 */
function fakeClient(): SupabaseClient {
  const query = (rows: Row[]) => {
    const q = {
      select: () => q,
      in: (col: string, vals: unknown[]) => query(rows.filter((r) => vals.includes(r[col]))),
      eq: (col: string, v: unknown) => query(rows.filter((r) => r[col] === v)),
      lt: (col: string, n: number) => query(rows.filter((r) => (r[col] as number) < n)),
      or: (expr: string) => {
        const conds = expr.split(",").map((c) => c.split(".eq."));
        return query(rows.filter((r) => conds.some(([col, v]) => r[col] === v)));
      },
      then: (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve({ data: rows, error: null }),
    };
    return q;
  };
  return { from: (t: string) => query(TABLES[t] ?? []) } as unknown as SupabaseClient;
}

const staff = { userId: ME, role: "user", departmentId: DEPT };

test("문서·파일·로컬이 섞여도 모두 읽고 넘긴 순서를 지킨다", async () => {
  const db = fakeClient();
  const r = await loadResultTexts(db, db, staff, [LOCAL_MINE, FILE_DEPT, DOC_MINE]);
  assert.deepEqual(r.map((x) => x.id), [LOCAL_MINE, FILE_DEPT, DOC_MINE]);
  assert.equal(r[2].text, "본문", "문서 내부 입력값 주석은 뺀다");
});

test("문서 권한은 앱 규칙 — 공유받은 문서는 읽고, 같은 부서라도 공유 없는 문서는 뺀다", async () => {
  const db = fakeClient();
  const r = await loadResultTexts(db, db, staff, [DOC_SHARED, DOC_SAME_DEPT]);
  assert.deepEqual(r.map((x) => x.id), [DOC_SHARED]);
});

test("남이 동기화한 Gmail 은 같은 부서여도 빼고, 남의 로컬 파일도 뺀다", async () => {
  const db = fakeClient();
  const r = await loadResultTexts(db, db, staff, [FILE_GMAIL_OTHER, LOCAL_OTHER]);
  assert.deepEqual(r, []);
});

test("관리자는 공유 없이도 문서를 읽는다", async () => {
  const db = fakeClient();
  const r = await loadResultTexts(db, db, { ...staff, role: "admin" }, [DOC_SAME_DEPT]);
  assert.equal(r[0]?.text, "동료 본문");
});

test("파일 청크는 앞에서부터 상한만큼, chunk_index 순서로 잇는다", async () => {
  const db = fakeClient();
  assert.equal((await loadResultTexts(db, db, staff, [FILE_DEPT]))[0].text, "청크0\n청크1\n청크2");
  assert.equal((await loadResultTexts(db, db, staff, [FILE_DEPT], 2))[0].text, "청크0\n청크1");
});

test("id 목록 검증 — UUID 만, 상한 초과·형식 위반은 null, 중복은 하나로", () => {
  assert.deepEqual(parseResultIds([DOC_MINE, DOC_MINE.toUpperCase()]), [DOC_MINE]);
  assert.equal(parseResultIds("x"), null);
  assert.equal(parseResultIds([`${DOC_MINE},id.neq.0`]), null);
  assert.equal(parseResultIds(Array.from({ length: MAX_RESULT_IDS + 1 }, () => DOC_MINE)), null);
  assert.deepEqual(parseResultIds([]), []);
});

test("청크 조회 오류는 던진다 — 빈 본문('미처리' 안내)으로 덮지 않는다", async () => {
  const db = fakeClientWith("file_chunks");
  await assert.rejects(loadResultTexts(db, db, staff, [FILE_DEPT]), /file_chunks: timeout/);
});
