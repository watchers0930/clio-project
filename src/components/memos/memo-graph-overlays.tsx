'use client';

import type { ForceGraphNode } from '@/types/memo-graph';
import MemoGraphSidePanel from './MemoGraphSidePanel';
import MemoIdeaPanel from './memo-idea-panel';
import type { ExtractedTodo } from './memo-todo-confirm-modal';

interface MemoGraphOverlaysProps {
  panelNode: ForceGraphNode | null;
  showIdeaPanel: boolean;
  memoIds: string[];
  memoCount: number;
  proposalLoading: boolean;
  proposalError: string | null;
  onEdit: (memoId: string) => void;
  onClosePanel: () => void;
  onCloseIdeaPanel: () => void;
  onMemoSaved?: () => void;
  onSaveIdeaMemo: (text: string) => Promise<void>;
  onExtractIdeaTodos: (text: string) => Promise<ExtractedTodo[]>;
  onCreateDocument: () => Promise<void>;
}

export function MemoGraphOverlays({
  panelNode,
  showIdeaPanel,
  memoIds,
  memoCount,
  proposalLoading,
  proposalError,
  onEdit,
  onClosePanel,
  onCloseIdeaPanel,
  onMemoSaved,
  onSaveIdeaMemo,
  onExtractIdeaTodos,
  onCreateDocument,
}: MemoGraphOverlaysProps) {
  return (
    <>
      {panelNode && !showIdeaPanel ? (
        <div
          className="absolute right-0 top-0 bottom-0 z-10 flex flex-col border-l"
          style={{ width: 280, borderColor: '#E2E8F0', background: 'white' }}
        >
          <MemoGraphSidePanel node={panelNode} onEdit={onEdit} onClose={onClosePanel} />
        </div>
      ) : null}

      {showIdeaPanel ? (
        <div className="absolute right-0 top-0 bottom-0 z-10">
          <MemoIdeaPanel
            memoIds={memoIds}
            memoCount={memoCount}
            onClose={onCloseIdeaPanel}
            onMemoSaved={onMemoSaved}
            onSaveMemo={onSaveIdeaMemo}
            onExtractTodos={onExtractIdeaTodos}
            onCreateDocument={onCreateDocument}
            creatingDocument={proposalLoading}
            createDocumentError={proposalError}
          />
        </div>
      ) : null}
    </>
  );
}
