'use client';

import { Pencil, X } from 'lucide-react';
import type { ForceGraphNode } from '@/types/memo-graph';

const COLOR_MAP: Record<string, string> = {
  default: '#94A3B8',
  blue:    '#6366F1',
  green:   '#22C55E',
  yellow:  '#F59E0B',
  red:     '#EF4444',
  purple:  '#A855F7',
};

interface MemoGraphSidePanelProps {
  node: ForceGraphNode;
  onEdit: (memoId: string) => void;
  onClose: () => void;
}

export default function MemoGraphSidePanel({ node, onEdit, onClose }: MemoGraphSidePanelProps) {
  const accentColor = COLOR_MAP[node.color] ?? COLOR_MAP.default;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 상단 컬러 스트라이프 */}
      <div
        style={{ height: 5, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}99)`, flexShrink: 0 }}
      />

      {/* 헤더 */}
      <div
        className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0"
        style={{ borderColor: '#E2E8F0' }}
      >
        <span className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider">메모</span>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-[#F1F5F9] transition-colors"
        >
          <X size={14} className="text-[#94A3B8]" />
        </button>
      </div>

      {/* 내용 */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="h-[3px] rounded-full mb-5" style={{ backgroundColor: accentColor }} />
        <h3 className="text-[15px] font-semibold text-[#1E293B] leading-snug mb-4">{node.title}</h3>
        {node.content ? (
          <p className="text-[13px] text-[#475569] leading-[1.9] whitespace-pre-wrap">{node.content}</p>
        ) : (
          <p className="text-[12px] text-[#94A3B8] italic">내용 없음</p>
        )}
        <button
          onClick={() => onEdit(node.id)}
          className="mt-6 flex items-center gap-1.5 w-full justify-center py-2.5 text-[12px] font-medium rounded-lg border transition-colors"
          style={{ borderColor: accentColor, color: accentColor }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = accentColor + '15'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
        >
          <Pencil size={12} />
          수정하기
        </button>
      </div>
    </div>
  );
}
