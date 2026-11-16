// CSRF 가드 판정 (순수 함수) — scripts/check-csrf-guard.mjs 가 쓴다.
// 변이 핸들러(POST/PUT/PATCH/DELETE)마다 "그 핸들러 본문 안에서" 가드를 부르는지 본다.
// 주석은 지우고 본다(주석에 가드 이름을 적어 통과하는 우회 방지). 해석 못 하는 형태는 unknown.

const MUTATION = ["POST", "PUT", "PATCH", "DELETE"];

// 인정하는 가드 호출 — 핸들러의 첫 매개변수(요청 객체)를 그대로 넘겨야 한다
const GUARDS = [
  (req) => new RegExp(`\\bwithMutation\\s*\\(\\s*${req}\\b`), // lib/http/mutation-guard.ts — 출처·CSRF 토큰·활성 사용자
  (req) => new RegExp(`\\bfeeMutationGate\\s*\\(\\s*${req}\\b`), // lib/maintenance-fees/route-guard.ts
  (req) => new RegExp(`\\bbulkTransferMutationGate\\s*\\(\\s*${req}\\b`), // lib/bulk-transfer/route-guard.ts
  (req) => new RegExp(`\\bhandleAttendance\\s*\\(\\s*${req}\\s*,\\s*true\\b`), // lib/http/attendance-handler.ts — true 일 때만 withMutation
];

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");
}

/**
 * @param {string} source route.ts 내용
 * @param {Record<string, boolean>} delegates 내부에서 withMutation 을 부르는 것이 확인된 위임 함수 이름
 * @returns {{ method: string, status: 'protected'|'unprotected'|'unknown' }[]}
 */
export function scanRouteSource(source, delegates) {
  const src = stripComments(source);
  const results = [];
  const fnRe = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\s*\(\s*([A-Za-z_$][\w$]*)?/g;
  const starts = [];
  let m;
  while ((m = fnRe.exec(src))) starts.push({ method: m[1], index: m.index, req: m[2] ?? null });
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].index : src.length;
    // 다음 export 전까지를 그 핸들러 본문으로 본다
    const rest = src.slice(starts[i].index + 1, end);
    const nextExport = rest.search(/\nexport\s/);
    const body = nextExport === -1 ? rest : rest.slice(0, nextExport);
    // 정규식에 넣기 전에 매개변수 이름의 특수문자($)를 이스케이프
    const req = starts[i].req ? starts[i].req.replace(/\$/g, '\\$') : null;
    // 매개변수가 없으면 요청 객체를 넘길 수 없으므로 미보호
    const delegated = !!req && Object.keys(delegates).some((name) => delegates[name] && new RegExp(`\\b${name}\\s*\\(\\s*${req}\\b`).test(body));
    const guarded = !!req && (GUARDS.some((make) => make(req).test(body)) || delegated);
    results.push({ method: starts[i].method, status: guarded ? "protected" : "unprotected" });
  }
  // async function 선언이 아닌 변이 export(상수·재내보내기)는 판정 불가
  const seen = new Set(starts.map((s) => s.method));
  for (const method of MUTATION) {
    if (seen.has(method)) continue;
    const other = new RegExp(`export\\s+(const|let|var)\\s+${method}\\b|export\\s*\\{[^}]*\\b${method}\\b[^}]*\\}`);
    if (other.test(src)) results.push({ method, status: "unknown" });
  }
  return results;
}

/** src/app/api/files/[id]/route.ts → /api/files/[id] */
export function routeFromPath(file) {
  const norm = file.replace(/\\/g, "/");
  const i = norm.indexOf("src/app/api/");
  return "/" + norm.slice(i + "src/app/".length).replace(/\/route\.ts$/, "");
}
