'use client';

// 파일 재처리(단건·선택·일괄 모드) 요청과 진행 상태 폴링
import { useRef, useState } from 'react';
import type { useToast } from '@/components/ui/toast';
import type { FileItem } from './types';

type BulkReprocessMode = 'all-errors' | 'all-unprocessed' | 'indexed-no-chunks';

// 일괄 재처리 모드별 안내 문구
const BULK_REPROCESS_MESSAGES: Record<BulkReprocessMode, {
  failMsg: string;
  emptyMsg: string;
  startMsg: (n: number) => string;
  errorMsg: string;
}> = {
  'all-errors': {
    failMsg: '오류 파일 재처리에 실패했습니다.',
    emptyMsg: '재처리할 오류 파일이 없습니다.',
    startMsg: (n) => `오류 파일 ${n}개 재처리 시작`,
    errorMsg: '오류 파일 재처리 중 오류가 발생했습니다.',
  },
  'all-unprocessed': {
    failMsg: '미처리 파일 재처리에 실패했습니다.',
    emptyMsg: '미처리 파일이 없습니다.',
    startMsg: (n) => `미처리 파일 ${n}개 재처리 시작`,
    errorMsg: '미처리 파일 재처리 중 오류가 발생했습니다.',
  },
  'indexed-no-chunks': {
    failMsg: 'OCR 재처리에 실패했습니다.',
    emptyMsg: 'OCR 재처리할 파일이 없습니다.',
    startMsg: (n) => `스캔 PDF ${n}개 OCR 재처리 시작`,
    errorMsg: 'OCR 재처리 중 오류가 발생했습니다.',
  },
};

interface UseFileReprocessParams {
  files: FileItem[];
  setFiles: React.Dispatch<React.SetStateAction<FileItem[]>>;
  selectedIds: Set<string>;
  toast: ReturnType<typeof useToast>;
}

export function useFileReprocess({ files, setFiles, selectedIds, toast }: UseFileReprocessParams) {
  const [bulkProgress, setBulkProgress] = useState<{ total: number; done: number; failed: number } | null>(null);
  const bulkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleReprocess = async (file: FileItem) => {
    try {
      const res = await fetch(`/api/files/${file.id}/reprocess`, { method: 'POST' });
      if (!res.ok) {
        toast.error('재처리 요청에 실패했습니다.');
        return;
      }
      toast.success(`"${file.name}" 재처리 시작`);
      setFiles((prev) => prev.map((item) => item.id === file.id ? { ...item, status: '처리중' } : item));

      // 2초마다 상태 폴링 (최대 60초)
      let attempts = 0;
      const maxAttempts = 30;
      const poll = setInterval(async () => {
        attempts += 1;
        try {
          const statusRes = await fetch(`/api/files/${file.id}`);
          if (!statusRes.ok) return;
          const data = await statusRes.json();
          const rawStatus: string = data.status ?? '';

          if (rawStatus === 'indexed' || rawStatus === 'completed') {
            clearInterval(poll);
            setFiles((prev) => prev.map((item) => item.id === file.id ? { ...item, status: '완료' } : item));
            toast.success(`"${file.name}" 처리 완료`);
          } else if (rawStatus === 'error') {
            clearInterval(poll);
            setFiles((prev) => prev.map((item) => item.id === file.id ? { ...item, status: '오류' } : item));
            toast.error(`"${file.name}" 처리 실패 — 파일 관리에서 재처리 해주세요.`);
          } else if (attempts >= maxAttempts) {
            clearInterval(poll);
            toast.error(`"${file.name}" 처리 시간 초과 — 나중에 다시 확인해주세요.`);
          }
        } catch {
          if (attempts >= maxAttempts) clearInterval(poll);
        }
      }, 2000);
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

  const startBulkPolling = (fileIds: string[]) => {
    if (bulkIntervalRef.current) clearInterval(bulkIntervalRef.current);
    const allIds = new Set(fileIds);
    const pending = new Set(fileIds);
    let done = 0;
    let failed = 0;
    setBulkProgress({ total: fileIds.length, done: 0, failed: 0 });

    bulkIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/files?limit=500');
        if (!res.ok) return;
        const data = await res.json();
        const rows: FileItem[] = data.files ?? [];
        const rowMap = new Map(rows.map((r: FileItem) => [r.id, r]));

        // 파일 목록 상태 갱신
        setFiles((prev) => prev.map((f) => {
          if (!allIds.has(f.id)) return f;
          const fresh = rowMap.get(f.id);
          return fresh ? { ...f, status: fresh.status } : f;
        }));

        // 완료/오류 집계
        for (const id of [...pending]) {
          const fresh = rowMap.get(id);
          if (!fresh) continue;
          if (fresh.status === '완료') { done++; pending.delete(id); }
          else if (fresh.status === '오류') { failed++; pending.delete(id); }
        }

        setBulkProgress({ total: fileIds.length, done, failed });

        if (pending.size === 0) {
          clearInterval(bulkIntervalRef.current!);
          bulkIntervalRef.current = null;
          setTimeout(() => setBulkProgress(null), 5000);
        }
      } catch { /* ignore */ }
    }, 3000);
  };

  // 모드만 다른 일괄 재처리 요청 (문구는 BULK_REPROCESS_MESSAGES)
  const requestBulkReprocess = async (mode: BulkReprocessMode) => {
    const messages = BULK_REPROCESS_MESSAGES[mode];
    try {
      const res = await fetch('/api/files/bulk-reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? messages.failMsg);
        return;
      }
      if (!data.reprocessed) {
        toast.success(messages.emptyMsg);
        return;
      }
      const ids = new Set<string>(data.fileIds ?? []);
      setFiles((prev) => prev.map((file) => ids.has(file.id) ? { ...file, status: '처리중' } : file));
      toast.success(messages.startMsg(data.reprocessed));
      startBulkPolling(data.fileIds ?? []);
    } catch {
      toast.error(messages.errorMsg);
    }
  };

  const handleReprocessAllErrors = () => requestBulkReprocess('all-errors');
  const handleReprocessAllUnprocessed = () => requestBulkReprocess('all-unprocessed');
  const handleReprocessIndexedNoChunks = () => requestBulkReprocess('indexed-no-chunks');

  return {
    bulkProgress,
    handleReprocess,
    handleBulkReprocess,
    handleReprocessAllErrors,
    handleReprocessAllUnprocessed,
    handleReprocessIndexedNoChunks,
  };
}
