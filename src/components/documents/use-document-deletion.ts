'use client';

import type { Dispatch, SetStateAction } from 'react';
import { csrfFetch } from '@/hooks/csrf-client';
import type { DocumentItem as Document } from '@/components/documents/page-types';
import type { useToast } from '@/components/ui/toast';

interface UseDocumentDeletionParams {
  docs: Document[];
  setDocs: Dispatch<SetStateAction<Document[]>>;
  selectedDocIds: Set<string>;
  setSelectedDocIds: Dispatch<SetStateAction<Set<string>>>;
  openConfirm: (title: string, description: string | undefined, onConfirm: () => void) => void;
  closeConfirm: () => void;
  toast: ReturnType<typeof useToast>;
}

export function useDocumentDeletion({
  docs,
  setDocs,
  selectedDocIds,
  setSelectedDocIds,
  openConfirm,
  closeConfirm,
  toast,
}: UseDocumentDeletionParams) {
  const handleDelete = (id: string) => openConfirm('이 문서를 삭제하시겠습니까?', '이 작업은 되돌릴 수 없습니다.', async () => {
    closeConfirm();
    try {
      const res = await csrfFetch(`/api/documents?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDocs((prev) => prev.filter((doc) => doc.id !== id));
        setSelectedDocIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? '문서를 삭제하지 못했습니다.');
      }
    } catch {
      toast.error('네트워크 오류로 문서를 삭제하지 못했습니다.');
    }
  });

  const handleBulkDelete = () => {
    const count = selectedDocIds.size;
    if (count === 0) return;
    openConfirm(`${count}개 문서 삭제`, '선택된 문서를 모두 삭제합니다. 이 작업은 되돌릴 수 없습니다.', async () => {
      closeConfirm();
      const ids = Array.from(selectedDocIds);
      await Promise.all(ids.map((id) => csrfFetch(`/api/documents?id=${id}`, { method: 'DELETE' })));
      setDocs((prev) => prev.filter((doc) => !selectedDocIds.has(doc.id)));
      setSelectedDocIds(new Set());
    });
  };

  const handleDeleteAll = () => {
    if (docs.length === 0) return;
    openConfirm(`전체 ${docs.length}개 문서 삭제`, '모든 문서를 삭제합니다. 이 작업은 되돌릴 수 없습니다.', async () => {
      closeConfirm();
      await Promise.all(docs.map((doc) => csrfFetch(`/api/documents?id=${doc.id}`, { method: 'DELETE' })));
      setDocs([]);
      setSelectedDocIds(new Set());
    });
  };

  const toggleDocSelect = (id: string) => setSelectedDocIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleSelectAll = () => setSelectedDocIds(selectedDocIds.size === docs.length ? new Set() : new Set(docs.map((doc) => doc.id)));

  return {
    handleDelete,
    handleBulkDelete,
    handleDeleteAll,
    toggleDocSelect,
    toggleSelectAll,
  };
}
