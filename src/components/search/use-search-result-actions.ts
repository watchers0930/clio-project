'use client';

import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { useRouter } from 'next/navigation';
import type { useToast } from '@/components/ui/toast';
import { isContractTemplate } from '@/lib/contract-fields';
import type { useGmailActions } from './use-gmail-actions';
import type { SearchResult, SearchTab } from './types';

interface UseSearchResultActionsArgs {
  router: ReturnType<typeof useRouter>;
  toast: ReturnType<typeof useToast>;
  gmail: ReturnType<typeof useGmailActions>;
  setActiveTab: Dispatch<SetStateAction<SearchTab>>;
  setPinnedFileIds: Dispatch<SetStateAction<string[] | null>>;
  setChatInput: Dispatch<SetStateAction<string>>;
}

/**
 * 검색 결과 카드의 액션(열기·미리보기·다운로드·로컬 파일·공유·댓글·AI 질의)을 캡슐화.
 * page.tsx의 상태·핸들러 부담을 줄이기 위한 훅(단일 책임: 검색 결과 상호작용).
 */
export function useSearchResultActions({
  router,
  toast,
  gmail,
  setActiveTab,
  setPinnedFileIds,
  setChatInput,
}: UseSearchResultActionsArgs) {
  const [previewData, setPreviewData] = useState<{ name: string; text: string; truncated?: boolean; totalLength?: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ id: string; title: string; type: 'document' | 'file' } | null>(null);

  const openPreview = async (fileId: string) => {
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await fetch(`/api/files/${fileId}/preview`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setPreviewData({ name: '오류', text: err?.error || '미리보기를 불러올 수 없습니다.' });
        return;
      }
      const data = await res.json();
      setPreviewData(data);
    } catch {
      setPreviewData({ name: '오류', text: '네트워크 오류가 발생했습니다.' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const startChatFromResult = (result: SearchResult) => {
    setActiveTab('ai');
    setPinnedFileIds([result.id]);
    setChatInput(`"${result.name}" 문서를 기준으로 핵심 내용을 설명해줘.`);
    toast.success('AI 질의응답 탭으로 이동했습니다.');
  };

  const canAnalyzeContract = (result: SearchResult) => {
    const upperType = (result.fileType ?? '').toUpperCase();
    return isContractTemplate(result.name) || ['DOCX', 'HWPX', 'HWP', 'PDF'].includes(upperType);
  };

  const handleDownloadOriginal = async (result: SearchResult) => {
    try {
      const res = await fetch(`/api/files/${result.id}/download`);
      if (!res.ok) {
        toast.error('다운로드 실패');
        return;
      }
      const data = await res.json();
      if (data.url) {
        const dlRes = await fetch(data.url);
        const blob = await dlRes.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      toast.error('다운로드 실패');
    }
  };

  const openLocalFileNative = async (result: SearchResult) => {
    // Electron: 네이티브 앱으로 직접 열기
    const api = (window as Window & { electronAPI?: { openFile: (p: string) => Promise<{ ok: boolean; error: string | null }>; getFolderPath: () => Promise<string | null> } }).electronAPI;
    if (!api || !result.localPath) return;
    const folderPath = await api.getFolderPath();
    if (!folderPath) { toast.error('로컬 폴더가 연결되지 않았습니다.'); return; }
    const absolutePath = `${folderPath}/${result.localPath}`;
    const res = await api.openFile(absolutePath);
    if (!res.ok) toast.error(`파일을 열 수 없습니다: ${res.error ?? ''}`);
  };

  // 로컬 파일이 있는 폴더 경로 복사 (웹은 폴더를 직접 못 여니 경로 복사로 대체)
  const copyLocalPath = async (result: SearchResult) => {
    const fullPath = result.localPath ?? '';
    if (!fullPath) { toast.error('파일 경로 정보가 없습니다.'); return; }
    // 파일명을 제외한 폴더 경로만 추출
    const folderPath = fullPath.replace(/[/\\][^/\\]*$/, '') || fullPath;
    try {
      await navigator.clipboard.writeText(folderPath);
      toast.success('폴더 경로를 복사했습니다. Finder/탐색기에서 붙여넣어 이동하세요.');
    } catch {
      toast.error('경로 복사에 실패했습니다.');
    }
  };

  const openLocalFile = (result: SearchResult) => {
    // 데스크톱 앱: 폴더/파일 직접 열기 / 웹: 경로 복사
    const api = (window as Window & { electronAPI?: { isElectron?: boolean } }).electronAPI;
    if (api?.isElectron) { void openLocalFileNative(result); return; }
    void copyLocalPath(result);
  };

  // 업로드 파일 원본을 브라우저 뷰어(PDF 등)로 새 탭에서 열기
  const openUploadedFile = async (result: SearchResult) => {
    // 팝업 차단 방지: 클릭 제스처 내에서 먼저 새 탭을 연 뒤 URL 주입
    const win = window.open('', '_blank');
    try {
      const res = await fetch(`/api/files/${result.id}/download?inline=true`);
      const data = await res.json();
      if (data.success && data.url) {
        if (win) win.location.href = data.url;
        else window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        if (win) win.close();
        toast.error(data.error ?? '파일을 열 수 없습니다.');
      }
    } catch {
      if (win) win.close();
      toast.error('파일을 열 수 없습니다.');
    }
  };

  const openResult = (result: SearchResult) => {
    if (result.sourceType === 'document') {
      router.push(`/documents/${result.id}`);
      return;
    }
    if (result.dataSource === 'local') {
      void openLocalFile(result);
      return;
    }
    if (result.dataSource === 'gmail') {
      // 앱 내 모달로 본문 조회 + 번역 (기존 Gmail 웹 이동은 모달 안의 'Gmail에서 열기'로 유지)
      gmail.openEmail(result);
      return;
    }
    // 업로드 파일: 원본을 뷰어로 열기 (PDF 등). 텍스트 미리보기는 별도 '미리보기' 버튼 사용
    void openUploadedFile(result);
  };

  const openComments = (result: SearchResult) => {
    if (result.sourceType === 'document') {
      router.push(`/documents/${result.id}#document-comment-panel`);
      return;
    }
    startChatFromResult(result);
  };

  const openShare = (result: SearchResult) => {
    setShareTarget({
      id: result.id,
      title: result.name,
      type: result.sourceType === 'document' ? 'document' : 'file',
    });
  };

  return {
    previewData,
    setPreviewData,
    previewLoading,
    shareTarget,
    setShareTarget,
    openPreview,
    startChatFromResult,
    canAnalyzeContract,
    handleDownloadOriginal,
    copyLocalPath,
    openResult,
    openComments,
    openShare,
  };
}
