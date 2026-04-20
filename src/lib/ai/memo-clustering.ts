/**
 * 메모 임베딩 기반 Union-Find 클러스터링
 * O(N²) 쌍 비교 → 유사도 >= threshold인 쌍을 같은 그룹으로 합침
 * 권장 상한: 100개 메모 이하 (이상 시 pgvector RPC 방식 전환 권장)
 */

export interface EmbeddingRow {
  memo_id: string;
  embedding: number[];
}

/** 코사인 유사도 계산 (0 ~ 1) */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

// Union-Find 헬퍼
function find(parent: Map<string, string>, x: string): string {
  if (parent.get(x) !== x) {
    parent.set(x, find(parent, parent.get(x)!));
  }
  return parent.get(x)!;
}

function union(parent: Map<string, string>, a: string, b: string): void {
  const ra = find(parent, a);
  const rb = find(parent, b);
  if (ra !== rb) parent.set(ra, rb);
}

/**
 * Union-Find 클러스터링
 * @returns Map<rootId, memoId[]> — 그룹 크기 >= 2인 클러스터만 포함
 *          크기 1인 메모(ungrouped)는 반환 맵에서 제외됨
 */
export function clusterMemos(
  embeddings: EmbeddingRow[],
  threshold = 0.75,
): Map<string, string[]> {
  // parent 초기화
  const parent = new Map<string, string>();
  for (const row of embeddings) {
    parent.set(row.memo_id, row.memo_id);
  }

  // 모든 쌍 비교
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const sim = cosineSimilarity(embeddings[i].embedding, embeddings[j].embedding);
      if (sim >= threshold) {
        union(parent, embeddings[i].memo_id, embeddings[j].memo_id);
      }
    }
  }

  // 클러스터 맵 생성
  const clusters = new Map<string, string[]>();
  for (const row of embeddings) {
    const root = find(parent, row.memo_id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(row.memo_id);
  }

  // 그룹 크기 1(단독 메모)은 ungrouped이므로 제거
  for (const [root, ids] of clusters) {
    if (ids.length < 2) clusters.delete(root);
  }

  return clusters;
}
