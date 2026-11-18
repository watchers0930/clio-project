'use client';

import { useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { useRouter } from 'next/navigation';
import type { useToast } from '@/components/ui/toast';
import { isContractTemplate } from '@/lib/contract-fields';
import { buildDocumentCreateHref, buildDocumentFollowupHref } from '@/lib/documents/navigation';
import { downloadDocumentFile } from '@/lib/documents/download-document';
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

type PreviewData = { name: string; text: string; truncated?: boolean; totalLength?: number };

/** 문서(sourceType 'document')는 문서 API, 그 밖은 파일 API — 결과 종류 분기는 이 훅 한 곳에서만 한다 */
const isDocumentResult = (result: SearchResult) => result.sourceType === 'document';

// 문서·파일 미리보기 API 는 같은 모양({ name, text, truncated?, totalLength? } / 실패 { error })으로 답한다
async function loadPreview(result: SearchResult): Promise<PreviewData> {
  const base = isDocumentResult(result) ? '/api/documents' : '/api/files';
  const res = await fetch(`${base}/${encodeURIComponent(result.id)}/preview`);
  if (!res.ok) {
    const err = await res.json().catch(() => null) as { error?: string } | null;
    return { name: '오류', text: err?.error || '미리보기를 불러올 수 없습니다.' };
  }
  return await res.json() as PreviewData;
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
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ id: string; title: string; type: 'document' | 'file' } | null>(null);

  // 미리보기를 연달아 열 때 늦게 온 앞 응답이 화면을 덮지 않게
  const previewSeq = useRef(0);
  const openPreview = async (result: SearchResult) => {
    const seq = ++previewSeq.current;
    setPreviewLoading(true);
    setPreviewData(null);
    let data: PreviewData;
    try {
      data = await loadPreview(result);
    } catch {
      data = { name: '오류', text: '네트워크 오류가 발생했습니다.' };
    }
    if (seq !== previewSeq.current) return;
    setPreviewData(data);
    setPreviewLoading(false);
  };

  // 닫으면 진행 중인 응답도 버린다(불러오는 중 닫았다가 응답이 와서 창이 다시 열리지 않게)
  const closePreview = () => {
    previewSeq.current++;
    setPreviewData(null);
    setPreviewLoading(false);
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

  // 같은 결과 다운로드 연타 방지(제안서는 서버 렌더가 길다)
  const downloadingIds = useRef(new Set<string>());
  const handleDownloadOriginal = async (result: SearchResult) => {
    if (downloadingIds.current.has(result.id)) return;
    downloadingIds.current.add(result.id);
    try {
      await downloadResult(result);
    } finally {
      downloadingIds.current.delete(result.id);
    }
  };

  const downloadResult = async (result: SearchResult) => {
    if (isDocumentResult(result)) {
      // 문서 결과의 fileType 은 양식 이름(없으면 'AI문서') — 문서 상세와 같은 형식 규칙
      const err = await downloadDocumentFile(result.id, result.name, result.fileType);
      if (err) toast.error(err);
      return;
    }
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
    if (isDocumentResult(result)) {
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
    if (isDocumentResult(result)) {
      router.push(`/documents/${result.id}#document-comment-panel`);
      return;
    }
    startChatFromResult(result);
  };

  // 새 문서 활용 — 문서는 문서 목록의 '후속 문서'와 같은 경로(원본 양식·참고 파일 + 기준 문서), 파일은 참고자료(files)로
  // (문서 id 를 files 로 넘기면 새 문서 창이 파일 목록에 없는 id 라며 조용히 버렸다)
  const openDocumentsFromResult = (result: SearchResult) => {
    router.push(isDocumentResult(result)
      ? buildDocumentFollowupHref({ id: result.id, title: result.name, templateId: result.templateId, sourceFileIds: result.sourceFileIds })
      : buildDocumentCreateHref({
          fileIds: [result.id],
          instructions: `"${result.name}" 문서를 중심으로 문서를 작성해줘.`,
        }));
  };

  const openShare = (result: SearchResult) => {
    setShareTarget({
      id: result.id,
      title: result.name,
      type: isDocumentResult(result) ? 'document' : 'file',
    });
  };

  return {
    previewData,
    closePreview,
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
    openDocumentsFromResult,
  };
}
