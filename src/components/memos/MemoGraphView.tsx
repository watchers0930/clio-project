'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { RefreshCw, ZoomIn, ZoomOut, Maximize2, Loader2, X, Pin } from 'lucide-react';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import MemoGraphControls from './memo-graph-controls';
import MemoGraphEmpty from './memo-graph-empty';
import { useMemoGraph } from '@/hooks/useMemoGraph';
import type { MemoItem } from '@/lib/supabase/types';
import type { ForceGraphNode, ForceGraphLink } from '@/types/memo-graph';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  default: { bg: '#CBD5E1', border: '#64748B', text: '#1E293B' },
  blue:    { bg: '#93C5FD', border: '#2563EB', text: '#1E3A8A' },
  green:   { bg: '#86EFAC', border: '#16A34A', text: '#14532D' },
  yellow:  { bg: '#FDE047', border: '#CA8A04', text: '#713F12' },
  red:     { bg: '#FCA5A5', border: '#DC2626', text: '#7F1D1D' },
  purple:  { bg: '#D8B4FE', border: '#9333EA', text: '#4C1D95' },
};

const NODE_R = 10;
const DEFAULT_THRESHOLD = 0.80;

interface MemoGraphViewProps {
  memos: MemoItem[];
  onView: (memo: MemoItem) => void;
}

export default function MemoGraphView({ memos, onView }: MemoGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 800, height: 520 });
  const [selectedNode, setSelectedNode] = useState<ForceGraphNode | null>(null);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);

  const { data, loading, error, refresh } = useMemoGraph(true);

  const filteredLinks = data?.links.filter(
    (l) => l.type === 'keyword' || l.similarity >= threshold
  ) ?? [];

  // 연결된 노드 ID 집합 (고립 노드 구분용)
  const linkedNodeIds = new Set(
    filteredLinks.flatMap((l) => [
      typeof l.source === 'string' ? l.source : (l.source as ForceGraphNode).id,
      typeof l.target === 'string' ? l.target : (l.target as ForceGraphNode).id,
    ])
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleNodeClick = useCallback(
    (node: ForceGraphNode) => {
      setSelectedNode(node);
      const found = memos.find((m) => m.id === node.id);
      if (found) onView(found);
    },
    [onView, memos],
  );

  const paintNode = useCallback(
    (node: ForceGraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const { bg, border, text } = COLOR_MAP[node.color] ?? COLOR_MAP.default;
      const isSelected = node.id === selectedNode?.id;
      const isLinked = linkedNodeIds.has(node.id);
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const r = isSelected ? NODE_R + 4 : NODE_R;

      // 선택 글로우
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, r + 8, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(46,111,242,0.15)';
        ctx.fill();
      }

      // 노드 배경
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = bg;
      ctx.fill();

      // 테두리
      ctx.save();
      if (!isLinked) ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.strokeStyle = isSelected ? '#2E6FF2' : border;
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.stroke();
      ctx.restore();

      // 아이콘 (📝) 또는 이니셜
      const fontSize = Math.max(12 / globalScale, 5);
      ctx.font = `bold ${fontSize}px Verdana, sans-serif`;
      ctx.fillStyle = text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✦', x, y);

      // 노드 아래 제목
      const labelSize = Math.max(9 / globalScale, 3.5);
      ctx.font = `${labelSize}px Verdana, sans-serif`;
      ctx.fillStyle = '#1B1F2B';
      ctx.textBaseline = 'top';
      const maxChars = 10;
      const label = node.title.length > maxChars
        ? node.title.slice(0, maxChars) + '…'
        : node.title;
      ctx.fillText(label, x, y + r + 4 / globalScale);
    },
    [selectedNode, linkedNodeIds],
  );

  // 클릭 영역을 노드 원과 동일하게 설정 (필수 — 없으면 클릭 안 됨)
  const paintNodeArea = useCallback(
    (node: ForceGraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, NODE_R + 4, 0, 2 * Math.PI);
      ctx.fill();
    },
    [],
  );

  const getLinkWidth = useCallback((link: ForceGraphLink) => {
    if (link.type === 'keyword') return 2;
    return 1.5 + link.similarity * 3;
  }, []);

  const getLinkColor = useCallback((link: ForceGraphLink) => {
    if (link.type === 'keyword') return '#94A3B8';
    const alpha = Math.round((0.5 + link.similarity * 0.5) * 255).toString(16).padStart(2, '0');
    return `#2E6FF2${alpha}`;
  }, []);

  const handleZoomIn = () => graphRef.current?.zoom(1.4, 300);
  const handleZoomOut = () => graphRef.current?.zoom(0.7, 300);
  const handleFit = () => graphRef.current?.zoomToFit(600, 30);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 h-[500px] text-[13px] text-[#A0A7B5]">
        <Loader2 size={15} className="animate-spin" />
        그래프 데이터 불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] gap-3">
        <p className="text-[13px] text-red-500">{error}</p>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-[#E2E5EA] rounded-lg hover:bg-[#F7F8FA] transition-colors"
        >
          <RefreshCw size={12} /> 다시 시도
        </button>
      </div>
    );
  }

  const nodeCount = data?.nodes.length ?? 0;
  const hasAnyEmbedding = data?.nodes.some((n) => n.hasEmbedding) ?? false;

  if (nodeCount === 0) return <MemoGraphEmpty case="no-memos" />;
  if (!hasAnyEmbedding && filteredLinks.length === 0) return <MemoGraphEmpty case="no-embeddings" />;

  const selectedMemo = selectedNode ? memos.find((m) => m.id === selectedNode.id) : null;

  return (
    <div className="flex flex-col border border-[#E2E5EA] rounded-xl overflow-hidden bg-white">
      {/* 컨트롤 바 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E2E5EA] bg-[#F7F8FA]">
        <div className="flex items-center gap-4 flex-1">
          <MemoGraphControls threshold={threshold} onThresholdChange={setThreshold} />
          <span className="text-[11px] text-[#A0A7B5] whitespace-nowrap">
            메모 {nodeCount}개 · 연결 {filteredLinks.length}개
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleZoomIn} title="확대" className="p-1.5 text-[#7C8494] hover:text-[#1B1F2B] hover:bg-white rounded-md transition-colors">
            <ZoomIn size={14} />
          </button>
          <button onClick={handleZoomOut} title="축소" className="p-1.5 text-[#7C8494] hover:text-[#1B1F2B] hover:bg-white rounded-md transition-colors">
            <ZoomOut size={14} />
          </button>
          <button onClick={handleFit} title="전체 맞춤" className="p-1.5 text-[#7C8494] hover:text-[#1B1F2B] hover:bg-white rounded-md transition-colors">
            <Maximize2 size={14} />
          </button>
          <div className="w-px h-4 bg-[#E2E5EA] mx-1" />
          <button onClick={refresh} title="새로고침" className="p-1.5 text-[#7C8494] hover:text-[#1B1F2B] hover:bg-white rounded-md transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* 그래프 + 사이드 패널 */}
      <div className="flex relative">
        {/* 캔버스 */}
        <div ref={containerRef} className="bg-[#FAFBFC] flex-1" style={{ height: 'calc(100vh - 240px)', minHeight: 480 }}>
          {data && (
            <ForceGraph2D
              ref={graphRef}
              width={selectedMemo ? dimensions.width - 280 : dimensions.width}
              height={dimensions.height}
              graphData={{
                nodes: data.nodes as ForceGraphNode[],
                links: filteredLinks as ForceGraphLink[],
              }}
              nodeCanvasObject={paintNode}
              nodeCanvasObjectMode={() => 'replace'}
              nodePointerAreaPaint={paintNodeArea}
              linkWidth={getLinkWidth}
              linkColor={getLinkColor}
              onNodeClick={handleNodeClick}
              nodeLabel={(node) => (node as ForceGraphNode).title}
              enableNodeDrag
              enableZoomInteraction
              cooldownTicks={200}
              onEngineStop={handleFit}
              backgroundColor="#FAFBFC"
              linkDirectionalParticles={0}
              d3VelocityDecay={0.3}
              d3AlphaDecay={0.02}
            />
          )}
        </div>

        {/* 선택 메모 사이드 패널 */}
        {selectedMemo && (
          <div className="w-[280px] border-l border-[#E2E5EA] bg-white flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E5EA]">
              <span className="text-[12px] font-semibold text-[#1B1F2B] truncate flex-1">{selectedMemo.title}</span>
              <button
                onClick={() => setSelectedNode(null)}
                className="ml-2 p-1 text-[#A0A7B5] hover:text-[#1B1F2B] rounded transition-colors flex-shrink-0"
              >
                <X size={13} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <p className="text-[12px] text-[#4B5563] leading-relaxed whitespace-pre-wrap">
                {selectedMemo.content ?? '내용 없음'}
              </p>
            </div>
            <div className="px-4 py-3 border-t border-[#E2E5EA] flex gap-2">
              <button
                onClick={() => onView(selectedMemo)}
                className="flex-1 py-1.5 text-[12px] font-medium text-white bg-[#2E6FF2] rounded-lg hover:bg-[#1A5AD9] transition-colors"
              >
                전체 보기
              </button>
              {selectedMemo.is_pinned && (
                <div className="px-2 flex items-center text-[#EAB308]">
                  <Pin size={12} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-[#E2E5EA] bg-[#F7F8FA]">
        <span className="text-[11px] text-[#A0A7B5]">연결 유형:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-[#2E6FF2]" />
          <span className="text-[11px] text-[#7C8494]">의미 유사</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-[#CBD5E1]" style={{ borderTop: '1.5px dashed #CBD5E1', height: 0 }} />
          <span className="text-[11px] text-[#7C8494]">키워드 공유</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-3 h-3 rounded-full border border-dashed border-[#9AA0AC] bg-[#E8EAED]" />
          <span className="text-[11px] text-[#7C8494]">임베딩 없음</span>
        </div>
      </div>
    </div>
  );
}
