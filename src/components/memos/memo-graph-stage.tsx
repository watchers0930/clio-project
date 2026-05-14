'use client';

import { FileText, Layers3, Maximize2, Network, Radar, Sparkles, ZoomIn, ZoomOut } from 'lucide-react';

interface ClusterLabelPosition {
  key: string;
  name: string;
  x: number;
  y: number;
  ids: string[];
}

interface MemoGraphStageProps {
  selectedCount: number;
  hasData: boolean;
  hasDimensions: boolean;
  graphMode: 'global' | 'local';
  effectiveGraphMode: 'global' | 'local';
  focusNodeId: string | null;
  visibleNodeCount: number;
  showClusters: boolean;
  thresholdControl: React.ReactNode;
  graphCanvas: React.ReactNode;
  clusterLabelPositions: ClusterLabelPosition[];
  focusedClusterKey: string | null;
  proposalLoading: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onSetGlobalMode: () => void;
  onSetLocalMode: () => void;
  onToggleClusters: () => void;
  onSelectVisibleGroup: () => void;
  onOpenIdeaPanel: () => void;
  onCreateProposal: () => void;
  onSelectCluster: (ids: string[]) => void;
}

export function MemoGraphStage({
  selectedCount,
  hasData,
  hasDimensions,
  graphMode,
  effectiveGraphMode,
  focusNodeId,
  visibleNodeCount,
  showClusters,
  thresholdControl,
  graphCanvas,
  clusterLabelPositions,
  focusedClusterKey,
  proposalLoading,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onSetGlobalMode,
  onSetLocalMode,
  onToggleClusters,
  onSelectVisibleGroup,
  onOpenIdeaPanel,
  onCreateProposal,
  onSelectCluster,
}: MemoGraphStageProps) {
  return (
    <div className="absolute inset-0">
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
        <GraphZoomButton title="확대" onClick={onZoomIn}>
          <ZoomIn size={13} />
        </GraphZoomButton>
        <GraphZoomButton title="축소" onClick={onZoomOut}>
          <ZoomOut size={13} />
        </GraphZoomButton>
        <GraphZoomButton title="전체 맞춤" onClick={onZoomFit}>
          <Maximize2 size={13} />
        </GraphZoomButton>
      </div>

      <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2">
        <GraphModeButton active={graphMode === 'global'} icon={<Network size={13} />} label="전체 그래프" onClick={onSetGlobalMode} />
        <GraphModeButton active={effectiveGraphMode === 'local'} icon={<Radar size={13} />} label="로컬 그래프" disabled={!focusNodeId} onClick={onSetLocalMode} />
        <GraphModeButton active={showClusters} icon={<Layers3 size={13} />} label="클러스터" onClick={onToggleClusters} />
        {effectiveGraphMode === 'local' && visibleNodeCount >= 2 ? (
          <GraphModeButton active={false} icon={<Sparkles size={13} />} label={`이 연결 묶음 선택 (${visibleNodeCount})`} onClick={onSelectVisibleGroup} />
        ) : null}
      </div>

      <div className="absolute inset-0">
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-[13px] text-[#94A3B8]">메모가 없거나 연결된 메모가 없습니다</div>
        ) : hasDimensions ? graphCanvas : null}

        <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-4 rounded-full px-3 py-1.5 text-[10px] text-[#64748B]"
            style={{
              background: 'rgba(255,255,255,0.92)',
              border: '1px solid #E2E8F0',
              backdropFilter: 'blur(4px)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4" style={{ borderTop: '1.5px solid #6366F1AA' }} />
              제목
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4" style={{ borderTop: '1px dashed #94A3B888' }} />
              내용
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4" style={{ borderTop: '1px dashed #3B82F6AA' }} />
              의미
            </span>
            <span className="text-[9px] text-[#94A3B8]">클릭=메모 포커스 · Shift+클릭=수동 묶기</span>
          </div>
          {thresholdControl}
        </div>

        <div
          className="absolute left-4 top-14 rounded-full border px-3 py-1.5 text-[10px] text-[#475569]"
          style={{
            background: 'rgba(255,255,255,0.9)',
            borderColor: '#E2E8F0',
            boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
          }}
        >
          {effectiveGraphMode === 'local'
            ? '선택 메모 주변 연결만 보여주는 로컬 그래프'
            : '노드를 클릭하면 메모를 포커스하고, 연결 묶음 선택은 별도 액션으로 진행합니다'}
        </div>

        {showClusters && clusterLabelPositions.map((cluster) => (
          <button
            key={cluster.key}
            onClick={() => onSelectCluster(cluster.ids)}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1.5 text-[10px] font-semibold transition-all hover:scale-[1.03]"
            style={{
              left: cluster.x,
              top: cluster.y,
              background: 'rgba(255,255,255,0.96)',
              borderColor: focusedClusterKey === cluster.ids.join(',') ? '#B9D7FF' : '#D8E1EC',
              color: focusedClusterKey === cluster.ids.join(',') ? '#2E6FF2' : '#475569',
              boxShadow: '0 6px 20px rgba(15,23,42,0.12)',
              backdropFilter: 'blur(6px)',
            }}
            title={`${cluster.ids.length}개 메모 선택`}
          >
            {cluster.name}
          </button>
        ))}
      </div>

      {selectedCount >= 2 ? (
        <div className="absolute bottom-14 left-1/2 z-20 -translate-x-1/2">
          <div
            className="flex items-center gap-2 rounded-full px-3 py-2"
            style={{
              background: 'rgba(255,255,255,0.94)',
              border: '1px solid #E2E8F0',
              boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span className="px-2 text-[11px] font-medium text-[#64748B]">{selectedCount}개 메모 선택됨</span>
            <button
              onClick={onOpenIdeaPanel}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold text-white transition-all hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                boxShadow: '0 4px 12px rgba(99,102,241,0.22)',
              }}
            >
              <Sparkles size={15} />
              아이디어 생성
            </button>
            <button
              onClick={onCreateProposal}
              disabled={proposalLoading}
              className="flex items-center gap-2 rounded-full border border-[#D7E7FF] bg-[#F5F9FF] px-4 py-2 text-[12px] font-semibold text-[#2E6FF2] transition-colors hover:bg-[#EEF5FF] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileText size={14} />
              {proposalLoading ? '제안 보고서 생성 중...' : '제안 보고서'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GraphModeButton({
  active,
  disabled,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-45"
      style={{
        background: active ? '#EEF5FF' : 'rgba(255,255,255,0.92)',
        borderColor: active ? '#B9D7FF' : '#E2E8F0',
        color: active ? '#2E6FF2' : '#64748B',
        boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function GraphZoomButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
      style={{
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid #E2E8F0',
        color: '#64748B',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#6366F1'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B'; }}
    >
      {children}
    </button>
  );
}
