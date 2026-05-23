'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { DocumentCommentPanel } from '@/components/documents/DocumentCommentPanel';
import {
  type DocData,
  DocumentViewerContent,
  DocumentViewerHeader,
  DocumentViewerOpsSections,
  DocumentViewerOverviewSection,
  isFileBased,
} from '@/components/documents/document-viewer-page-sections';
import { ShareLinkModal } from '@/components/documents/ShareLinkModal';
import { VersionPanel, type VersionItem } from '@/components/documents/VersionPanel';
import { TodoExtractModal } from '@/components/meetings/TodoExtractModal';
import { Spinner } from '@/components/ui';
import { useToast } from '@/components/ui/toast';

export default function DocumentViewerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const user = useAuthStore((s) => s.user);
  const toast = useToast();

  const [doc, setDoc] = useState<DocData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);
  const [versionItems, setVersionItems] = useState<VersionItem[]>([]);
  const [versionLoading, setVersionLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [todoExtractOpen, setTodoExtractOpen] = useState(false);
  const [fileBlobUrl, setFileBlobUrl] = useState<string | null>(null);
  const [fileBlobError, setFileBlobError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchDoc = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setDoc(data.data);
      } else {
        toast.error('문서를 불러올 수 없습니다.');
        router.push('/documents');
      }
    } catch {
      toast.error('서버 오류');
      router.push('/documents');
    } finally {
      setLoading(false);
    }
  }, [id, router, toast]);

  useEffect(() => {
    fetchDoc();
  }, [fetchDoc]);

  // 파일 기반 문서: 브라우저 다운로드 방지를 위해 fetch→blob URL 변환
  // storage_path 또는 id가 바뀔 때만 재실행 (content 변경 시 HWPX 파일은 동일하므로 재fetch 불필요)
  const docStoragePath = doc?.storage_path ?? null;
  const docIsFileBased = doc ? isFileBased(doc) : false;
  const isProposalDoc = doc?.template_name === '제안서';
  const docVersionNumber = doc?.version_number ?? 1;
  useEffect(() => {
    if (!docIsFileBased || isProposalDoc) {
      setFileBlobUrl(null);
      setFileBlobError(false);
      return;
    }
    setFileBlobError(false);
    let objectUrl: string | null = null;
    fetch(`/api/documents/${id}/download?inline=true`)
      .then(res => {
        if (!res.ok) throw new Error('fetch failed');
        return res.text();
      })
      .then(html => {
        const blob = new Blob([html], { type: 'text/html' });
        objectUrl = URL.createObjectURL(blob);
        setFileBlobUrl(objectUrl);
      })
      .catch(() => { setFileBlobUrl(null); setFileBlobError(true); });
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, docStoragePath, docIsFileBased, docVersionNumber, isProposalDoc]);

  const handleDownload = async () => {
    if (!doc || downloading) return;
    setDownloading(true);
    try {
      const format = doc.template_name === '제안서' ? 'pdf' : 'docx';
      const extension = doc.template_name === '제안서' ? 'html' : 'docx';
      const res = await fetch(`/api/documents/${id}/download?format=${format}&font=맑은 고딕`);
      if (!res.ok) { toast.error('다운로드 실패'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('다운로드 중 오류');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    if (!doc) return;
    if (isFileBased(doc)) {
      iframeRef.current?.contentWindow?.print();
    } else {
      const content = contentRef.current?.innerHTML ?? '';
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
        <title>${doc.title}</title>
        <style>
          body { font-family: '맑은 고딕', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 40px; font-size: 13px; line-height: 1.8; color: #1d1d1f; }
          h1 { font-size: 20px; font-weight: 700; margin: 24px 0 8px; }
          h2 { font-size: 16px; font-weight: 700; margin: 20px 0 6px; }
          h3 { font-size: 14px; font-weight: 600; margin: 16px 0 4px; }
          p, li { margin: 3px 0; }
          hr { border: none; border-top: 1px solid #e5e5e7; margin: 16px 0; }
          @media print { body { margin: 0; } }
        </style>
      </head><body><h1>${doc.title}</h1>${content}</body></html>`);
      win.document.close();
      win.focus();
      win.print();
    }
  };

  const handleComplete = async () => {
    if (!doc) return;
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      const data = await res.json();
      if (data.success) {
        setDoc((prev) => prev ? { ...prev, status: 'completed' } : prev);
        toast.success('문서가 완료 처리되었습니다.');
      }
    } catch {
      toast.error('상태 변경 실패');
    }
  };

  const openVersionPanel = async () => {
    setVersionPanelOpen(true);
    setVersionLoading(true);
    try {
      const res = await fetch(`/api/documents/${id}/versions`);
      const data = await res.json();
      setVersionItems(data.versions ?? []);
    } catch {
      toast.error('버전 정보 로드 실패');
    } finally {
      setVersionLoading(false);
    }
  };

  const handleVersionDownload = async (vId: string, title: string) => {
    try {
      const format = doc?.template_name === '제안서' ? 'pdf' : 'docx';
      const extension = doc?.template_name === '제안서' ? 'html' : 'docx';
      const res = await fetch(`/api/documents/${vId}/download?format=${format}&font=맑은 고딕`);
      if (!res.ok) { toast.error('다운로드 실패'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('다운로드 중 오류');
    }
  };

  const handleReuseDocument = () => {
    if (!doc) return;
    const params = new URLSearchParams({ create: 'true' });
    if (doc.template_id) params.set('template', doc.template_id);
    if ((doc.source_file_ids ?? []).length > 0) params.set('files', (doc.source_file_ids ?? []).join(','));
    params.set('instructions', `${doc.title} 문서를 참고해서 후속 문서를 작성하세요.`);
    router.push(`/documents?${params.toString()}`);
  };

  const handleSearchRelated = () => {
    if (!doc) return;
    const params = new URLSearchParams({ q: doc.title });
    router.push(`/search?${params.toString()}`);
  };

  const handleCreateVersion = () => {
    if (!doc) return;
    const params = new URLSearchParams({
      create: 'true',
      versionOf: doc.id,
      instructions: `${doc.title} 문서를 기반으로 새 버전을 작성하세요.`,
    });
    router.push(`/documents?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="md" />
      </div>
    );
  }

  if (!doc) return null;

  void handleReuseDocument;
  const isDraft = doc.status === 'draft' || doc.status === '초안';
  const isMeetingDoc = /회의|회의록|meeting/i.test(doc.title ?? '');
  void isMeetingDoc;
  const isProposalPage = doc.template_name === '제안서';
  const navigateToDocument = (docId: string) => router.push(`/documents/${docId}`);

  return (
    <div className={`bg-surface-secondary p-4 lg:p-[20px] ${isProposalPage ? 'min-h-full' : 'flex flex-col gap-4 lg:min-h-full lg:flex-row lg:gap-[20px]'}`}>

      {/* ── 좌측: 문서 뷰어 ── */}
      <div className={`min-w-0 flex-1 ${isProposalPage ? 'mx-auto flex max-w-[1280px] flex-col gap-4' : 'flex flex-col gap-4 lg:gap-[20px]'}`}>
        <DocumentViewerHeader
          doc={doc}
          isDraft={isDraft}
          downloading={downloading}
          onOpenShare={() => setShareOpen(true)}
          onSearchRelated={handleSearchRelated}
          onComplete={handleComplete}
          onOpenVersions={openVersionPanel}
          onCreateVersion={handleCreateVersion}
          onPrint={handlePrint}
          onDownload={handleDownload}
          onEditDraft={() => router.push('/documents')}
        />

        {!isProposalPage ? (
          <DocumentViewerOverviewSection doc={doc} isDraft={isDraft} onNavigateDocument={navigateToDocument} />
        ) : null}
        {!isProposalPage ? (
          <DocumentViewerOpsSections doc={doc} onNavigateDocument={navigateToDocument} onOpenShare={() => setShareOpen(true)} />
        ) : null}
        <DocumentViewerContent
          doc={doc}
          fileBlobUrl={fileBlobUrl}
          fileBlobError={fileBlobError}
          iframeRef={iframeRef}
          contentRef={contentRef}
          authorName={user?.name}
        />
      </div>

      {/* ── 우측: 댓글 패널 (항상 표시) ── */}
      {!isProposalPage ? (
        <div id="document-comment-panel" className="w-full lg:w-[340px] flex-shrink-0 self-start overflow-hidden rounded-2xl border border-border bg-white">
          <DocumentCommentPanel
            documentId={id}
            inline
            documentContent={doc?.content ?? ''}
            onClose={() => router.push('/documents')}
            onReflected={() => fetchDoc()}
          />
        </div>
      ) : null}

      {/* 버전 패널 */}
      {versionPanelOpen && (
        <VersionPanel
          docId={id}
          items={versionItems}
          loading={versionLoading}
          onClose={() => setVersionPanelOpen(false)}
          onCreateNewVersion={handleCreateVersion}
          onDownload={(vId, title) => handleVersionDownload(vId, title)}
        />
      )}

      {shareOpen && (
        <ShareLinkModal
          resourceId={id}
          resourceTitle={doc.title}
          resourceType="document"
          onClose={() => setShareOpen(false)}
        />
      )}

      {doc && (
        <TodoExtractModal
          isOpen={todoExtractOpen}
          onClose={() => setTodoExtractOpen(false)}
          documentId={doc.id}
          documentTitle={doc.title}
          initialTodos={[]}
          onSuccess={(count) => {
            setTodoExtractOpen(false);
            toast.success(`${count}개의 할일을 등록했습니다.`);
          }}
        />
      )}
    </div>
  );
}
