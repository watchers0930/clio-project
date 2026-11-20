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

  // 여러 건 삭제: 성공한 문서만 목록에서 빼고, 거부된 문서(결재중·승인 등)는 남겨 사유를 알린다
  const deleteMany = async (ids: string[]) => {
    const results = await Promise.all(ids.map(async (id) => {
      try {
        const res = await csrfFetch(`/api/documents?id=${id}`, { method: 'DELETE' });
        if (res.ok) return { id, error: null };
        const data = await res.json().then((d) => d as { error?: string } | null, () => null);
        return { id, error: data?.error ?? '문서를 삭제하지 못했습니다.' };
      } catch {
        return { id, error: '네트워크 오류로 문서를 삭제하지 못했습니다.' };
      }
    }));
    const deleted = new Set(results.filter((r) => !r.error).map((r) => r.id));
    setDocs((prev) => prev.filter((doc) => !deleted.has(doc.id)));
    const failed = results.filter((r) => r.error);
    setSelectedDocIds(new Set(failed.map((r) => r.id)));
    if (failed.length > 0) toast.error(`${failed.length}개 문서를 삭제하지 못했습니다. ${failed[0].error}`);
  };

  const handleBulkDelete = () => {
    const count = selectedDocIds.size;
    if (count === 0) return;
    openConfirm(`${count}개 문서 삭제`, '선택된 문서를 모두 삭제합니다. 이 작업은 되돌릴 수 없습니다.', async () => {
      closeConfirm();
      await deleteMany(Array.from(selectedDocIds));
    });
  };

  const handleDeleteAll = () => {
    if (docs.length === 0) return;
    openConfirm(`전체 ${docs.length}개 문서 삭제`, '모든 문서를 삭제합니다. 이 작업은 되돌릴 수 없습니다.', async () => {
      closeConfirm();
      await deleteMany(docs.map((doc) => doc.id));
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
