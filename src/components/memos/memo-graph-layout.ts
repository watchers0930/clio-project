import type { ClusterInfo, ForceGraphNode, GraphLink } from '@/types/memo-graph';
import type { LabelDir } from '@/hooks/useMemoGraphPainter';

export interface ClusterLabelPosition {
  key: string;
  name: string;
  x: number;
  y: number;
  ids: string[];
}

type PosNode = { id: string; x?: number; y?: number; fx?: number; fy?: number };

/** 클러스터 중심(그래프 좌표)을 화면 좌표로 변환한 라벨 위치 목록 */
export function computeClusterLabelPositions(
  clusters: ClusterInfo[],
  nodes: ForceGraphNode[],
  toScreen: (x: number, y: number) => { x: number; y: number } | undefined,
): ClusterLabelPosition[] {
  return clusters
    .map((cluster) => {
      const pts = cluster.clusterIds
        .map((id) => nodes.find((node) => node.id === id) as ForceGraphNode | undefined)
        .filter((node): node is ForceGraphNode => !!node && node.x != null && node.y != null);

      if (pts.length < 2) return null;

      const cx = pts.reduce((sum, node) => sum + (node.x ?? 0), 0) / pts.length;
      const cy = pts.reduce((sum, node) => sum + (node.y ?? 0), 0) / pts.length;
      const screen = toScreen(cx, cy);

      if (!screen) return null;

      return {
        key: [...cluster.clusterIds].sort().join(','),
        name: cluster.name ?? `클러스터 ${cluster.clusterIds.length}`,
        x: screen.x,
        y: screen.y,
        ids: cluster.clusterIds,
      } satisfies ClusterLabelPosition;
    })
    .filter((item): item is ClusterLabelPosition => item !== null);
}

/** 고립 노드를 클러스터 옆에 배치하고 모든 노드 위치를 고정(fx/fy) — nodes를 직접 변경 */
export function pinNodePositions(allNodes: PosNode[], links: GraphLink[]): void {
  // 연결된 노드 ID 수집 (시뮬레이션 후 source/target이 객체로 바뀜)
  const connectedIds = new Set<string>();
  links.forEach((l) => {
    const src = typeof l.source === 'string' ? l.source : (l.source as ForceGraphNode).id;
    const tgt = typeof l.target === 'string' ? l.target : (l.target as ForceGraphNode).id;
    connectedIds.add(src);
    connectedIds.add(tgt);
  });

  // 클러스터 중심 계산
  const connectedNodes = allNodes.filter((n) => connectedIds.has(n.id) && n.x != null);
  const cx = connectedNodes.length > 0
    ? connectedNodes.reduce((s, n) => s + (n.x ?? 0), 0) / connectedNodes.length : 0;
  const cy = connectedNodes.length > 0
    ? connectedNodes.reduce((s, n) => s + (n.y ?? 0), 0) / connectedNodes.length : 0;

  // 고립 노드: 클러스터와 같은 높이(cy)에 좌우 나란히 배치
  const isolatedNodes = allNodes.filter((n) => !connectedIds.has(n.id));
  const spacing = 100;
  isolatedNodes.forEach((n, i) => {
    // 짝수: 오른쪽, 홀수: 왼쪽 / 여러 개면 거리 누적
    const side = i % 2 === 0 ? 1 : -1;
    const dist = Math.ceil((i + 1) / 2) * spacing;
    n.x = cx + side * dist;
    n.y = cy + 50;
    n.fx = n.x;
    n.fy = n.y;
  });

  // 연결 노드 위치 고정
  connectedNodes.forEach((n) => { if (n.x != null) { n.fx = n.x; n.fy = n.y; } });
}

/** 그리디 라벨 충돌 회피 — 연결 수 많은 노드부터 겹침이 가장 적은 라벨 방향 선택 */
export function computeLabelDirections(
  allNodes: PosNode[],
  links: GraphLink[],
): { dirs: Map<string, LabelDir>; centerX: number } {
  const CHAR_W = 3.5, LABEL_H = 7, GAP = 3, NODE_R = 2.5;
  type Rect = { x1: number; y1: number; x2: number; y2: number };
  const getLabelRect = (nx: number, ny: number, len: number, dir: LabelDir): Rect => {
    const w = len * CHAR_W;
    switch (dir) {
      case 'right':  return { x1: nx+NODE_R+GAP,   y1: ny-LABEL_H/2, x2: nx+NODE_R+GAP+w,   y2: ny+LABEL_H/2 };
      case 'left':   return { x1: nx-NODE_R-GAP-w, y1: ny-LABEL_H/2, x2: nx-NODE_R-GAP,     y2: ny+LABEL_H/2 };
      case 'top':    return { x1: nx-w/2, y1: ny-NODE_R-GAP-LABEL_H, x2: nx+w/2,            y2: ny-NODE_R-GAP };
      case 'bottom': return { x1: nx-w/2, y1: ny+NODE_R+GAP,         x2: nx+w/2,            y2: ny+NODE_R+GAP+LABEL_H };
    }
  };
  const overlapArea = (a: Rect, b: Rect) => {
    const ox = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
    const oy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
    return ox * oy;
  };
  const degrees = new Map<string, number>();
  allNodes.forEach((n) => degrees.set(n.id, 0));
  links.forEach((l) => {
    type E = string | { id: string };
    const rid = (e: E) => (typeof e === 'string' ? e : e.id);
    const s = rid(l.source as E), t = rid(l.target as E);
    degrees.set(s, (degrees.get(s) ?? 0) + 1);
    degrees.set(t, (degrees.get(t) ?? 0) + 1);
  });
  const sorted = [...allNodes]
    .filter((n) => n.x != null)
    .sort((a, b) => (degrees.get(b.id) ?? 0) - (degrees.get(a.id) ?? 0));
  const allWithPos = allNodes.filter((n) => n.x != null);
  const centerX = allWithPos.length > 0
    ? allWithPos.reduce((s, n) => s + (n.x ?? 0), 0) / allWithPos.length : 0;
  const placedRects: Rect[] = [];
  const newDirs = new Map<string, LabelDir>();
  sorted.forEach((n) => {
    const raw = (n as unknown as ForceGraphNode).title ?? '';
    const label = raw.length > 12 ? raw.slice(0, 12) + '…' : raw;
    const DIRS: LabelDir[] = (n.x ?? 0) <= centerX
      ? ['left', 'top', 'bottom', 'right']
      : ['right', 'top', 'bottom', 'left'];
    let bestDir: LabelDir = DIRS[0], bestOverlap = Infinity;
    for (const dir of DIRS) {
      const rect = getLabelRect(n.x!, n.y!, label.length, dir);
      const total = placedRects.reduce((s, r) => s + overlapArea(rect, r), 0);
      if (total < bestOverlap) { bestOverlap = total; bestDir = dir; }
      if (total === 0) break;
    }
    newDirs.set(n.id, bestDir);
    placedRects.push(getLabelRect(n.x!, n.y!, label.length, bestDir));
  });
  return { dirs: newDirs, centerX };
}
