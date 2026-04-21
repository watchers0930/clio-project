'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { ForceGraphNode, ForceGraphLink } from '@/types/memo-graph';
import type { MemoGraphData } from '@/types/memo-graph';
import MemoGraphSidePanel from './MemoGraphSidePanel';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const NODE_COLOR: Record<string, string> = {
  default: '#94A3B8',
  blue:    '#6366F1',
  green:   '#22C55E',
  yellow:  '#F59E0B',
  red:     '#EF4444',
  purple:  '#A855F7',
};

const BG_COLOR = '#FFFFFF';
const LINK_COLOR_TITLE  = '#6366F1AA';
const LINK_COLOR_DASHED = '#94A3B888';

interface Props {
  data: MemoGraphData;
  onEdit: (memoId: string) => void;
}

export default function MemoGraphView({ data, onEdit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 1400, height: 600 });
  const [selected, setSelected] = useState<ForceGraphNode[]>([]);

  const selectedRef = useRef<ForceGraphNode[]>([]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

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

  // 메모이제이션 — 매 렌더마다 새 객체 생성 방지 (노드 날아가는 버그 핵심 수정)
  const graphData = useMemo(() => ({
    nodes: data.nodes as unknown as object[],
    links: data.links as unknown as object[],
  }), [data.nodes, data.links]);

  const handleNodeClick = useCallback((node: object) => {
    const n = node as ForceGraphNode;
    setSelected((prev) => {
      const exists = prev.find((s) => s.id === n.id);
      return exists ? prev.filter((s) => s.id !== n.id) : [...prev, n];
    });
  }, []);

  const handleBackgroundClick = useCallback(() => setSelected([]), []);

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

  const paintNode = useCallback((node: object, ctx: CanvasRenderingContext2D) => {
    const n = node as ForceGraphNode & { x: number; y: number };
    const color = NODE_COLOR[n.color] ?? NODE_COLOR.default;
    const isSelected = selectedRef.current.some((s) => s.id === n.id);
    const r = isSelected ? 7 : 5;

    if (isSelected) { ctx.shadowColor = color; ctx.shadowBlur = 10; }
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    if (isSelected) {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    const maxLen = 12;
    const label = n.title.length > maxLen ? n.title.slice(0, maxLen) + '…' : n.title;
    ctx.font = `500 6px "Paperlogy", "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = isSelected ? '#1E293B' : '#64748B';
    ctx.fillText(label, n.x, n.y + r + 3);
  }, []);

  const paintLink = useCallback((link: object, ctx: CanvasRenderingContext2D) => {
    const l = link as ForceGraphLink & { source: ForceGraphNode; target: ForceGraphNode };
    const sx = l.source.x ?? 0, sy = l.source.y ?? 0;
    const tx = l.target.x ?? 0, ty = l.target.y ?? 0;
    const isTitle = l.type === 'title';
    ctx.setLineDash(isTitle ? [] : [3, 4]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = isTitle ? LINK_COLOR_TITLE : LINK_COLOR_DASHED;
    ctx.lineWidth = isTitle ? 1.5 : 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  const hasSidePanel = selected.length > 0;

  const ZOOM_BUTTONS = [
    { icon: <ZoomIn size={13} />, onClick: handleZoomIn, title: '확대' },
    { icon: <ZoomOut size={13} />, onClick: handleZoomOut, title: '축소' },
    { icon: <Maximize2 size={13} />, onClick: handleZoomFit, title: '전체 맞춤' },
  ];

  return (
    <div
      className="relative w-full"
      style={{ height: 580, background: BG_COLOR, borderRadius: 16, overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 2px 16px rgba(99,102,241,0.07)' }}
    >
      {/* 줌 컨트롤 */}
      <div
        className="absolute top-3 z-20 flex flex-col gap-1"
        style={{ right: hasSidePanel ? 292 : 12 }}
      >
        {ZOOM_BUTTONS.map(({ icon, onClick, title }) => (
          <button
            key={title}
            onClick={onClick}
            title={title}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
            style={{ background: 'rgba(255,255,255,0.92)', border: '1px solid #E2E8F0', color: '#64748B', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#6366F1'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#64748B'; }}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* 그래프 */}
      <div ref={containerRef} className="absolute inset-0">
        {data.nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[13px] text-[#94A3B8]">
            메모가 없거나 연결된 메모가 없습니다
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor={BG_COLOR}
            nodeCanvasObject={paintNode}
            nodeCanvasObjectMode={() => 'replace'}
            linkCanvasObject={paintLink}
            linkCanvasObjectMode={() => 'replace'}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
            onEngineStop={handleEngineStop}
            nodeLabel={() => ''}
            cooldownTicks={150}
            d3VelocityDecay={0.7}
            nodeRelSize={5}
          />
        )}

        {/* 범례 */}
        <div
          className="absolute bottom-4 left-4 flex items-center gap-4 px-3 py-1.5 rounded-full text-[10px] text-[#64748B]"
          style={{ background: 'rgba(255,255,255,0.92)', border: '1px solid #E2E8F0', backdropFilter: 'blur(4px)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4" style={{ borderTop: `1.5px solid ${LINK_COLOR_TITLE}` }} />
            제목 일치
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4" style={{ borderTop: `1px dashed ${LINK_COLOR_DASHED}` }} />
            내용·의미 유사
          </span>
          <span className="text-[9px] text-[#94A3B8]">클릭=선택 · 드래그=이동</span>
        </div>
      </div>

      {/* 사이드 패널 */}
      {hasSidePanel && (
        <div
          className="absolute top-0 right-0 h-full border-l flex flex-col"
          style={{ width: 280, borderColor: '#E2E8F0', background: 'white', zIndex: 10 }}
        >
          <MemoGraphSidePanel
            selected={selected}
            onEdit={(id) => { setSelected([]); onEdit(id); }}
            onClose={() => setSelected([])}
          />
        </div>
      )}
    </div>
  );
}
