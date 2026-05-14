'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ForceGraphNode } from '@/types/memo-graph';

interface UseMemoProposalDocumentParams {
  selectedNodes: ForceGraphNode[];
  onSelectedIdsChange: (value: Set<string>) => void;
  onClearActiveNode: () => void;
}

export function useMemoProposalDocument({
  selectedNodes,
  onSelectedIdsChange,
  onClearActiveNode,
}: UseMemoProposalDocumentParams) {
  const router = useRouter();
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);

  const handleCreateProposal = useCallback(async () => {
    if (selectedNodes.length < 2 || proposalLoading) return;

    setProposalLoading(true);
    setProposalError(null);

    try {
      const response = await fetch('/api/memos/proposal-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memoIds: selectedNodes.map((node) => node.id) }),
      });
      const data = await response.json().catch(() => null) as {
        success?: boolean;
        error?: string;
        document?: { id: string };
      } | null;

      if (!response.ok || !data?.success || !data.document?.id) {
        throw new Error(data?.error ?? '제안 보고서 생성에 실패했습니다.');
      }

      onSelectedIdsChange(new Set());
      onClearActiveNode();
      router.push(`/documents/${data.document.id}`);
    } catch (error: unknown) {
      setProposalError(error instanceof Error ? error.message : '제안 보고서 생성에 실패했습니다.');
    } finally {
      setProposalLoading(false);
    }
  }, [onClearActiveNode, onSelectedIdsChange, proposalLoading, router, selectedNodes]);

  return {
    proposalLoading,
    proposalError,
    setProposalError,
    handleCreateProposal,
  };
}
