'use client';

import { GitFork } from 'lucide-react';

export type GraphEmptyCase = 'no-memos' | 'no-embeddings' | 'threshold-too-high';

interface MemoGraphEmptyProps {
  case: GraphEmptyCase;
}

const MESSAGES: Record<GraphEmptyCase, { title: string; description: string }> = {
  'no-memos': {
    title: '메모가 없습니다',
    description: '새 메모를 작성하면 그래프에 표시됩니다.',
  },
  'no-embeddings': {
    title: '연결된 메모가 없습니다',
    description: '메모를 작성하면 유사도 분석이 시작됩니다.',
  },
  'threshold-too-high': {
    title: '연결된 메모가 없습니다',
    description: '임계값을 낮춰보세요.',
  },
};

export default function MemoGraphEmpty({ case: emptyCase }: MemoGraphEmptyProps) {
  const { title, description } = MESSAGES[emptyCase];

  return (
    <div className="flex flex-col items-center justify-center h-[400px] gap-3 text-center">
      <GitFork size={36} className="text-[#C8CDD5]" />
      <p className="text-[14px] font-medium text-[#4A5568]">{title}</p>
      <p className="text-[12px] text-[#A0A7B5]">{description}</p>
    </div>
  );
}
