// CSRF 가드 판정 (TypeScript 구문 트리 기반) — scripts/check-csrf-guard.mjs 가 쓴다.
//
// 정규식으로는 문자열·주석·중첩 함수·핸들러 범위를 구분할 수 없어 우회가 가능했다(2026-11-16 적대 검토 실측:
// 결과 무시, 아래 helper 의 가드, 'image/*' 문자열, 죽은 코드가 모두 '보호'로 판정, async 없는 핸들러 누락).
// 그래서 핸들러 본문의 최상위 문장 구조로 판정한다. 아래 형태가 아니면 미보호다.
//
//  A) const X = await 가드(요청)  바로 다음  if (X.error) return …     (가드는 정해진 모듈에서 import)
//  B) return [await] 위임(요청[, true …])                              (위임 함수가 내부에서 가드를 거침이 확인된 경우)
//  - 가드 앞에는 'await params' 외의 await 가 없어야 한다(가드 전에 쓰기가 일어나지 않게).
//  - 해석할 수 없는 export(재내보내기·export *) 는 unknown.
import ts from "typescript";
import path from "node:path";

const MUTATION = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// 가드: 결과 객체의 .error 를 확인해야 하는 함수 → 그 함수가 있어야 하는 모듈
export const GUARD_MODULES = {
  withMutation: "@/lib/http/mutation-guard",
  withMutationOrInternal: "@/lib/http/mutation-guard", // 내부 비밀값이 맞으면 통과, 아니면 withMutation
  withSameOrigin: "@/lib/http/mutation-guard", // 출처만 확인 — 로그아웃 전용(토큰 만료여도 동작해야 함)
  feeMutationGate: "@/lib/maintenance-fees/route-guard",
  bulkTransferMutationGate: "@/lib/bulk-transfer/route-guard",
};
// 출처만 보는 가드는 토큰 확인이 없으므로 여기 적힌 라우트에서만 인정(다른 라우트에서 토큰 확인을 빼는 우회로 차단)
export const SAME_ORIGIN_ONLY_ROUTES = new Set(["/api/auth/logout"]);
// 위임: 결과를 그대로 반환하면 되는 함수(내부에서 가드를 거침) → 모듈
export const DELEGATE_MODULES = {
  handleAttendance: "@/lib/http/attendance-handler", // 두 번째 인자가 true 일 때만 withMutation
  generateDocument: "@/lib/generation/generate-document",
};

/** 상대 경로 import 를 '@/...' 형태로 풀어 비교 기준을 하나로 맞춘다 (src/lib/http/x.ts 의 './y' → '@/lib/http/y') */
function canonicalModule(spec, filePath) {
  if (!spec.startsWith(".") || !filePath) return spec;
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(filePath.replace(/\\/g, "/")), spec));
  const noExt = resolved.replace(/\.(ts|tsx|js|mjs)$/, "").replace(/\/index$/, "");
  const i = noExt.indexOf("src/");
  return i === -1 ? noExt : "@/" + noExt.slice(i + "src/".length);
}

function importsOf(sf, filePath) {
  const map = new Map(); // 지역 이름 → 모듈
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue;
    const mod = canonicalModule(st.moduleSpecifier.text, filePath);
    const named = st.importClause.namedBindings;
    if (named && ts.isNamedImports(named)) {
      for (const el of named.elements) {
        const imported = (el.propertyName ?? el.name).text;
        map.set(el.name.text, { mod, imported });
      }
    }
  }
  return map;
}

const unwrapAwait = (e) => (e && ts.isAwaitExpression(e) ? e.expression : e);
const unwrapParens = (e) => {
  while (e && ts.isParenthesizedExpression(e)) e = e.expression;
  return e;
};

/** callee 가 지정한 모듈에서 import 된 함수 이름인지 (같은 이름의 다른 모듈은 불인정) */
function calleeName(call, imports, table) {
  if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) return null;
  const local = call.expression.text;
  const imp = imports.get(local);
  if (!imp) return null;
  const expected = table[imp.imported];
  return expected && expected === imp.mod ? imp.imported : null;
}

const isReqArg = (call, req) => call.arguments.length > 0 && ts.isIdentifier(call.arguments[0]) && call.arguments[0].text === req;

/** 가드 이전 문장이 허용되는가: 'await params' 외 await 금지(중첩 함수 안은 실행되지 않으므로 제외) */
function preGuardOk(stmt, paramsNames) {
  let ok = true;
  const visit = (n) => {
    if (!ok) return;
    if (ts.isFunctionLike(n) && n !== stmt) return; // 중첩 함수 본문은 이 시점에 실행되지 않음
    if (ts.isAwaitExpression(n)) {
      const target = unwrapParens(n.expression);
      const awaitsParams =
        (ts.isIdentifier(target) && paramsNames.has(target.text)) ||
        (ts.isPropertyAccessExpression(target) && target.name.text === "params");
      if (!awaitsParams) ok = false;
    }
    ts.forEachChild(n, visit);
  };
  visit(stmt);
  return ok;
}

function returnsFirst(st) {
  if (ts.isReturnStatement(st)) return true;
  if (ts.isBlock(st)) return st.statements.length > 0 && ts.isReturnStatement(st.statements[0]);
  return false;
}

/** 핸들러 함수 하나 판정 */
function analyzeFunction(fn, imports, delegates, route) {
  const p0 = fn.parameters[0];
  if (!p0 || !ts.isIdentifier(p0.name)) return "unprotected"; // 요청 객체를 이름으로 받지 않으면 넘길 수 없음
  const req = p0.name.text;
  // 두 번째 매개변수에서 params 이름 수집 ({ params } 구조분해 / context)
  const paramsNames = new Set(["params"]);
  const p1 = fn.parameters[1];
  if (p1 && ts.isIdentifier(p1.name)) paramsNames.add(p1.name.text);

  if (!fn.body) return "unprotected";
  const statements = ts.isBlock(fn.body) ? [...fn.body.statements] : [ts.factory.createReturnStatement(fn.body)];

  for (let i = 0; i < statements.length; i++) {
    const st = statements[i];

    // B) return [await] 위임(req, ...)
    if (ts.isReturnStatement(st) && st.expression) {
      const call = unwrapParens(unwrapAwait(unwrapParens(st.expression)));
      const name = call && ts.isCallExpression(call) ? calleeName(call, imports, DELEGATE_MODULES) : null;
      if (name && delegates[name] && isReqArg(call, req)) {
        if (name === "handleAttendance") {
          const second = call.arguments[1];
          return second && second.kind === ts.SyntaxKind.TrueKeyword ? "protected" : "unprotected";
        }
        return "protected";
      }
    }

    // A) const X = await 가드(req); if (X.error) return …
    if (ts.isVariableStatement(st) && st.declarationList.declarations.length === 1) {
      const d = st.declarationList.declarations[0];
      const init = d.initializer && unwrapParens(d.initializer);
      if (ts.isIdentifier(d.name) && init && ts.isAwaitExpression(init)) {
        const call = unwrapParens(init.expression);
        const name = calleeName(call, imports, GUARD_MODULES);
        if (name && isReqArg(call, req)) {
          if (name === "withSameOrigin" && !SAME_ORIGIN_ONLY_ROUTES.has(route)) return "unprotected";
          const next = statements[i + 1];
          const cond = next && ts.isIfStatement(next) ? unwrapParens(next.expression) : null;
          const checksError =
            cond &&
            ts.isPropertyAccessExpression(cond) &&
            cond.name.text === "error" &&
            ts.isIdentifier(cond.expression) &&
            cond.expression.text === d.name.text &&
            returnsFirst(next.thenStatement);
          return checksError ? "protected" : "unprotected";
        }
      }
    }

    // 가드를 만나기 전의 문장: 쓰기(await)가 있거나 먼저 return 하는 경로가 '가드 없이 끝나는' 구조면 계속 탐색하되 await 검사
    if (!preGuardOk(st, paramsNames)) return "unprotected";
  }
  return "unprotected";
}

/**
 * @param {string} source route 파일 내용
 * @param {Record<string, boolean>} delegates 내부 가드가 확인된 위임 함수
 * @returns {{ method: string, status: 'protected'|'unprotected'|'unknown' }[]}
 */
export function scanRouteSource(source, delegates, filePath) {
  const sf = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = importsOf(sf, filePath);
  const route = filePath ? routeFromPath(filePath) : null;
  const results = [];
  const isExported = (n) => ts.canHaveModifiers(n) && (ts.getModifiers(n) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name && MUTATION.has(st.name.text) && isExported(st)) {
      results.push({ method: st.name.text, status: analyzeFunction(st, imports, delegates, route) });
    } else if (ts.isVariableStatement(st) && isExported(st)) {
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !MUTATION.has(d.name.text)) continue;
        const init = d.initializer && unwrapParens(d.initializer);
        const fnLike = init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init));
        results.push({ method: d.name.text, status: fnLike ? analyzeFunction(init, imports, delegates, route) : "unknown" });
      }
    } else if (ts.isExportDeclaration(st)) {
      if (!st.exportClause) {
        results.push({ method: "*", status: "unknown" }); // export * — 어떤 메서드가 나가는지 알 수 없음
      } else if (ts.isNamedExports(st.exportClause)) {
        for (const el of st.exportClause.elements) {
          if (MUTATION.has(el.name.text)) results.push({ method: el.name.text, status: "unknown" });
        }
      }
    }
  }
  return results;
}

/** src/app/api/files/[id]/route.ts → /api/files/[id] */
export function routeFromPath(file) {
  const norm = file.replace(/\\/g, "/");
  const i = norm.indexOf("src/app/");
  return "/" + norm.slice(i + "src/app/".length).replace(/\/route\.(ts|tsx|js|mjs)$/, "");
}

/** 위임 함수 파일이 실제로 가드를 거치는지 확인 (모듈 파일 내용 → 이름별 true/false) */
export function verifyDelegate(name, source, filePath) {
  const sf = ts.createSourceFile("d.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports = importsOf(sf, filePath);
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name?.text === name) {
      if (name === "handleAttendance") {
        // mutation 인자가 참이면 withMutation(request) 를 부르는지(조건식 안) 확인
        let found = false;
        const visit = (n) => {
          if (ts.isCallExpression(n) && calleeName(n, imports, GUARD_MODULES) === "withMutation") found = true;
          ts.forEachChild(n, visit);
        };
        visit(st);
        return found;
      }
      return analyzeFunction(st, imports, {}) === "protected";
    }
  }
  return false;
}
