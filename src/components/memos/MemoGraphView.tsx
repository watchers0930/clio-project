'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { RefreshCw, ZoomIn, ZoomOut, Maximize2, Loader2 } from 'lucide-react';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import MemoGraphLegend from './MemoGraphLegend';
import MemoGraphControls from './memo-graph-controls';
import MemoGraphEmpty from './memo-graph-empty';
import { useMemoGraph } from '@/hooks/useMemoGraph';
import type { MemoItem } from '@/lib/supabase/types';
import type { ForceGraphNode, ForceGraphLink } from '@/types/memo-graph';

// react-force-graph-2d는 window에 의존 → SSR 비활성화
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

// 메모 컬러 → 캔버스 fill/stroke 색상 매핑
const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  default: { bg: '#E8EAED', border: '#9AA0AC', text: '#1B1F2B' },
  blue:    { bg: '#DBEAFE', border: '#60A5FA', text: '#1E40AF' },
  green:   { bg: '#DCFCE7', border: '#4ADE80', text: '#166534' },
  yellow:  { bg: '#FEF9C3', border: '#FACC15', text: '#854D0E' },
  red:     { bg: '#FEE2E2', border: '#F87171', text: '#991B1B' },
  purple:  { bg: '#F3E8FF', border: '#C084FC', text: '#6B21A8' },
};

const DEFAULT_THRESHOLD = 0.80;

interface MemoGraphViewProps {
  memos: MemoItem[];
  onView: (memo: MemoItem) => void;
}

export default function MemoGraphView({ memos, onView }: MemoGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 800, height: 480 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);

  const { data, loading, error, refresh } = useMemoGraph(true);

  // keyword 링크는 항상 표시, semantic 링크만 threshold 필터 적용
  const filteredLinks = data?.links.filter(
    (l) => l.type === 'keyword' || l.similarity >= threshold
  ) ?? [];

  // 컨테이너 크기 측정
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

  // 노드 클릭 → 완전한 MemoItem 전달
  const handleNodeClick = useCallback(
    (node: ForceGraphNode) => {
      setSelectedId(node.id);
      // memos prop에서 완전한 MemoItem 조회, 없으면 최소 필드로 폴백
      const found = memos.find((m) => m.id === node.id);
      onView(
        found ?? {
          id: node.id,
          title: node.title,
          color: node.color,
          is_pinned: false,
          created_by: '',
          created_at: '',
          updated_at: '',
        },
      );
    },
    [onView, memos],
  );

  // 노드 커스텀 캔버스 렌더링
  const paintNode = useCallback(
    (node: ForceGraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const { bg, border, text } = COLOR_MAP[node.color] ?? COLOR_MAP.default;
      const isSelected = node.id === selectedId;
      const r = isSelected ? 26 : 22;
      const x = node.x ?? 0;
      const y = node.y ?? 0;

      // 고립 노드 (임베딩 없음): 점선 테두리
      ctx.save();
      if (!node.hasEmbedding) {
        ctx.setLineDash([3, 3]);
      }

      // 노드 원형 배경
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#2E6FF2' : border;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.restore();

      // 선택 링 (파란 글로우)
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, r + 5, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(46,111,242,0.3)';
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      // 제목 텍스트
      const fontSize = Math.max(10 / globalScale, 4);
      ctx.font = `${fontSize}px Verdana, sans-serif`;
      ctx.fillStyle = text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const maxChars = 6;
      const label = node.title.length > maxChars ? node.title.slice(0, maxChars) + '…' : node.title;
      ctx.fillText(label, x, y);
    },
    [selectedId],
  );

  // 링크 너비: semantic은 유사도 비례, keyword는 얇게
  const getLinkWidth = useCallback((link: ForceGraphLink) => {
    if (link.type === 'keyword') return 1;
    return 0.5 + link.similarity * 3.5;
  }, []);

  // 링크 색상: semantic=파란색, keyword=회색 점선 느낌
  const getLinkColor = useCallback((link: ForceGraphLink) => {
    if (link.type === 'keyword') return '#A0A7B580';
    const alpha = Math.round((0.2 + link.similarity * 0.7) * 255).toString(16).padStart(2, '0');
    return `#2E6FF2${alpha}`;
  }, []);

  // 줌 제어
  const handleZoomIn = () => graphRef.current?.zoom(1.4, 300);
  const handleZoomOut = () => graphRef.current?.zoom(0.7, 300);
  const handleFit = () => graphRef.current?.zoomToFit(400);

  // 로딩 상태
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 h-[400px] text-[13px] text-[#A0A7B5]">
        <Loader2 size={15} className="animate-spin" />
        그래프 데이터 불러오는 중...
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] gap-3">
        <p className="text-[13px] text-red-500">{error}</p>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-[#E2E5EA] rounded-lg hover:bg-[#F7F8FA] transition-colors"
        >
          <RefreshCw size={12} />
          다시 시도
        </button>
      </div>
    );
  }

  // 빈 상태 케이스 판별
  const nodeCount = data?.nodes.length ?? 0;
  const hasAnyEmbedding = data?.nodes.some((n) => n.hasEmbedding) ?? false;

  if (nodeCount === 0) {
    return <MemoGraphEmpty case="no-memos" />;
  }
  if (!hasAnyEmbedding) {
    return <MemoGraphEmpty case="no-embeddings" />;
  }
  if (filteredLinks.length === 0) {
    return (
      <div className="flex flex-col border border-[#E2E5EA] rounded-xl overflow-hidden">
        <MemoGraphControls threshold={threshold} onThresholdChange={setThreshold} />
        <MemoGraphEmpty case="threshold-too-high" />
        <MemoGraphLegend />
      </div>
    );
  }

  return (
    <div className="flex flex-col border border-[#E2E5EA] rounded-xl overflow-hidden">
      {/* 임계값 슬라이더 */}
      <MemoGraphControls threshold={threshold} onThresholdChange={setThreshold} />

      {/* 툴바 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E2E5EA] bg-white">
        <span className="text-[12px] text-[#7C8494]">
          노드 {nodeCount}개 · 연결 {filteredLinks.length}개
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleZoomIn}
            title="확대"
            className="p-1.5 text-[#7C8494] hover:text-[#1B1F2B] hover:bg-[#F7F8FA] rounded-md transition-colors"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={handleZoomOut}
            title="축소"
            className="p-1.5 text-[#7C8494] hover:text-[#1B1F2B] hover:bg-[#F7F8FA] rounded-md transition-colors"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleFit}
            title="전체 맞춤"
            className="p-1.5 text-[#7C8494] hover:text-[#1B1F2B] hover:bg-[#F7F8FA] rounded-md transition-colors"
          >
            <Maximize2 size={14} />
          </button>
          <div className="w-px h-4 bg-[#E2E5EA] mx-1" />
          <button
            onClick={refresh}
            title="새로고침"
            className="p-1.5 text-[#7C8494] hover:text-[#1B1F2B] hover:bg-[#F7F8FA] rounded-md transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* 그래프 캔버스 */}
      <div ref={containerRef} className="bg-[#F7F8FA]" style={{ height: 480 }}>
        {data && (
          <ForceGraph2D
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={{
              nodes: data.nodes as ForceGraphNode[],
              links: filteredLinks as ForceGraphLink[],
            }}
            nodeCanvasObject={paintNode}
            nodeCanvasObjectMode={() => 'replace'}
            linkWidth={getLinkWidth}
            linkColor={getLinkColor}
            onNodeClick={handleNodeClick}
            nodeLabel={(node) => (node as ForceGraphNode).title}
            enableNodeDrag
            enableZoomInteraction
            cooldownTicks={120}
            onEngineStop={handleFit}
            backgroundColor="#F7F8FA"
          />
        )}
      </div>

      {/* 범례 */}
      <MemoGraphLegend />
    </div>
  );
}
