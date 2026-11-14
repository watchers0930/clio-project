'use client';

// 파일 업로드 모달 상태·선택·전송 로직
import { useState } from 'react';
import type { useToast } from '@/components/ui/toast';
import type { FileItem } from './types';

const ALLOWED_EXTS = new Set(['pdf', 'docx', 'dotx', 'pptx', 'xlsx', 'hwp', 'hwpx', 'md', 'txt', 'csv']);
const MAX_SIZE = 50 * 1024 * 1024;

interface UseFileUploadParams {
  loadAssets: () => Promise<FileItem[]>;
  toast: ReturnType<typeof useToast>;
  setPage: (page: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function useFileUpload({ loadAssets, toast, setPage, fileInputRef }: UseFileUploadParams) {
  const [showUpload, setShowUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; percent: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadScope, setUploadScope] = useState<'company' | 'department'>('department');

  const addFiles = (incoming: File[]) => {
    const valid = incoming.filter((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      return ALLOWED_EXTS.has(ext) && file.size <= MAX_SIZE;
    });
    if (valid.length === 0) return;
    setSelectedFiles((prev) => {
      const names = new Set(prev.map((file) => file.name));
      return [...prev, ...valid.filter((file) => !names.has(file.name))];
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextFiles = e.target.files;
    if (nextFiles?.length) addFiles(Array.from(nextFiles));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles?.length) addFiles(Array.from(droppedFiles));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    const total = selectedFiles.length;
    const failed: string[] = [];
    let uploadedCount = 0;

    for (let i = 0; i < total; i++) {
      setUploadProgress({ current: i + 1, total, percent: Math.round((i / total) * 100) });
      try {
        const formData = new FormData();
        formData.append('file', selectedFiles[i]);
        formData.append('scope', uploadScope);
        const res = await fetch('/api/files', { method: 'POST', body: formData });
        if (!res.ok) {
          const text = await res.text();
          let msg = `(${res.status})`;
          try { msg = JSON.parse(text)?.error || msg; } catch {}
          failed.push(`${selectedFiles[i].name}: ${msg}`);
        } else {
          await res.json().catch(() => null);
          uploadedCount += 1;
        }
      } catch {
        failed.push(`${selectedFiles[i].name}: 네트워크 오류`);
      }
      setUploadProgress({ current: i + 1, total, percent: Math.round(((i + 1) / total) * 100) });
    }

    await loadAssets();
    if (failed.length > 0) {
      toast.error(`${total - failed.length}/${total}개 업로드 완료 (실패: ${failed.join(', ')})`);
    } else if (uploadedCount > 0) {
      toast.success(`${uploadedCount}개 파일 업로드 완료`);
    }

    setTimeout(() => {
      setUploadProgress(null);
      setShowUpload(false);
      setSelectedFiles([]);
      setUploadScope('department');
      setPage(1);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }, failed.length > 0 ? 0 : 600);
  };

  const closeUploadModal = () => {
    setShowUpload(false);
    setUploadProgress(null);
    setSelectedFiles([]);
  };

  return {
    showUpload,
    uploadProgress,
    dragOver,
    selectedFiles,
    uploadScope,
    setShowUpload,
    setDragOver,
    setSelectedFiles,
    setUploadScope,
    handleFileInputChange,
    handleDrop,
    handleUpload,
    closeUploadModal,
  };
}
