'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import type { FileItem, ScrapeResult } from './types';

const PAGE_SIZE = 10;
const ALLOWED_EXTS = new Set(['pdf', 'docx', 'dotx', 'pptx', 'xlsx', 'hwp', 'hwpx', 'md', 'txt', 'csv']);
const MAX_SIZE = 50 * 1024 * 1024;

export function useFilesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();

  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [resourceFilter, setResourceFilter] = useState<'전체' | 'file' | 'document' | 'linked'>('전체');
  const [page, setPage] = useState(1);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; percent: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [detailFile, setDetailFile] = useState<FileItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<FileItem | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const [uploadScope, setUploadScope] = useState<'company' | 'department'>('department');
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

  useEffect(() => {
    if (searchParams.get('upload') === 'true') {
      setShowUpload(true);
    }
    const query = searchParams.get('q');
    if (query && !initializedFromQueryRef.current) {
      setSearch(query);
      initializedFromQueryRef.current = true;
    }
  }, [searchParams]);

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

  const deleteAsset = useCallback(async (file: FileItem) => {
    if (file.sourceType === 'document') {
      return fetch(`/api/documents?id=${file.id}`, { method: 'DELETE' });
    }

    return fetch(`/api/files/${file.id}`, { method: 'DELETE' });
  }, []);

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
    const ids = files
      .filter((file) => selectedIds.has(file.id) && file.sourceType !== 'document' && file.isOwner)
      .map((file) => file.id);

    if (ids.length === 0) {
      toast.error('범위를 변경할 수 있는 선택 파일이 없습니다.');
      return;
    }

    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/files/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: newScope }),
        }).then((r) => ({ id, ok: r.ok }))
      )
    );
    const succeeded = results
      .filter((result) => result.status === 'fulfilled' && result.value.ok)
      .map((result) => (result as PromiseFulfilledResult<{ id: string; ok: boolean }>).value.id);
    const failed = ids.length - succeeded.length;

    setFiles((prev) => prev.map((file) => succeeded.includes(file.id) ? { ...file, scope: newScope } : file));

    if (failed > 0) {
      toast.error(`${succeeded.length}개 변경 완료, ${failed}개 실패 (본인 파일만 변경 가능)`);
    } else {
      toast.success(`${succeeded.length}개 파일을 ${newScope === 'company' ? '전사' : '부서'}로 변경했습니다.`);
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

  const handleReprocess = async (file: FileItem) => {
    try {
      const res = await fetch(`/api/files/${file.id}/reprocess`, { method: 'POST' });
      if (res.ok) {
        toast.success(`"${file.name}" 재처리 시작 (완료까지 1분 소요)`);
        setFiles((prev) => prev.map((item) => item.id === file.id ? { ...item, status: '처리중' } : item));
      } else {
        toast.error('재처리 요청에 실패했습니다.');
      }
    } catch {
      toast.error('재처리 중 오류가 발생했습니다.');
    }
  };

  const handleBulkReprocess = async () => {
    const targetIds = files
      .filter((file) => selectedIds.has(file.id) && file.sourceType !== 'document' && file.isOwner)
      .map((file) => file.id);

    if (targetIds.length === 0) {
      toast.error('재처리 가능한 선택 파일이 없습니다.');
      return;
    }

    try {
      const res = await fetch('/api/files/bulk-reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'selected', fileIds: targetIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? '선택 재처리에 실패했습니다.');
        return;
      }
      setFiles((prev) => prev.map((file) => targetIds.includes(file.id) ? { ...file, status: '처리중' } : file));
      toast.success(`${data.reprocessed ?? targetIds.length}개 파일 재처리 시작`);
    } catch {
      toast.error('선택 재처리 중 오류가 발생했습니다.');
    }
  };

  const handleReprocessAllErrors = async () => {
    try {
      const res = await fetch('/api/files/bulk-reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'all-errors' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? '오류 파일 재처리에 실패했습니다.');
        return;
      }
      if (!data.reprocessed) {
        toast.success('재처리할 오류 파일이 없습니다.');
        return;
      }
      const ids = new Set<string>(data.fileIds ?? []);
      setFiles((prev) => prev.map((file) => ids.has(file.id) ? { ...file, status: '처리중' } : file));
      toast.success(`오류 파일 ${data.reprocessed}개 재처리 시작`);
    } catch {
      toast.error('오류 파일 재처리 중 오류가 발생했습니다.');
    }
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

  const closeUploadModal = () => {
    setShowUpload(false);
    setUploadProgress(null);
    setSelectedFiles([]);
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
    handleDownload,
    handleBulkDownload,
    handleScrape,
    closeUploadModal,
    handleOpenFile,
    handleDetailScopeToggle,
  };
}
