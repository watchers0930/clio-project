'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ZoomIn, ZoomOut, Maximize2, Sparkles } from 'lucide-react';
import type { ForceGraphNode, ForceGraphLink, MemoGraphData, GraphLink } from '@/types/memo-graph';
import { useMemoCluster } from '@/hooks/useMemoCluster';
import MemoGraphSidePanel from './MemoGraphSidePanel';
import MemoGraphControls from './memo-graph-controls';
import MemoIdeaPanel from './memo-idea-panel';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const NODE_COLOR: Record<string, string> = {
  default: '#94A3B8',
  blue:    '#6366F1',
  green:   '#22C55E',
  yellow:  '#F59E0B',
  red:     '#EF4444',
  purple:  '#A855F7',
};

const BG_COLOR          = '#FFFFFF';
const LINK_TITLE        = '#6366F1AA';
const LINK_DASHED       = '#94A3B888';
const LINK_SEMANTIC     = '#3B82F6AA';

// ──────────── 볼록 다각형 (Andrew's monotone chain) ────────────
type Pt = { x: number; y: number };

function convexHull(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts;
  const sorted = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const hull: Pt[] = [];
  for (const p of sorted) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop();
    hull.push(p);
  }
  const t = hull.length + 1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (hull.length >= t && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop();
    hull.push(p);
  }
  hull.pop();
  return hull;
}

function hullColor(idx: number): string {
  const hue = (idx * 137.5) % 360;
  return `hsla(${hue}, 55%, 58%, 0.09)`;
}

// ──────────── Props ────────────
interface Props {
  data: MemoGraphData;
  onEdit: (memoId: string) => void;
  onMemoSaved?: () => void;
}

export default function MemoGraphView({ data, onEdit, onMemoSaved }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef        = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 1400, height: 600 });

  // 단일 노드 미리보기 (사이드패널)
  const [panelNode, setPanelNode] = useState<ForceGraphNode | null>(null);
  // 멀티셀렉트 (Shift+클릭) — 아이디어 생성용
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

  // 아이디어 패널
  const [ideaPanelOpen, setIdeaPanelOpen] = useState(false);

  // 임계값 슬라이더 (클라이언트 필터링)
  const [threshold, setThreshold] = useState(0);

  // ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) setDimensions({ width: rect.width, height: rect.height });
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setDimensions({ width: e.contentRect.width, height: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Escape 키로 선택 해제
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIds(new Set());
        setPanelNode(null);
        setIdeaPanelOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 클러스터 탐지 + AI 명명
  const clusters = useMemoCluster(data.nodes, data.links);

  // 임계값 필터링 — title 링크는 항상 표시
  const filteredGraphData = useMemo(() => ({
    nodes: data.nodes as unknown as object[],
    links: data.links.filter(
      (l) => l.type === 'title' || l.similarity >= threshold
    ) as unknown as object[],
  }), [data.nodes, data.links, threshold]);

  // 클릭 핸들러 — Shift+클릭: 멀티셀렉트 토글 / 일반 클릭: 사이드패널
  const handleNodeClick = useCallback((node: object, event: MouseEvent) => {
    const n = node as ForceGraphNode;
    if (event.shiftKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(n.id)) next.delete(n.id);
        else next.add(n.id);
        return next;
      });
    } else {
      setPanelNode((prev) => (prev?.id === n.id ? null : n));
    }
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedIds(new Set());
    setPanelNode(null);
  }, []);

  const handleEngineStop = useCallback(() => {
    (data.nodes as unknown as Array<{ x?: number; y?: number; fx?: number; fy?: number }>)
      .forEach((n) => {
        if (n.x != null) n.fx = n.x;
        if (n.y != null) n.fy = n.y;
      });
    if (fgRef.current) {
      fgRef.current.d3Force('link', null);
      fgRef.current.d3Force('charge', null);
      fgRef.current.d3Force('center', null);
    }
  }, [data.nodes]);

  const handleZoomIn  = useCallback(() => { fgRef.current?.zoom(fgRef.current.zoom() * 1.3, 300); }, []);
  const handleZoomOut = useCallback(() => { fgRef.current?.zoom(fgRef.current.zoom() / 1.3, 300); }, []);
  const handleZoomFit = useCallback(() => { fgRef.current?.zoomToFit(400, 40); }, []);

  // 노드 페인팅 — 멀티셀렉트 강조
  const paintNode = useCallback((node: object, ctx: CanvasRenderingContext2D) => {
    const n = node as ForceGraphNode & { x: number; y: number };
    const color = NODE_COLOR[n.color] ?? NODE_COLOR.default;
    const isMulti = selectedIdsRef.current.has(n.id);
    const r = isMulti ? 8 : 5;

    if (isMulti) { ctx.shadowColor = color; ctx.shadowBlur = 12; }
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = isMulti ? color : color + 'CC';
    ctx.fill();
    if (isMulti) {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    const label = n.title.length > 12 ? n.title.slice(0, 12) + '…' : n.title;
    ctx.font = `500 6px "Paperlogy", "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = isMulti ? '#1E293B' : '#64748B';
    ctx.fillText(label, n.x, n.y + r + 3);
  }, []);

  // 링크 페인팅
  const paintLink = useCallback((link: object, ctx: CanvasRenderingContext2D) => {
    const l = link as ForceGraphLink & { source: ForceGraphNode; target: ForceGraphNode };
    const sx = l.source.x ?? 0, sy = l.source.y ?? 0;
    const tx = l.target.x ?? 0, ty = l.target.y ?? 0;
    const isTitle    = l.type === 'title';
    const isSemantic = l.type === 'semantic';
    ctx.setLineDash(isTitle ? [] : [3, 4]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = isTitle ? LINK_TITLE : isSemantic ? LINK_SEMANTIC : LINK_DASHED;
    ctx.lineWidth = isTitle ? 1.5 : 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  // 클러스터 헐 그리기 (onRenderFramePost)
  const paintHulls = useCallback((ctx: CanvasRenderingContext2D) => {
    if (clusters.length === 0) return;
    const nodeMap = new Map<string, ForceGraphNode>();
    (data.nodes as unknown as ForceGraphNode[]).forEach((n) => nodeMap.set(n.id, n));

    clusters.forEach((cluster, idx) => {
      const pts = cluster.clusterIds
        .map((id) => nodeMap.get(id))
        .filter((n): n is ForceGraphNode => !!n && n.x != null && n.y != null)
        .map((n) => ({ x: n.x!, y: n.y! }));

      if (pts.length < 2) return;
      const hull = pts.length === 2 ? pts : convexHull(pts);
      if (hull.length < 2) return;

      // 헐 바깥으로 패딩 확장
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
      ctx.fillStyle = hullColor(idx);
      ctx.fill();

      // 클러스터명 (Phase 2 — name이 있을 때만)
      if (cluster.name) {
        ctx.font = `500 11px "Paperlogy", "Noto Sans KR", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(100, 116, 139, 0.7)';
        ctx.fillText(cluster.name, cx, cy);
      }
    });
  }, [clusters, data.nodes]);

  const hasPanel     = !!panelNode;
  const hasIdea      = ideaPanelOpen;
  const selectedArr  = Array.from(selectedIds);

  const ZOOM_BUTTONS = [
    { icon: <ZoomIn size={13} />, onClick: handleZoomIn, title: '확대' },
    { icon: <ZoomOut size={13} />, onClick: handleZoomOut, title: '축소' },
    { icon: <Maximize2 size={13} />, onClick: handleZoomFit, title: '전체 맞춤' },
  ];

  return (
    <div
      className="relative w-full flex"
      style={{
        height: 580,
        background: BG_COLOR,
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 16px rgba(99,102,241,0.07)',
      }}
    >
      {/* ── 그래프 영역 ── */}
      <div className="relative flex-1 min-w-0">
        {/* 줌 컨트롤 */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
          {ZOOM_BUTTONS.map(({ icon, onClick, title }) => (
            <button
              key={title}
              onClick={onClick}
              title={title}
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
              style={{
                background: 'rgba(255,255,255,0.92)',
                border: '1px solid #E2E8F0',
                color: '#64748B',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#6366F1'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#64748B'; }}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* 그래프 캔버스 */}
        <div ref={containerRef} className="absolute inset-0">
          {data.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[13px] text-[#94A3B8]">
              메모가 없거나 연결된 메모가 없습니다
            </div>
          ) : (
            <ForceGraph2D
              ref={fgRef}
              graphData={filteredGraphData}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor={BG_COLOR}
              nodeCanvasObject={paintNode}
              nodeCanvasObjectMode={() => 'replace'}
              linkCanvasObject={paintLink}
              linkCanvasObjectMode={() => 'replace'}
              onRenderFramePost={paintHulls}
              onNodeClick={handleNodeClick}
              onBackgroundClick={handleBackgroundClick}
              onEngineStop={handleEngineStop}
              nodeLabel={() => ''}
              cooldownTicks={150}
              d3VelocityDecay={0.7}
              nodeRelSize={5}
            />
          )}

          {/* 범례 + 임계값 슬라이더 */}
          <div className="absolute bottom-4 left-4 flex items-center gap-2 flex-wrap">
            <div
              className="flex items-center gap-4 px-3 py-1.5 rounded-full text-[10px] text-[#64748B]"
              style={{
                background: 'rgba(255,255,255,0.92)',
                border: '1px solid #E2E8F0',
                backdropFilter: 'blur(4px)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4" style={{ borderTop: `1.5px solid ${LINK_TITLE}` }} />
                제목
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4" style={{ borderTop: `1px dashed ${LINK_DASHED}` }} />
                내용
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4" style={{ borderTop: `1px dashed ${LINK_SEMANTIC}` }} />
                의미
              </span>
              <span className="text-[9px] text-[#94A3B8]">클릭=미리보기 · Shift+클릭=선택</span>
            </div>
            <MemoGraphControls threshold={threshold} onChange={setThreshold} />
          </div>
        </div>

        {/* 아이디어 생성 버튼 (2개 이상 선택 시 캔버스 하단 중앙) */}
        {selectedIds.size >= 2 && (
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={() => setIdeaPanelOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white rounded-full transition-all hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
              }}
            >
              <Sparkles size={15} />
              💡 아이디어 생성 ({selectedIds.size}개 메모)
            </button>
          </div>
        )}
      </div>

      {/* ── 단일 노드 미리보기 사이드패널 ── */}
      {hasPanel && !hasIdea && (
        <div
          className="border-l flex flex-col flex-shrink-0"
          style={{ width: 280, borderColor: '#E2E8F0', background: 'white' }}
        >
          <MemoGraphSidePanel
            node={panelNode!}
            onEdit={(id) => { setPanelNode(null); onEdit(id); }}
            onClose={() => setPanelNode(null)}
          />
        </div>
      )}

      {/* ── 아이디어 패널 ── */}
      {hasIdea && (
        <MemoIdeaPanel
          memoIds={selectedArr}
          memoCount={selectedIds.size}
          onClose={() => setIdeaPanelOpen(false)}
          onMemoSaved={() => {
            setIdeaPanelOpen(false);
            setSelectedIds(new Set());
            onMemoSaved?.();
          }}
        />
      )}
    </div>
  );
}
