'use client';

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction, useState } from 'react';
import { csrfFetch } from '@/hooks/csrf-client';
import type { DocumentItem as Document } from '@/components/documents/page-types';
import type { useToast } from '@/components/ui/toast';

interface ConfirmApi {
  openConfirm: (title: string, description: string | undefined, onConfirm: () => void) => void;
  closeConfirm: () => void;
}

interface UseDocumentViewerActionsParams extends ConfirmApi {
  docs: Document[];
  setDocs: Dispatch<SetStateAction<Document[]>>;
  selectedFont: string;
  downloadFormat: string;
  toast: ReturnType<typeof useToast>;
}

export function useDocumentViewerActions({
  docs,
  setDocs,
  selectedFont,
  downloadFormat,
  toast,
  openConfirm,
  closeConfirm,
}: UseDocumentViewerActionsParams) {
  const [viewDoc, setViewDoc] = useState<Document | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);
  // 저장 경합 방지: 저장 응답이 돌아왔을 때 사용자가 이미 다른 문서로 전환했는지 판별한다.
  const currentDocIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentDocIdRef.current = viewDoc?.id ?? null;
  }, [viewDoc]);
  // 편집 세션 식별자: 같은 문서를 닫았다 다시 열거나(재열기) 다른 문서로 갔다 돌아온 경우에도
  // 이전 저장 응답이 새 편집 세션의 값을 덮지 않도록 열 때마다 증가시킨다.
  const editSessionRef = useRef(0);
  const [qualityCheckDocId, setQualityCheckDocId] = useState<string | null>(null);
  const [showViewerComments, setShowViewerComments] = useState(false);
  const triggerBrowserDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const openDocModal = useCallback((doc: Document) => {
    editSessionRef.current += 1;
    setViewDoc(doc);
    setEditContent(doc.content ?? '');
    setEditTitle(doc.title);
    setShowViewerComments(false);
  }, []);

  const handleSave = async () => {
    if (!viewDoc) return;

    setSaving(true);
    try {
      const res = await csrfFetch(`/api/documents/${viewDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent, title: editTitle }),
      });
      if (!res.ok) throw new Error();

      const updated = { ...viewDoc, content: editContent, title: editTitle };
      setViewDoc(updated);
      setDocs((prev) => prev.map((doc) => (doc.id === viewDoc.id ? updated : doc)));
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 입력값(content) 단독 저장. body는 { content }만 전송한다(title·status 미포함).
   * - 성공 응답의 data.content를 진실원본으로 viewDoc·목록·편집기준을 동기화한다.
   * - 저장 중 다른 문서로 전환되면(currentDocIdRef 불일치) 편집값은 덮지 않고 목록만 갱신한다.
   * 반환: 저장 성공 여부(미리보기 실패와 저장 실패를 호출부가 구분할 수 있도록).
   */
  const handleSaveInputs = useCallback(async (): Promise<boolean> => {
    if (!viewDoc) return false;
    const targetId = viewDoc.id;
    const snapshotContent = editContent;
    const snapshotSession = editSessionRef.current;

    setSaving(true);
    try {
      const res = await csrfFetch(`/api/documents/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: snapshotContent }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(typeof json?.error === 'string' ? json.error : '저장에 실패했습니다.');
      }

      const savedContent =
        typeof json.data?.content === 'string' ? (json.data.content as string) : snapshotContent;

      // 목록은 항상 최신화(어느 문서를 보든 데이터 정합 유지)
      setDocs((prev) => prev.map((doc) => (doc.id === targetId ? { ...doc, content: savedContent } : doc)));
      // 같은 문서 + 같은 편집 세션일 때만 뷰어 상태 반영(문서 전환·재열기 시 덮어쓰기 방지).
      if (currentDocIdRef.current === targetId && editSessionRef.current === snapshotSession) {
        // 저장 기준값(viewDoc.content)은 항상 savedContent로 동기화(isEdited 판정의 기준).
        setViewDoc((prev) => (prev && prev.id === targetId ? { ...prev, content: savedContent } : prev));
        // 편집값은 저장 요청 이후 추가 입력이 없을 때만 교체한다(응답이 신규 편집을 되돌리지 않도록).
        setEditContent((prev) => (prev === snapshotContent ? savedContent : prev));
      }
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장에 실패했습니다.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [viewDoc, editContent, setDocs, toast]);

  const handleComplete = () => {
    if (!viewDoc) return;

    openConfirm('문서 완료', '문서를 최종 완료 상태로 변경합니다. 완료 후에도 초안으로 되돌릴 수 있습니다.', async () => {
      closeConfirm();
      if (!viewDoc) return;

      setSaving(true);
      try {
        const body: Record<string, string> = { status: 'completed' };
        if (editContent !== viewDoc.content) body.content = editContent;
        if (editTitle !== viewDoc.title) body.title = editTitle;

        const res = await csrfFetch(`/api/documents/${viewDoc.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();

        const updated = {
          ...viewDoc,
          ...body,
          status: '완료' as const,
          content: editContent,
          title: editTitle,
        };
        setViewDoc(updated);
        setDocs((prev) => prev.map((doc) => (doc.id === viewDoc.id ? updated : doc)));
      } catch {
        toast.error('상태 변경에 실패했습니다.');
      } finally {
        setSaving(false);
      }
    });
  };

  const handleRevertToDraft = () => {
    if (!viewDoc) return;

    openConfirm('초안으로 되돌리기', '문서를 초안 상태로 되돌립니다.', async () => {
      closeConfirm();
      if (!viewDoc) return;

      setSaving(true);
      try {
        const res = await csrfFetch(`/api/documents/${viewDoc.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'draft' }),
        });
        if (!res.ok) throw new Error();

        const updated = { ...viewDoc, status: '초안' as const };
        setViewDoc(updated);
        setDocs((prev) => prev.map((doc) => (doc.id === viewDoc.id ? updated : doc)));
      } catch {
        toast.error('상태 변경에 실패했습니다.');
      } finally {
        setSaving(false);
      }
    });
  };

  const handleDownload = async (doc: Document) => {
    try {
      const effectiveDownloadFormat = doc.outputFormat ?? (doc.template === '업무협약서(MOU)' ? 'pdf' : downloadFormat);
      if (effectiveDownloadFormat === 'pdf') {
        // 팝업은 클릭 제스처 내에서 먼저 열어야 차단되지 않는다 (await 전에 open).
        const printWindow = window.open('', '_blank');
        if (!printWindow) { toast.error('팝업이 차단되었습니다. 팝업을 허용해 주세요.'); return; }
        printWindow.document.write('<!doctype html><meta charset="utf-8"><title>문서 여는 중…</title><body style="font-family:sans-serif;padding:24px;color:#555">문서를 불러오는 중입니다…</body>');
        try {
          const res = await fetch(`/api/documents/${doc.id}/download?font=${encodeURIComponent(selectedFont)}&format=pdf`);
          if (!res.ok) throw new Error('다운로드 실패');
          const contentType = res.headers.get('Content-Type') ?? '';
          if (contentType.includes('application/pdf')) {
            // 서버가 실제 PDF 바이너리를 반환(v7.68.0~): blob URL로 열어 브라우저 PDF 뷰어로 표시(보기·인쇄·저장 가능)
            const blobUrl = URL.createObjectURL(await res.blob());
            printWindow.location.href = blobUrl;
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
          } else {
            // 양식 HTML(휴가원·재직증명서 등)은 기존처럼 인쇄 창으로 렌더
            const htmlContent = await res.text();
            printWindow.document.open();
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            printWindow.onload = () => {
              setTimeout(() => printWindow.print(), 300);
            };
          }
        } catch (e) {
          printWindow.close();
          throw e;
        }
        return;
      }

      const res = await fetch(`/api/documents/${doc.id}/download?font=${encodeURIComponent(selectedFont)}&format=${effectiveDownloadFormat}`);
      if (!res.ok) throw new Error('다운로드 실패');

      const blob = await res.blob();
      triggerBrowserDownload(blob, `${doc.title}.${effectiveDownloadFormat}`);
    } catch {
      toast.error('다운로드에 실패했습니다.');
    }
  };

  const handleDownloadAiContext = async (docId: string, lang: 'ko' | 'en') => {
    try {
      const res = await fetch(`/api/documents/${docId}/ai-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang }),
      });

      if (!res.ok) {
        toast.error(lang === 'ko' ? '다운로드 실패' : 'Download failed');
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const basicMatch = disposition.match(/filename="?([^"]+)"?/i);
      const fileName = utf8Match?.[1]
        ? decodeURIComponent(utf8Match[1])
        : (basicMatch?.[1] ?? (lang === 'ko' ? 'AI_컨텍스트_국문.txt' : 'AI_Context_EN.txt'));

      triggerBrowserDownload(blob, fileName);
    } catch {
      toast.error(lang === 'ko' ? '다운로드 실패' : 'Download failed');
    }
  };

  const isEdited = viewDoc ? editContent !== (viewDoc.content ?? '') || editTitle !== viewDoc.title : false;
  const isDraft = viewDoc?.status === '초안';

  const handleViewerClose = () => {
    if (isEdited) {
      openConfirm('저장하지 않고 닫기', '수정 내용이 저장되지 않았습니다. 닫으시겠습니까?', () => {
        closeConfirm();
        setViewDoc(null);
        setShowViewerComments(false);
      });
      return;
    }

    setViewDoc(null);
    setShowViewerComments(false);
  };

  return {
    docs,
    viewDoc,
    editContent,
    editTitle,
    saving,
    qualityCheckDocId,
    showViewerComments,
    isEdited,
    isDraft,
    setViewDoc,
    setEditContent,
    setEditTitle,
    setQualityCheckDocId,
    setShowViewerComments,
    openDocModal,
    handleSave,
    handleSaveInputs,
    handleComplete,
    handleRevertToDraft,
    handleDownload,
    handleDownloadAiContext,
    handleViewerClose,
  };
}
