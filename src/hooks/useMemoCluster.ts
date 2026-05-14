'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ClusterInfo, GraphLink, ForceGraphNode } from '@/types/memo-graph';

const clusterNameCache = new Map<string, ClusterInfo[]>();
const pendingClusterRequests = new Map<string, Promise<ClusterInfo[]>>();

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

function normalizeClusters(clusters: ClusterInfo[]): ClusterInfo[] {
  return clusters
    .map((cluster) => ({
      ...cluster,
      clusterIds: [...new Set(cluster.clusterIds.filter(Boolean))].sort(),
    }))
    .filter((cluster) => cluster.clusterIds.length >= 2);
}

function getClusterKey(clusters: ClusterInfo[]): string {
  return clusters.map((c) => c.clusterIds.join(',')).sort().join('|');
}

function sanitizeClusterName(name: string | null | undefined): string | undefined {
  const trimmed = name?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > 18 ? `${trimmed.slice(0, 18)}…` : trimmed;
}

async function fetchClusterNames(
  clusters: ClusterInfo[],
): Promise<ClusterInfo[]> {
  const normalizedClusters = normalizeClusters(clusters);
  const requestKey = getClusterKey(normalizedClusters);
  if (!requestKey) return [];
  if (normalizedClusters.length > 20) return normalizedClusters;

  const cached = clusterNameCache.get(requestKey);
  if (cached) return cached;

  const pending = pendingClusterRequests.get(requestKey);
  if (pending) return pending;

  const request = fetch('/api/memos/graph/clusters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clusters: normalizedClusters.map((cluster) => ({ memoIds: cluster.clusterIds })),
    }),
  })
    .then(async (response) => ({
      ok: response.ok,
      body: await response.json().catch(() => null) as
        | { success: boolean; data?: { name: string | null; memoIds: string[] }[] }
        | null,
    }))
    .then(({ ok, body }) => {
      if (!ok || !body?.success || !body.data) return normalizedClusters;

      const namesByKey = new Map(
        body.data.map((item) => [
          [...new Set(item.memoIds.filter(Boolean))].sort().join(','),
          sanitizeClusterName(item.name),
        ] as const),
      );

      const named = normalizedClusters.map((cluster) => ({
        ...cluster,
        name: namesByKey.get(cluster.clusterIds.join(',')) ?? undefined,
      }));

      clusterNameCache.set(requestKey, named);
      return named;
    })
    .catch(() => normalizedClusters)
    .finally(() => {
      pendingClusterRequests.delete(requestKey);
    });

  pendingClusterRequests.set(requestKey, request);
  return request;
}

export function useMemoCluster(
  nodes: { id: string }[],
  links: GraphLink[],
): ClusterInfo[] {
  const rawClusters = useMemo(() => normalizeClusters(detectClusters(nodes, links)), [nodes, links]);

  // 직렬화 키 — rawClusters 참조 변경 없이 내용 변화만 감지
  const clusterKey = useMemo(() => getClusterKey(rawClusters), [rawClusters]);

  const [namedClusters, setNamedClusters] = useState<ClusterInfo[] | null>(null);

  const visibleClusters = useMemo(() => {
    if (!namedClusters) return rawClusters;
    return getClusterKey(namedClusters) === clusterKey ? namedClusters : rawClusters;
  }, [clusterKey, namedClusters, rawClusters]);

  useEffect(() => {
    if (rawClusters.length === 0) {
      return;
    }

    let isActive = true;

    fetchClusterNames(rawClusters)
      .then((clusters) => {
        if (!isActive) return;
        if (getClusterKey(clusters) !== clusterKey) return;
        setNamedClusters(clusters);
      })
      .catch(() => {
        if (!isActive) return;
        setNamedClusters(rawClusters);
      });

    return () => {
      isActive = false;
    };
  }, [clusterKey, rawClusters]);

  return visibleClusters;
}
