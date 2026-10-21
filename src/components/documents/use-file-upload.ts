'use client';

import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { useToast } from '@/components/ui/toast';

interface UseFileUploadParams {
  selectedFiles: Set<string>;
  setSelectedFiles: Dispatch<SetStateAction<Set<string>>>;
  loadFiles: () => Promise<void>;
  toast: ReturnType<typeof useToast>;
}

export function useFileUpload({
  selectedFiles,
  setSelectedFiles,
  loadFiles,
  toast,
}: UseFileUploadParams) {
  const [uploadingLocalFiles, setUploadingLocalFiles] = useState(false);

  const uploadLocalFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingLocalFiles(true);
    try {
      const uploadedIds: string[] = [];

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('scope', 'company');

        const res = await fetch('/api/files', { method: 'POST', body: formData });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.data?.id) {
          throw new Error(data?.error ?? `${file.name} 업로드 실패`);
        }
        uploadedIds.push(data.data.id as string);
      }

      await loadFiles();
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        uploadedIds.forEach((id) => next.add(id));
        return next;
      });
      toast.success(`${uploadedIds.length}개 파일을 업로드하고 참조문서로 선택했습니다.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '로컬 파일 업로드에 실패했습니다.');
    } finally {
      setUploadingLocalFiles(false);
    }
  }, [loadFiles, toast]);

  const toggleFile = (id: string) => setSelectedFiles((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return {
    uploadingLocalFiles,
    uploadLocalFiles,
    toggleFile,
  };
}
