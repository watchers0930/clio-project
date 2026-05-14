'use client';

import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { ForceGraphNode, ForceGraphLink, ClusterInfo } from '@/types/memo-graph';
import { NODE_COLOR, LINK_TITLE, LINK_DASHED, LINK_SEMANTIC, convexHull, hullColor } from '@/lib/utils/graph-hull';

export type LabelDir = 'right' | 'left' | 'top' | 'bottom';

interface PainterOptions {
  nodes: ForceGraphNode[];
  clusters: ClusterInfo[];
  selectedIdsRef: MutableRefObject<Set<string>>;
  labelDirRef: MutableRefObject<Map<string, LabelDir>>;
  visibleNodeIds?: Set<string> | null;
  relatedNodeIds?: Set<string> | null;
  showClusters?: boolean;
}

export function useMemoGraphPainter({
  nodes,
  clusters,
  selectedIdsRef,
  labelDirRef,
  visibleNodeIds = null,
  relatedNodeIds = null,
  showClusters = false,
}: PainterOptions) {
  const paintNode = useCallback((node: object, ctx: CanvasRenderingContext2D) => {
    const n = node as ForceGraphNode & { x: number; y: number };
    const color = NODE_COLOR[n.color] ?? NODE_COLOR.default;
    const isMulti = selectedIdsRef.current.has(n.id);
    const isVisible = !visibleNodeIds || visibleNodeIds.has(n.id);
    const isRelated = !relatedNodeIds || relatedNodeIds.has(n.id);
    const r = isMulti ? 4.4 : isRelated ? 3.1 : 2.4;
    const baseAlpha = isVisible ? (isRelated ? 'DD' : '66') : '24';

    if (isMulti) { ctx.shadowColor = color; ctx.shadowBlur = 12; }
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = isMulti ? color : color + baseAlpha;
    ctx.fill();
    if (isMulti) {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    const label = n.title.length > 12 ? n.title.slice(0, 12) + '…' : n.title;
    ctx.font = `500 6px "Paperlogy", "Noto Sans KR", sans-serif`;
    ctx.fillStyle = isMulti ? '#0F172A' : isVisible ? (isRelated ? '#475569' : '#94A3B8') : 'rgba(148, 163, 184, 0.45)';
    const dir = labelDirRef.current.get(n.id) ?? 'bottom';
    if (dir === 'top') {
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(label, n.x, n.y - r - 3);
    } else if (dir === 'left') {
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(label, n.x - r - 3, n.y);
    } else if (dir === 'right') {
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, n.x + r + 3, n.y);
    } else {
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(label, n.x, n.y + r + 3);
    }
  }, [labelDirRef, relatedNodeIds, selectedIdsRef, visibleNodeIds]);

  const paintLink = useCallback((link: object, ctx: CanvasRenderingContext2D) => {
    const l = link as ForceGraphLink & { source: ForceGraphNode; target: ForceGraphNode };
    const sx = l.source.x ?? 0, sy = l.source.y ?? 0;
    const tx = l.target.x ?? 0, ty = l.target.y ?? 0;
    const isTitle    = l.type === 'title';
    const isSemantic = l.type === 'semantic';
    const sourceId = l.source.id;
    const targetId = l.target.id;
    const isVisible = !visibleNodeIds ||
      (visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId));
    const isRelated = !relatedNodeIds ||
      (relatedNodeIds.has(sourceId) && relatedNodeIds.has(targetId));

    ctx.setLineDash(isTitle ? [] : [3, 4]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = isVisible
      ? (isTitle ? LINK_TITLE : isSemantic ? LINK_SEMANTIC : LINK_DASHED)
      : 'rgba(203, 213, 225, 0.25)';
    ctx.globalAlpha = isVisible ? (isRelated ? 1 : 0.45) : 0.22;
    ctx.lineWidth = isRelated ? 1.1 : 0.9;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }, [relatedNodeIds, visibleNodeIds]);

  const paintHulls = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!showClusters || clusters.length === 0) return;
    const nodeMap = new Map<string, ForceGraphNode>();
    nodes.forEach((n) => nodeMap.set(n.id, n));

    clusters.forEach((cluster) => {
      const pts = cluster.clusterIds
        .map((id) => nodeMap.get(id))
        .filter((n): n is ForceGraphNode => !!n && n.x != null && n.y != null)
        .map((n) => ({ x: n.x!, y: n.y! }));

      if (pts.length < 2) return;
      const hull = pts.length === 2 ? pts : convexHull(pts);
      if (hull.length < 2) return;

      const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
      const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
      const pad = 20;
      const expanded = hull.map((p) => {
        const dx = p.x - cx, dy = p.y - cy;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        return { x: p.x + (dx / len) * pad, y: p.y + (dy / len) * pad };
      });

      ctx.beginPath();
      ctx.moveTo(expanded[0].x, expanded[0].y);
      for (let i = 1; i < expanded.length; i++) ctx.lineTo(expanded[i].x, expanded[i].y);
      ctx.closePath();
      ctx.fillStyle = hullColor();
      ctx.fill();

      if (cluster.name) {
        ctx.font = `500 4.5px "Paperlogy", "Noto Sans KR", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(100, 116, 139, 0.7)';
        ctx.fillText(cluster.name, cx, cy);
      }
    });
  }, [clusters, nodes, showClusters]);

  return { paintNode, paintLink, paintHulls };
}
