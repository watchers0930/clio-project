'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ClusterInfo, GraphLink, ForceGraphNode } from '@/types/memo-graph';

function detectClusters(
  nodes: { id: string }[],
  links: GraphLink[],
): ClusterInfo[] {
  const parent: Record<string, string> = {};
  nodes.forEach((n) => { parent[n.id] = n.id; });

  function find(x: string): string {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }
  function union(a: string, b: string) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  links
    .forEach((l) => {
      const src = typeof l.source === 'string' ? l.source : (l.source as ForceGraphNode).id;
      const tgt = typeof l.target === 'string' ? l.target : (l.target as ForceGraphNode).id;
      union(src, tgt);
    });

  const groups: Record<string, string[]> = {};
  nodes.forEach((n) => {
    const root = find(n.id);
    if (!groups[root]) groups[root] = [];
    groups[root].push(n.id);
  });

  return Object.values(groups)
    .filter((ids) => ids.length >= 2)
    .map((clusterIds) => ({ clusterIds }));
}

export function useMemoCluster(
  nodes: { id: string }[],
  links: GraphLink[],
): ClusterInfo[] {
  const rawClusters = useMemo(() => detectClusters(nodes, links), [nodes, links]);

  // 직렬화 키 — rawClusters 참조 변경 없이 내용 변화만 감지
  const clusterKey = useMemo(
    () => rawClusters.map((c) => [...c.clusterIds].sort().join(',')).sort().join('|'),
    [rawClusters],
  );

  const [namedClusters, setNamedClusters] = useState<ClusterInfo[]>([]);

  useEffect(() => {
    if (rawClusters.length === 0) { setNamedClusters([]); return; }

    // 이름 없이 즉시 표시 (헐 먼저 그리기)
    setNamedClusters(rawClusters);

    fetch('/api/memos/graph/clusters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clusters: rawClusters.map((c) => ({ memoIds: c.clusterIds })),
      }),
    })
      .then((r) => r.json())
      .then((res: { success: boolean; data?: { index: number; name: string | null; memoIds: string[] }[] }) => {
        if (!res.success || !res.data) return;
        setNamedClusters((prev) =>
          prev.map((c, i) => ({
            ...c,
            name: res.data![i]?.name ?? undefined,
          })),
        );
      })
      .catch(() => {}); // 실패 시 이름 없는 헐만 표시
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterKey]);

  return namedClusters;
}
