'use client';

// 파일 삭제(단건·일괄)와 일괄 공개 범위 변경
import { useCallback, useState } from 'react';
import type { useToast } from '@/components/ui/toast';
import { csrfFetch } from '@/hooks/csrf-client';
import type { FileItem } from './types';

interface UseFileBulkActionsParams {
  files: FileItem[];
  loadAssets: () => Promise<FileItem[]>;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  toast: ReturnType<typeof useToast>;
}

export function useFileBulkActions({ files, loadAssets, selectedIds, setSelectedIds, toast }: UseFileBulkActionsParams) {
  const [deleteConfirm, setDeleteConfirm] = useState<FileItem | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const deleteAsset = useCallback(async (file: FileItem) => {
    if (file.sourceType === 'document') {
      return csrfFetch(`/api/documents?id=${file.id}`, { method: 'DELETE' });
    }

    return fetch(`/api/files/${file.id}`, { method: 'DELETE' });
  }, []);

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await deleteAsset(deleteConfirm);
      if (res.ok) {
        await loadAssets();
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(deleteConfirm.id);
          return next;
        });
      } else {
        toast.error('파일 삭제에 실패했습니다.');
      }
    } catch {
      toast.error('파일 삭제 중 오류가 발생했습니다.');
    }
    setDeleteConfirm(null);
  };

  const doBulkDelete = async () => {
    const targets = files.filter((file) => selectedIds.has(file.id));
    const results = await Promise.allSettled(
      targets.map(async (file) => ({ file, res: await deleteAsset(file) }))
    );

    const deletedIds = new Set<string>();
    let failedCount = 0;

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.res.ok) {
        deletedIds.add(result.value.file.id);
      } else {
        failedCount += 1;
      }
    });

    await loadAssets();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      deletedIds.forEach((id) => next.delete(id));
      return next;
    });
    setBulkConfirmOpen(false);

    if (failedCount > 0) {
      toast.error(`${deletedIds.size}개 삭제, ${failedCount}개 실패`);
      return;
    }

    toast.success(`${deletedIds.size}개 삭제 완료`);
  };

  const bulkChangeScope = async (newScope: 'company' | 'department') => {
    const selected = files.filter((file) => selectedIds.has(file.id));
    const ids = selected
      .filter((file) => file.sourceType !== 'document' && file.isOwner)
      .map((file) => file.id);

    if (ids.length === 0) {
      const docCount = selected.filter((f) => f.sourceType === 'document').length;
      const notOwnerCount = selected.filter((f) => f.sourceType !== 'document' && !f.isOwner).length;
      if (docCount > 0 && notOwnerCount === 0) {
        toast.error('AI 생성 문서는 범위 변경이 불가합니다. 원본 파일을 선택해주세요.');
      } else if (notOwnerCount > 0) {
        toast.error('본인이 업로드한 파일만 범위 변경이 가능합니다.');
      } else {
        toast.error('범위를 변경할 수 있는 선택 파일이 없습니다.');
      }
      return;
    }

    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/files/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: newScope }),
        }).then(async (r) => {
          if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            return { id, ok: false, error: body.error ?? `${r.status}` };
          }
          return { id, ok: true, error: '' };
        })
      )
    );
    const succeeded = results
      .filter((result) => result.status === 'fulfilled' && result.value.ok)
      .map((result) => (result as PromiseFulfilledResult<{ id: string; ok: boolean; error: string }>).value.id);
    const failed = ids.length - succeeded.length;

    // 부서 정보도 변경될 수 있으므로 목록 재로드
    await loadAssets();
    setSelectedIds(new Set());

    if (failed > 0) {
      const firstError = results.find((r) => r.status === 'fulfilled' && !r.value.ok);
      const errorMsg = firstError?.status === 'fulfilled' ? firstError.value.error : '';
      toast.error(`${succeeded.length}개 변경, ${failed}개 실패${errorMsg ? ` (${errorMsg})` : ''}`);
    } else {
      toast.success(`${succeeded.length}개 파일을 ${newScope === 'company' ? '전사' : '부서'}로 변경했습니다.`);
    }
  };

  return {
    deleteConfirm,
    bulkConfirmOpen,
    setDeleteConfirm,
    setBulkConfirmOpen,
    confirmDelete,
    doBulkDelete,
    bulkChangeScope,
  };
}
