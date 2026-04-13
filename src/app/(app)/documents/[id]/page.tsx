'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { DocumentCommentPanel } from '@/components/documents/DocumentCommentPanel';
import { VersionPanel, type VersionItem } from '@/components/documents/VersionPanel';
import { Spinner } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { ArrowLeft, Download, Printer, GitBranch, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

interface DocData {
  id: string;
  title: string;
  content: string | null;
  status: string;
  created_at: string;
  template_name?: string;
  version_number?: number;
  storage_path?: string | null;
}

/** 첫 줄이 라벨 형태면 파일 기반으로 간주
 * append 후 내용이 길어져도 첫 줄이 라벨이면 HWPX로 렌더 */
function isFileBased(doc: DocData) {
  const firstLine = (doc.content ?? '').split('\n')[0];
  return firstLine.startsWith('[') && firstLine.length < 200;
}

/** 파일 기반 문서에서 라벨 이후 추가된 마크다운 내용 추출 */
function getAppendedContent(doc: DocData): string {
  const lines = (doc.content ?? '').split('\n');
  let i = 1;
  while (i < lines.length && lines[i].trim() === '') i++;
  return lines.slice(i).join('\n').trim();
}

/** 한국어 순서 표현(첫째/둘째 등)이 문장 중간에 있으면 앞에 줄바꿈 삽입 */
function normalizeOrdinals(content: string): string {
  return content.replace(/([^\n])\s*(첫째|둘째|셋째|넷째|다섯째|여섯째|일곱째|여덟째|아홉째|열째|마지막으로)[,，]/g, '$1\n$2,');
}

function renderContent(content: string) {
  return normalizeOrdinals(content).split('\n').map((line, i) => {
    if (line.startsWith('### ')) return <h3 key={i} className="text-base font-semibold text-[#1d1d1f] mt-5 mb-2">{line.replace('### ', '')}</h3>;
    if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-[#1d1d1f] mt-6 mb-2">{line.replace('## ', '')}</h2>;
    if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-[#1d1d1f] mt-6 mb-3">{line.replace('# ', '')}</h1>;
    if (line.startsWith('- ')) return <li key={i} className="text-[14px] text-[#1d1d1f] ml-5 my-0.5 leading-relaxed">{line.replace('- ', '')}</li>;
    if (line.startsWith('* ')) return <li key={i} className="text-[14px] text-[#1d1d1f] ml-5 my-0.5 leading-relaxed">{line.replace('* ', '')}</li>;
    if (/^\d+\.\s/.test(line)) return <li key={i} className="text-[14px] text-[#1d1d1f] ml-5 my-0.5 leading-relaxed list-decimal">{line.replace(/^\d+\.\s/, '')}</li>;
    if (line.trim() === '---') return <hr key={i} className="my-5 border-[#e5e5e7]" />;
    if (line.trim() === '') return <div key={i} className="h-3" />;
    return <p key={i} className="text-[14px] text-[#1d1d1f] leading-[1.8]">{line}</p>;
  });
}

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
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchDoc();
  }, [fetchDoc]);

  // 파일 기반 문서: 브라우저 다운로드 방지를 위해 fetch→blob URL 변환
  // storage_path 또는 id가 바뀔 때만 재실행 (content 변경 시 HWPX 파일은 동일하므로 재fetch 불필요)
  const docStoragePath = doc?.storage_path ?? null;
  const docIsFileBased = doc ? isFileBased(doc) : false;
  const docVersionNumber = doc?.version_number ?? 1;
  useEffect(() => {
    if (!docIsFileBased) {
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
  }, [id, docStoragePath, docIsFileBased, docVersionNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = async () => {
    if (!doc || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/documents/${id}/download?format=docx&font=맑은 고딕`);
      if (!res.ok) { toast.error('다운로드 실패'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title}.docx`;
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
      const res = await fetch(`/api/documents/${vId}/download?format=docx&font=맑은 고딕`);
      if (!res.ok) { toast.error('다운로드 실패'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('다운로드 중 오류');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="md" />
      </div>
    );
  }

  if (!doc) return null;

  const isDraft = doc.status === 'draft' || doc.status === '초안';
  const statusLabel = isDraft ? '초안' : '완료';
  const statusColor = isDraft ? 'text-[#6e6e73] bg-[#f5f5f7]' : 'text-[#30d158] bg-[#e8f5e9]';
  const fileBased = isFileBased(doc);

  return (
    <div className="flex h-full bg-[#F7F8FA]">

      {/* ── 좌측: 문서 뷰어 ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* 상단 헤더 바 */}
        <div className="bg-white border-b border-[#e5e5e7] px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Link
              href="/documents"
              className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] hover:text-[#1B1F2B] transition-colors"
            >
              <ArrowLeft size={14} />
              문서 목록
            </Link>
            <span className="text-[#e5e5e7]">|</span>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>
            {(doc.version_number ?? 1) > 1 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] font-medium">
                v{doc.version_number}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isDraft && (
              <button
                onClick={handleComplete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0071e3] text-[12px] text-[#0071e3] font-medium hover:bg-[#f0f5ff] transition-colors"
              >
                <CheckCircle2 size={13} />
                완료 처리
              </button>
            )}
            <button
              onClick={openVersionPanel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e5e5e7] text-[12px] text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors"
            >
              <GitBranch size={13} />
              버전
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e5e5e7] text-[12px] text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors"
            >
              <Printer size={13} />
              인쇄
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e5e5e7] text-[12px] text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors disabled:opacity-50"
            >
              {downloading ? <Spinner size="sm" /> : <Download size={13} />}
              {downloading ? '변환 중...' : '다운로드'}
            </button>
            {isDraft && (
              <button
                onClick={() => router.push('/documents')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B1F2B] text-white text-[12px] font-medium hover:bg-[#0071e3] transition-colors"
              >
                편집하기
              </button>
            )}
          </div>
        </div>

        {/* 문서 본문 */}
        {fileBased ? (
          /* 파일 기반 문서: HWPX iframe (추가 섹션 포함) */
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="flex-1 min-h-0">
              {fileBlobUrl ? (
                <iframe
                  ref={iframeRef}
                  src={fileBlobUrl}
                  className="w-full h-full border-0"
                  title={doc.title}
                  sandbox="allow-same-origin allow-modals"
                />
              ) : fileBlobError ? (
                <div className="flex items-center justify-center h-full text-[14px] text-[#6e6e73]">
                  파일을 불러올 수 없습니다.
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Spinner />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 마크다운 기반 문서 */
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-8 py-10">
              <div className="mb-8 pb-6 border-b border-[#e5e5e7]">
                <h1 className="text-[26px] font-bold text-[#1B1F2B] leading-tight mb-2">
                  {doc.title}
                </h1>
                <div className="flex items-center gap-3 text-[12px] text-[#6e6e73]">
                  {doc.template_name && <span>템플릿: {doc.template_name}</span>}
                  <span>{new Date(doc.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  <span>작성자: {user?.name}</span>
                </div>
              </div>
              <div ref={contentRef} className="leading-relaxed">
                {doc.content
                  ? renderContent(doc.content)
                  : <p className="text-[14px] text-[#a1a1a6]">문서 내용이 없습니다.</p>
                }
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 우측: 댓글 패널 (항상 표시) ── */}
      <div className="w-[340px] flex-shrink-0 h-full border-l border-[#e5e5e7] bg-white">
        <DocumentCommentPanel
          documentId={id}
          inline
          documentContent={doc?.content ?? ''}
          onClose={() => router.push('/documents')}
          onReflected={() => fetchDoc()}
        />
      </div>

      {/* 버전 패널 */}
      {versionPanelOpen && (
        <VersionPanel
          docId={id}
          items={versionItems}
          loading={versionLoading}
          onClose={() => setVersionPanelOpen(false)}
          onCreateNewVersion={() => router.push('/documents')}
          onDownload={(vId, title) => handleVersionDownload(vId, title)}
        />
      )}
    </div>
  );
}
