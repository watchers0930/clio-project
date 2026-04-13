/**
 * Myers diff 알고리즘 — 순수 TypeScript 구현
 * 두 텍스트 사이의 최소 편집 거리(LCS 기반)를 계산하여 DiffResult를 반환한다.
 */

// ── 공개 타입 ──────────────────────────────────────────────────────────────

export type DiffType = 'added' | 'removed' | 'unchanged' | 'modified';

export interface WordDiff {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

export interface DiffLine {
  type: DiffType;
  oldLine?: number;   // 구 버전 줄 번호 (1-based), removed/unchanged/modified
  newLine?: number;   // 신 버전 줄 번호 (1-based), added/unchanged/modified
  content: string;    // 주요 표시 내용 (unchanged/added/removed/modified 신 버전)
  oldContent?: string; // modified 타입에서 구 버전 내용
  wordDiff?: WordDiff[]; // modified 타입 내 단어 단위 차이
}

export interface DiffStats {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
}

export interface DiffResult {
  lines: DiffLine[];
  stats: DiffStats;
}

// ── 내부 타입 ──────────────────────────────────────────────────────────────

type EditOp =
  | { op: 'keep'; oldIdx: number; newIdx: number }
  | { op: 'delete'; oldIdx: number }
  | { op: 'insert'; newIdx: number };

// ── Myers 알고리즘 핵심 ────────────────────────────────────────────────────

/**
 * Myers diff 알고리즘: 두 줄 배열의 최소 편집 스크립트를 반환한다.
 */
function myersEditScript(oldLines: string[], newLines: string[]): EditOp[] {
  const N = oldLines.length;
  const M = newLines.length;

  if (N === 0 && M === 0) return [];
  if (N === 0) return newLines.map((_, i) => ({ op: 'insert' as const, newIdx: i }));
  if (M === 0) return oldLines.map((_, i) => ({ op: 'delete' as const, oldIdx: i }));

  const MAX = N + M;
  // V[k] = 대각선 k에서의 최대 x 좌표
  const V: number[] = new Array(2 * MAX + 1).fill(0);
  // trace[d] = 각 d 단계의 V 스냅샷
  const trace: number[][] = [];

  outer: for (let d = 0; d <= MAX; d++) {
    trace.push([...V]);
    for (let k = -d; k <= d; k += 2) {
      const idx = k + MAX;
      let x: number;

      if (k === -d || (k !== d && V[idx - 1] < V[idx + 1])) {
        x = V[idx + 1]; // 위에서 내려옴 (insert)
      } else {
        x = V[idx - 1] + 1; // 왼쪽에서 옴 (delete)
      }

      let y = x - k;

      // 대각선 이동 (공통 줄 skip)
      while (x < N && y < M && oldLines[x] === newLines[y]) {
        x++;
        y++;
      }

      V[idx] = x;

      if (x >= N && y >= M) {
        // 역추적으로 실제 편집 스크립트 복원
        return backtrack(trace, oldLines, newLines, MAX, d);
      }
    }
  }

  // fallback (도달 불가)
  const fallback: EditOp[] = [
    ...oldLines.map((_, i): EditOp => ({ op: 'delete', oldIdx: i })),
    ...newLines.map((_, i): EditOp => ({ op: 'insert', newIdx: i })),
  ];
  return fallback;
}

/**
 * trace를 역방향으로 읽어 EditOp 배열을 복원한다.
 */
function backtrack(
  trace: number[][],
  oldLines: string[],
  newLines: string[],
  MAX: number,
  finalD: number,
): EditOp[] {
  const ops: EditOp[] = [];
  let x = oldLines.length;
  let y = newLines.length;

  for (let d = finalD; d > 0; d--) {
    const V = trace[d];
    const k = x - y;
    const idx = k + MAX;

    const prevK =
      k === -d || (k !== d && V[idx - 1] < V[idx + 1]) ? k + 1 : k - 1;
    const prevX = trace[d - 1][prevK + MAX];
    const prevY = prevX - prevK;

    // 대각선 (keep) 단계
    while (x > prevX + 1 && y > prevY + 1) {
      x--;
      y--;
      ops.unshift({ op: 'keep', oldIdx: x, newIdx: y });
    }

    if (d > 0) {
      if (prevK === k - 1) {
        // delete
        ops.unshift({ op: 'delete', oldIdx: prevX });
        x = prevX;
        y = prevY;
      } else {
        // insert
        ops.unshift({ op: 'insert', newIdx: prevY });
        x = prevX;
        y = prevY;
      }
    }

    // 남은 대각선
    while (x > prevX && y > prevY) {
      x--;
      y--;
      ops.unshift({ op: 'keep', oldIdx: x, newIdx: y });
    }
  }

  // d=0 구간의 keep
  while (x > 0 && y > 0) {
    x--;
    y--;
    ops.unshift({ op: 'keep', oldIdx: x, newIdx: y });
  }

  return ops;
}

// ── 단어 단위 diff ─────────────────────────────────────────────────────────

/**
 * 두 문자열의 단어 단위 diff를 계산한다.
 */
function computeWordDiff(oldContent: string, newContent: string): WordDiff[] {
  const oldWords = oldContent.split(/(\s+)/);
  const newWords = newContent.split(/(\s+)/);

  const ops = myersEditScript(oldWords, newWords);
  const result: WordDiff[] = [];

  for (const op of ops) {
    if (op.op === 'keep') {
      result.push({ type: 'unchanged', text: oldWords[op.oldIdx] });
    } else if (op.op === 'delete') {
      result.push({ type: 'removed', text: oldWords[op.oldIdx] });
    } else {
      result.push({ type: 'added', text: newWords[op.newIdx] });
    }
  }

  return result;
}

// ── DiffLine 빌더 ─────────────────────────────────────────────────────────

/**
 * EditOp 배열을 DiffLine 배열로 변환한다.
 * 인접한 delete+insert 쌍은 modified로 병합한다.
 */
function buildDiffLines(
  ops: EditOp[],
  oldLines: string[],
  newLines: string[],
): DiffLine[] {
  // 1단계: 원시 줄 목록 생성 (keep/delete/insert)
  type RawLine =
    | { type: 'unchanged'; oldIdx: number; newIdx: number }
    | { type: 'removed'; oldIdx: number }
    | { type: 'added'; newIdx: number };

  const raw: RawLine[] = ops.map((op) => {
    if (op.op === 'keep') return { type: 'unchanged' as const, oldIdx: op.oldIdx, newIdx: op.newIdx };
    if (op.op === 'delete') return { type: 'removed' as const, oldIdx: op.oldIdx };
    return { type: 'added' as const, newIdx: op.newIdx };
  });

  // 2단계: 인접 removed+added 쌍을 modified로 병합
  const merged: DiffLine[] = [];
  let i = 0;
  while (i < raw.length) {
    const cur = raw[i];
    if (cur.type === 'removed' && i + 1 < raw.length && raw[i + 1].type === 'added') {
      const next = raw[i + 1] as { type: 'added'; newIdx: number };
      const oldContent = oldLines[cur.oldIdx];
      const newContent = newLines[next.newIdx];
      merged.push({
        type: 'modified',
        oldLine: cur.oldIdx + 1,
        newLine: next.newIdx + 1,
        content: newContent,
        oldContent,
        wordDiff: computeWordDiff(oldContent, newContent),
      });
      i += 2;
    } else if (cur.type === 'unchanged') {
      merged.push({
        type: 'unchanged',
        oldLine: cur.oldIdx + 1,
        newLine: cur.newIdx + 1,
        content: oldLines[cur.oldIdx],
      });
      i++;
    } else if (cur.type === 'removed') {
      merged.push({
        type: 'removed',
        oldLine: cur.oldIdx + 1,
        content: oldLines[cur.oldIdx],
      });
      i++;
    } else {
      // added
      const added = cur as { type: 'added'; newIdx: number };
      merged.push({
        type: 'added',
        newLine: added.newIdx + 1,
        content: newLines[added.newIdx],
      });
      i++;
    }
  }

  return merged;
}

// ── 공개 API ──────────────────────────────────────────────────────────────

const MAX_CHARS = 50_000;

/**
 * 두 텍스트의 diff를 계산하여 DiffResult를 반환한다.
 * 50,000자 초과 시 잘라서 처리하고 truncated 플래그를 추가한다.
 */
export function computeDiff(oldText: string, newText: string): DiffResult & { truncated?: boolean } {
  let truncated = false;

  let effectiveOld = oldText ?? '';
  let effectiveNew = newText ?? '';

  if (effectiveOld.length > MAX_CHARS || effectiveNew.length > MAX_CHARS) {
    truncated = true;
    effectiveOld = effectiveOld.slice(0, MAX_CHARS);
    effectiveNew = effectiveNew.slice(0, MAX_CHARS);
  }

  const oldLines = effectiveOld.split('\n');
  const newLines = effectiveNew.split('\n');

  const ops = myersEditScript(oldLines, newLines);
  const lines = buildDiffLines(ops, oldLines, newLines);

  const stats: DiffStats = { added: 0, removed: 0, changed: 0, unchanged: 0 };
  for (const line of lines) {
    if (line.type === 'added') stats.added++;
    else if (line.type === 'removed') stats.removed++;
    else if (line.type === 'modified') stats.changed++;
    else stats.unchanged++;
  }

  return { lines, stats, ...(truncated ? { truncated: true } : {}) };
}
