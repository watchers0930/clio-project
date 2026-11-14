'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import type { FileItem, ScrapeResult } from './types';
import { useFileBulkActions } from './use-file-bulk-actions';
import { useFileReprocess } from './use-file-reprocess';
import { useFileUpload } from './use-file-upload';

const PAGE_SIZE = 10;

export function useFilesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();

  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [resourceFilter, setResourceFilter] = useState<'전체' | 'file' | 'document' | 'linked'>('전체');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailFile, setDetailFile] = useState<FileItem | null>(null);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const [showScrape, setShowScrape] = useState(false);
  const [autofillFile, setAutofillFile] = useState<File | null>(null);
  const [showAutofill, setShowAutofill] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedFromQueryRef = useRef(false);

  const loadAssets = useCallback(async () => {
    const [filesRes, docsRes] = await Promise.all([
      fetch('/api/files?limit=500'),
      fetch('/api/documents'),
    ]);

    const uploadedFiles: FileItem[] = [];
    if (filesRes.ok) {
      const data = await filesRes.json();
      uploadedFiles.push(...(data.files ?? []));
    }

    const docItems: FileItem[] = [];
    if (docsRes.ok) {
      const data = await docsRes.json();
      const docs = data.documents ?? [];
      const linkedDocumentByFileId = new Map<string, { id: string; title: string }>();
      docs.forEach((d: { id: string; title: string; sourceFileIds?: string[] }) => {
        (d.sourceFileIds ?? []).forEach((sourceFileId) => {
          if (!linkedDocumentByFileId.has(sourceFileId)) {
            linkedDocumentByFileId.set(sourceFileId, { id: d.id, title: d.title });
          }
        });
      });

      for (const d of docs) {
        docItems.push({
          id: d.id,
          name: d.title,
          type: d.template ?? 'AI문서',
          department: '미분류',
          size: '-',
          uploadDate: d.createdAt ?? '',
          status: '완료',
          scope: 'company',
          isOwner: false,
          sourceType: 'document',
          sourceFileIds: d.sourceFileIds ?? [],
          linkedDocumentId: d.id,
          linkedDocumentTitle: d.title,
        });
      }

      uploadedFiles.forEach((file) => {
        const linked = linkedDocumentByFileId.get(file.id);
        if (linked) {
          file.linkedDocumentId = linked.id;
          file.linkedDocumentTitle = linked.title;
        }
      });
    }

    const nextAssets = [...uploadedFiles, ...docItems];
    setFiles(nextAssets);

    return nextAssets;
  }, []);

  const {
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
  } = useFileUpload({ loadAssets, toast, setPage, fileInputRef });
  const {
    deleteConfirm,
    bulkConfirmOpen,
    setDeleteConfirm,
    setBulkConfirmOpen,
    confirmDelete,
    doBulkDelete,
    bulkChangeScope,
  } = useFileBulkActions({ files, loadAssets, selectedIds, setSelectedIds, toast });
  const {
    bulkProgress,
    handleReprocess,
    handleBulkReprocess,
    handleReprocessAllErrors,
    handleReprocessAllUnprocessed,
    handleReprocessIndexedNoChunks,
  } = useFileReprocess({ files, setFiles, selectedIds, toast });

  useEffect(() => {
    if (searchParams.get('upload') === 'true') {
      setShowUpload(true);
    }
    const query = searchParams.get('q');
    if (query && !initializedFromQueryRef.current) {
      setSearch(query);
      initializedFromQueryRef.current = true;
    }
  }, [searchParams, setShowUpload]);

  useEffect(() => {
    async function load() {
      try {
        await loadAssets();
      } catch {
        setFiles([]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [loadAssets]);

  const filtered = files.filter((file) => {
    if (search && !file.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (resourceFilter === 'file' && file.sourceType === 'document') return false;
    if (resourceFilter === 'document' && file.sourceType !== 'document') return false;
    if (resourceFilter === 'linked' && !file.linkedDocumentId) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const reprocessableSelectedCount = files.filter((file) =>
    selectedIds.has(file.id) && file.sourceType !== 'document' && file.isOwner
  ).length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === paged.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paged.map((file) => file.id)));
    }
  };

  const handleAutofill = async (file: FileItem) => {
    try {
      const res = await fetch(`/api/files/${file.id}/download`);
      if (!res.ok) throw new Error('download api failed');
      const data = await res.json();
      if (!data.url) throw new Error('no url');
      const fileRes = await fetch(data.url);
      if (!fileRes.ok) throw new Error('fetch file failed');
      const blob = await fileRes.blob();
      setAutofillFile(new File([blob], file.name, { type: blob.type }));
    } catch {
      setAutofillFile(null);
    }
    setShowAutofill(true);
    setDetailFile(null);
  };

  const handleDownload = async (file: FileItem) => {
    setDownloadToast(file.name);
    try {
      const res = await fetch(`/api/files/${file.id}/download`);
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          const a = document.createElement('a');
          a.href = data.url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? `다운로드 실패 (${res.status})`);
      }
    } catch {
      toast.error('다운로드 중 네트워크 오류가 발생했습니다.');
    }
    setTimeout(() => setDownloadToast(null), 2000);
  };

  const handleBulkDownload = async () => {
    const targets = files.filter((f) => selectedIds.has(f.id));
    if (targets.length === 0) return;
    setDownloadToast(`${targets.length}개 파일 다운로드 중...`);
    for (const file of targets) {
      try {
        const res = await fetch(`/api/files/${file.id}/download`);
        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            const a = document.createElement('a');
            a.href = data.url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        }
      } catch {
        // skip individual failures
      }
      // small delay between downloads to avoid browser blocking
      await new Promise((r) => setTimeout(r, 300));
    }
    setTimeout(() => setDownloadToast(null), 2000);
  };

  const handleScrape = async () => {
    if (!scrapeUrl.trim() || scrapeLoading) return;
    setScrapeLoading(true);
    setScrapeResult(null);
    try {
      const res = await fetch('/api/files/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScrapeResult({ success: false, message: data.error ?? '수집에 실패했습니다.' });
        return;
      }
      if (data.data?.linkCount === 0) {
        setScrapeResult({ success: true, message: data.message ?? '상품 링크를 찾을 수 없습니다.', linkCount: 0 });
        return;
      }
      setScrapeResult({
        success: true,
        message: `${data.data.linkCount}개의 상품 링크를 수집하여 "${data.data.name}" 파일로 저장했습니다.`,
        linkCount: data.data.linkCount,
      });
      await loadAssets();
    } catch {
      setScrapeResult({ success: false, message: '네트워크 오류가 발생했습니다.' });
    } finally {
      setScrapeLoading(false);
    }
  };

  const handleOpenFile = (file: FileItem) => {
    if (file.sourceType === 'document') {
      router.push(`/documents/${file.id}`);
      return;
    }
    setDetailFile(file);
  };

  const handleDetailScopeToggle = async (file: FileItem) => {
    const newScope = file.scope === 'company' ? 'department' : 'company';
    const res = await fetch(`/api/files/${file.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: newScope }),
    });
    if (res.ok) {
      setFiles((prev) => prev.map((item) => item.id === file.id ? { ...item, scope: newScope } : item));
      setDetailFile((prev) => prev ? { ...prev, scope: newScope } : null);
      toast.success(`공개 범위를 ${newScope === 'company' ? '전사' : '부서'}로 변경했습니다.`);
    } else {
      toast.error('공개 범위 변경에 실패했습니다.');
    }
  };

  return {
    router,
    fileInputRef,
    files,
    loading,
    search,
    resourceFilter,
    page,
    showUpload,
    uploadProgress,
    selectedIds,
    dragOver,
    selectedFiles,
    detailFile,
    deleteConfirm,
    bulkConfirmOpen,
    downloadToast,
    uploadScope,
    showScrape,
    autofillFile,
    showAutofill,
    scrapeUrl,
    scrapeLoading,
    scrapeResult,
    filtered,
    safePage,
    totalPages,
    paged,
    reprocessableSelectedCount,
    setSearch,
    setResourceFilter,
    setPage,
    setShowUpload,
    setSelectedIds,
    setDragOver,
    setSelectedFiles,
    setDetailFile,
    setDeleteConfirm,
    setBulkConfirmOpen,
    setUploadScope,
    setShowScrape,
    setShowAutofill,
    setScrapeUrl,
    setScrapeResult,
    toggleSelect,
    toggleAll,
    handleFileInputChange,
    handleDrop,
    handleUpload,
    confirmDelete,
    doBulkDelete,
    bulkChangeScope,
    handleAutofill,
    handleReprocess,
    handleBulkReprocess,
    handleReprocessAllErrors,
    handleReprocessAllUnprocessed,
    handleReprocessIndexedNoChunks,
    bulkProgress,
    handleDownload,
    handleBulkDownload,
    handleScrape,
    closeUploadModal,
    handleOpenFile,
    handleDetailScopeToggle,
  };
}
