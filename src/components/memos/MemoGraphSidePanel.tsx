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
  const preview = node.content?.trim() ? node.content.trim() : '내용 없음';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
        style={{ borderColor: '#E2E8F0' }}
      >
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
          <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-[0.18em]">메모 미리보기</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-[#F1F5F9] transition-colors"
        >
          <X size={14} className="text-[#94A3B8]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
        <div>
          <h3 className="text-[15px] font-semibold text-[#1E293B] leading-snug">{node.title}</h3>
          <p className="mt-2 text-[12px] leading-6 text-[#64748B] whitespace-pre-wrap">{preview}</p>
        </div>
        <button
          onClick={() => onEdit(node.id)}
          className="mt-auto flex items-center gap-1.5 w-full justify-center py-2.5 text-[12px] font-medium rounded-lg border transition-colors"
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
