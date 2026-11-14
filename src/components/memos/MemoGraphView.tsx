'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { MutableRefObject } from 'react';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import type { ForceGraphNode, MemoGraphData } from '@/types/memo-graph';
import { BG_COLOR } from '@/lib/utils/graph-hull';
import { useMemoCluster } from '@/hooks/useMemoCluster';
import { useMemoGraphPainter } from '@/hooks/useMemoGraphPainter';
import { useMemoProposalDocument } from '@/hooks/useMemoProposalDocument';
import type { LabelDir } from '@/hooks/useMemoGraphPainter';
import MemoGraphControls from './memo-graph-controls';
import { MemoGraphOverlays } from './memo-graph-overlays';
import { MemoGraphStage } from './memo-graph-stage';
import { computeClusterLabelPositions, computeLabelDirections, pinNodePositions } from './memo-graph-layout';
import type { ClusterLabelPosition } from './memo-graph-layout';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

// ──────────── Props ────────────
interface Props {
  data: MemoGraphData;
  selectedIds: Set<string>;
  ideaPanelOpen: boolean;
  onSelectedIdsChange: (value: Set<string>) => void;
  onIdeaPanelOpenChange: (open: boolean) => void;
  onEdit: (memoId: string) => void;
  onMemoSaved?: () => void;
  onSaveIdeaMemo: (text: string) => Promise<void>;
  onExtractIdeaTodos: (text: string) => Promise<import('./memo-todo-confirm-modal').ExtractedTodo[]>;
}

export default function MemoGraphView({
  data,
  selectedIds,
  ideaPanelOpen,
  onSelectedIdsChange,
  onIdeaPanelOpenChange,
  onEdit,
  onMemoSaved,
  onSaveIdeaMemo,
  onExtractIdeaTodos,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods<Record<string, unknown>, Record<string, unknown>> | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // 단일 노드 미리보기 (사이드패널)
  const [panelNode, setPanelNode] = useState<ForceGraphNode | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const selectedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

  // 노드별 라벨 방향 (그리디 충돌 회피 결과)
  const labelDirRef = useRef<Map<string, LabelDir>>(new Map());

  // 초기 로드 여부 — zoomToFit/라벨계산은 첫 번째 engineStop에서만 실행
  const isFirstStop = useRef(true);
  const centerXRef = useRef(0);
  useEffect(() => { isFirstStop.current = true; }, [data.nodes, data.links]);

  // 임계값 슬라이더 (클라이언트 필터링)
  const [threshold, setThreshold] = useState(0);
  const [graphMode, setGraphMode] = useState<'global' | 'local'>('global');
  const [showClusters, setShowClusters] = useState(false);
  const [clusterLabelPositions, setClusterLabelPositions] = useState<ClusterLabelPosition[]>([]);

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
        onSelectedIdsChange(new Set());
        setPanelNode(null);
        setActiveNodeId(null);
        onIdeaPanelOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onIdeaPanelOpenChange, onSelectedIdsChange]);

  useEffect(() => {
    const validIds = new Set(data.nodes.map((node) => node.id));
    const nextSelectedIds = new Set([...selectedIds].filter((id) => validIds.has(id)));
    const hasChanged =
      nextSelectedIds.size !== selectedIds.size ||
      [...selectedIds].some((id) => !validIds.has(id));

    if (hasChanged) {
      onSelectedIdsChange(nextSelectedIds);
      return;
    }

    if (ideaPanelOpen && selectedIds.size < 2) {
      onIdeaPanelOpenChange(false);
    }
  }, [data.nodes, ideaPanelOpen, onIdeaPanelOpenChange, onSelectedIdsChange, selectedIds]);

  // 클러스터 탐지 + AI 명명
  const clusters = useMemoCluster(data.nodes, data.links);

  // 임계값 필터링 — title 링크는 항상 표시
  const filteredGraphData = useMemo(() => ({
    nodes: data.nodes as unknown as object[],
    links: data.links.filter(
      (l) => l.type === 'title' || l.similarity >= threshold
    ) as unknown as object[],
  }), [data.nodes, data.links, threshold]);

  const validNodeIds = useMemo(() => new Set(data.nodes.map((node) => node.id)), [data.nodes]);

  const effectivePanelNode = panelNode && validNodeIds.has(panelNode.id) ? panelNode : null;
  const effectiveActiveNodeId = activeNodeId && validNodeIds.has(activeNodeId) ? activeNodeId : null;

  const selectedNodes = useMemo(
    () => data.nodes.filter((node) => selectedIds.has(node.id)),
    [data.nodes, selectedIds],
  );

  const focusNodeId =
    effectivePanelNode?.id ??
    effectiveActiveNodeId ??
    (selectedNodes.length >= 1 ? selectedNodes[0].id : null);

  const relatedNodeIds = useMemo(() => {
    if (!focusNodeId) return null;
    const ids = new Set<string>([focusNodeId]);
    data.links.forEach((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as ForceGraphNode).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as ForceGraphNode).id;
      if (sourceId === focusNodeId) ids.add(targetId);
      if (targetId === focusNodeId) ids.add(sourceId);
    });
    return ids;
  }, [data.links, focusNodeId]);

  const effectiveGraphMode = graphMode === 'local' && focusNodeId ? 'local' : 'global';

  const visibleNodeIds = useMemo(() => {
    if (effectiveGraphMode === 'global' || !relatedNodeIds) return null;
    return relatedNodeIds;
  }, [effectiveGraphMode, relatedNodeIds]);

  const focusedCluster = useMemo(() => {
    if (!focusNodeId) return null;
    return clusters.find((cluster) => cluster.clusterIds.includes(focusNodeId)) ?? null;
  }, [clusters, focusNodeId]);

  const updateClusterLabelPositions = useCallback(() => {
    if (!containerRef.current || dimensions.width <= 0 || dimensions.height <= 0 || clusters.length === 0) {
      setClusterLabelPositions([]);
      return;
    }

    const nextPositions = computeClusterLabelPositions(
      clusters,
      data.nodes as ForceGraphNode[],
      (x, y) => fgRef.current?.graph2ScreenCoords(x, y),
    );

    setClusterLabelPositions(nextPositions);
  }, [clusters, data.nodes, dimensions.height, dimensions.width]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!showClusters) {
        setClusterLabelPositions([]);
        return;
      }
      updateClusterLabelPositions();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [showClusters, updateClusterLabelPositions]);

  // 클릭 핸들러 — Shift+클릭: 멀티셀렉트 토글 / 일반 클릭: 단일 메모 포커스
  const handleNodeClick = useCallback((node: object, event: MouseEvent) => {
    const n = node as ForceGraphNode;
    setActiveNodeId(n.id);
    if (event.shiftKey) {
      const next = new Set(selectedIdsRef.current);
      if (next.has(n.id)) next.delete(n.id);
      else next.add(n.id);
      onSelectedIdsChange(next);
    } else {
      onSelectedIdsChange(new Set([n.id]));
      setPanelNode((prev) => (prev?.id === n.id ? null : n));
    }
  }, [onSelectedIdsChange]);

  const handleBackgroundClick = useCallback(() => {
    onSelectedIdsChange(new Set());
    setPanelNode(null);
    setActiveNodeId(null);
  }, [onSelectedIdsChange]);

  // 시뮬레이션 시작 전 반발력·링크 거리 설정
  useEffect(() => {
    const t = setTimeout(() => {
      if (!fgRef.current) return;
      const chargeForce = fgRef.current.d3Force('charge');
      const linkForce = fgRef.current.d3Force('link');
      chargeForce?.strength?.(-35);
      linkForce?.distance?.(40);
    }, 50);
    return () => clearTimeout(t);
  }, [data.nodes, data.links]);

  const handleEngineStop = useCallback(() => {
    if (!fgRef.current) return;
    type PosNode = { id: string; x?: number; y?: number; fx?: number; fy?: number };
    const allNodes = data.nodes as unknown as PosNode[];

    pinNodePositions(allNodes, data.links);

    fgRef.current.d3Force('link', null);
    fgRef.current.d3Force('charge', null);
    fgRef.current.d3Force('center', null);

    if (isFirstStop.current) {
      isFirstStop.current = false;

      // ── 그리디 라벨 충돌 회피 — 첫 로드 때만 실행 ─────────
      const { dirs, centerX } = computeLabelDirections(allNodes, data.links);
      centerXRef.current = centerX;
      labelDirRef.current = dirs;
      // ────────────────────────────────────────────────────────
      setTimeout(() => {
        fgRef.current?.zoomToFit(300, 40);
        setTimeout(() => {
          const z = fgRef.current?.zoom();
          if (z) fgRef.current?.zoom(z * 0.8, 200);
        }, 150);
      }, 0);
    }

    if (showClusters) {
      updateClusterLabelPositions();
    }
  }, [data.nodes, data.links, showClusters, updateClusterLabelPositions]);

  const handleZoomIn  = useCallback(() => { fgRef.current?.zoom(fgRef.current.zoom() * 1.3, 300); }, []);
  const handleZoomOut = useCallback(() => { fgRef.current?.zoom(fgRef.current.zoom() / 1.3, 300); }, []);
  const handleZoomFit = useCallback(() => { fgRef.current?.zoomToFit(400, 40); }, []);

  // 페인트 함수 (훅으로 분리)
  const { paintNode, paintLink, paintHulls } = useMemoGraphPainter({
    nodes: data.nodes as unknown as ForceGraphNode[],
    clusters,
    selectedIdsRef,
    labelDirRef,
    visibleNodeIds,
    relatedNodeIds,
    showClusters,
  });

  const hasPanel     = !!effectivePanelNode;
  const hasIdea      = ideaPanelOpen;
  const selectedArr  = useMemo(() => Array.from(selectedIds).sort(), [selectedIds]);
  const {
    proposalLoading,
    proposalError,
    setProposalError,
    handleCreateProposal,
  } = useMemoProposalDocument({
    selectedNodes,
    onSelectedIdsChange,
    onClearActiveNode: () => setActiveNodeId(null),
  });

  const handleSelectCurrentGroup = useCallback((ids: Set<string> | null) => {
    if (!ids || ids.size < 2) return;
    onSelectedIdsChange(new Set(ids));
    if (ids.size > 0) {
      const firstId = ids.values().next().value;
      setActiveNodeId(typeof firstId === 'string' ? firstId : null);
    }
    setProposalError(null);
  }, [onSelectedIdsChange, setProposalError]);

  return (
    <div
      className="relative w-full"
      style={{
        height: 580,
        background: BG_COLOR,
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 16px rgba(99,102,241,0.07)',
      }}
    >
      <MemoGraphStage
        selectedCount={selectedIds.size}
        hasData={data.nodes.length > 0}
        graphMode={graphMode}
        effectiveGraphMode={effectiveGraphMode}
        focusNodeId={focusNodeId}
        visibleNodeCount={visibleNodeIds?.size ?? 0}
        showClusters={showClusters}
        thresholdControl={<MemoGraphControls threshold={threshold} onChange={setThreshold} />}
        graphCanvas={(
          <div ref={containerRef} className="absolute inset-0">
            {dimensions.width > 0 && <ForceGraph2D
              ref={fgRef as MutableRefObject<ForceGraphMethods<Record<string, unknown>, Record<string, unknown>> | undefined>}
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
              onZoomEnd={() => {
                if (showClusters) updateClusterLabelPositions();
              }}
              nodeLabel={() => ''}
              warmupTicks={120}
              cooldownTicks={20}
              d3VelocityDecay={0.8}
              nodeRelSize={5}
              onNodeDragEnd={(node) => {
                const n = node as ForceGraphNode & { x?: number; y?: number; fx?: number; fy?: number };
                n.fx = n.x;
                n.fy = n.y;
                const dir = (n.x ?? 0) <= centerXRef.current ? 'left' : 'right';
                labelDirRef.current.set((n as ForceGraphNode).id, dir);
                if (showClusters) updateClusterLabelPositions();
              }}
            />}
          </div>
        )}
        clusterLabelPositions={clusterLabelPositions}
        focusedClusterKey={focusedCluster ? focusedCluster.clusterIds.join(',') : null}
        proposalLoading={proposalLoading}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomFit={handleZoomFit}
        onSetGlobalMode={() => setGraphMode('global')}
        onSetLocalMode={() => setGraphMode('local')}
        onToggleClusters={() => setShowClusters((prev) => !prev)}
        onSelectVisibleGroup={() => handleSelectCurrentGroup(visibleNodeIds)}
        onOpenIdeaPanel={() => onIdeaPanelOpenChange(true)}
        onCreateProposal={handleCreateProposal}
        onSelectCluster={(ids) => handleSelectCurrentGroup(new Set(ids))}
      />

      <MemoGraphOverlays
        panelNode={hasPanel ? effectivePanelNode : null}
        showIdeaPanel={hasIdea}
        memoIds={selectedArr}
        memoCount={selectedIds.size}
        proposalLoading={proposalLoading}
        proposalError={proposalError}
        onEdit={(id) => { setPanelNode(null); onEdit(id); }}
        onClosePanel={() => setPanelNode(null)}
        onCloseIdeaPanel={() => onIdeaPanelOpenChange(false)}
        onMemoSaved={() => {
          onIdeaPanelOpenChange(false);
          onSelectedIdsChange(new Set());
          onMemoSaved?.();
        }}
        onSaveIdeaMemo={onSaveIdeaMemo}
        onExtractIdeaTodos={onExtractIdeaTodos}
        onCreateDocument={handleCreateProposal}
      />
    </div>
  );
}
