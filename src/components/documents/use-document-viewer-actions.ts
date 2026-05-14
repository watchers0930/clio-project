'use client';

import { useCallback, type Dispatch, type SetStateAction, useState } from 'react';
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
  const [qualityCheckDocId, setQualityCheckDocId] = useState<string | null>(null);
  const [showViewerComments, setShowViewerComments] = useState(false);
  const [designPrompt, setDesignPrompt] = useState<string | null>(null);
  const [designPromptLang, setDesignPromptLang] = useState<'ko' | 'en'>('ko');
  const [loadingDesignPrompt, setLoadingDesignPrompt] = useState(false);
  const [copiedDesignPrompt, setCopiedDesignPrompt] = useState(false);

  const openDocModal = useCallback((doc: Document) => {
    setViewDoc(doc);
    setEditContent(doc.content ?? '');
    setEditTitle(doc.title);
    setShowViewerComments(false);
    setDesignPrompt(null);
    setCopiedDesignPrompt(false);
  }, []);

  const handleSave = async () => {
    if (!viewDoc) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${viewDoc.id}`, {
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

        const res = await fetch(`/api/documents/${viewDoc.id}`, {
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
        const res = await fetch(`/api/documents/${viewDoc.id}`, {
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

  const handleDesignPrompt = async (lang: 'ko' | 'en') => {
    if (!viewDoc) return;

    setLoadingDesignPrompt(true);
    setDesignPrompt(null);
    setDesignPromptLang(lang);
    setCopiedDesignPrompt(false);
    try {
      const res = await fetch(`/api/documents/${viewDoc.id}/design-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang }),
      });

      if (res.ok) {
        const data = await res.json();
        setDesignPrompt(data.prompt);
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error ?? '프롬프트 생성 실패');
      }
    } catch {
      toast.error('네트워크 오류');
    } finally {
      setLoadingDesignPrompt(false);
    }
  };

  const handleCopyDesignPrompt = async () => {
    if (!designPrompt) return;

    await navigator.clipboard.writeText(designPrompt);
    setCopiedDesignPrompt(true);
    setTimeout(() => setCopiedDesignPrompt(false), 2000);
  };

  const handleDownload = async (doc: Document) => {
    try {
      if (downloadFormat === 'pdf') {
        const res = await fetch(`/api/documents/${doc.id}/download?font=${encodeURIComponent(selectedFont)}&format=pdf`);
        if (!res.ok) throw new Error('다운로드 실패');

        const htmlContent = await res.text();
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          printWindow.onload = () => {
            setTimeout(() => printWindow.print(), 300);
          };
        }
        return;
      }

      const res = await fetch(`/api/documents/${doc.id}/download?font=${encodeURIComponent(selectedFont)}&format=${downloadFormat}`);
      if (!res.ok) throw new Error('다운로드 실패');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title}.${downloadFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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

      const { context, fileName } = await res.json();
      const blob = new Blob([context], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
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
    designPrompt,
    designPromptLang,
    loadingDesignPrompt,
    copiedDesignPrompt,
    isEdited,
    isDraft,
    setViewDoc,
    setEditContent,
    setEditTitle,
    setQualityCheckDocId,
    setShowViewerComments,
    openDocModal,
    handleSave,
    handleComplete,
    handleRevertToDraft,
    handleDesignPrompt,
    handleCopyDesignPrompt,
    handleDownload,
    handleDownloadAiContext,
    handleViewerClose,
  };
}
