'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Download, GitBranch, Link2, MoreHorizontal, Printer, Search } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { HtmlPreviewFrame } from '@/components/documents/html-preview-frame';
import { renderProposalDocumentHtml } from '@/lib/templates/proposal-render';

export interface DocData {
  id: string;
  title: string;
  content: string | null;
  status: string;
  created_at: string;
  template_id?: string | null;
  template_name?: string;
  version_number?: number;
  source_file_ids?: string[];
  storage_path?: string | null;
  ops?: {
    rootId: string;
    commentCount: number;
    latestCommentAt: string | null;
    versionCount: number;
    latestVersionNumber: number;
    latestVersionAt: string | null;
    shareLinkCount: number;
    activeShareCount: number;
    latestShareAt: string | null;
    totalShareViews: number;
    internalShareCount: number;
    internalShares: Array<{
      id: string;
      targetType: 'user' | 'department';
      targetName: string;
      targetMeta: string | null;
      createdAt: string;
    }>;
    shareLinks: Array<{
      id: string;
      token: string;
      createdAt: string;
      expiresAt: string | null;
      viewCount: number;
      hasPassword: boolean;
      isActive: boolean;
    }>;
    relatedDocs: Array<{
      id: string;
      title: string;
      createdAt: string;
      status: string;
      versionNumber: number;
      relationLabel: string;
    }>;
    originDocument: {
      id: string;
      title: string;
      createdAt: string;
      status: string;
      versionNumber: number;
      relationLabel: string;
    } | null;
    derivedDocuments: Array<{
      id: string;
      title: string;
      createdAt: string;
      status: string;
      versionNumber: number;
      relationLabel: string;
    }>;
  };
}

export function isFileBased(doc: DocData) {
  const firstLine = (doc.content ?? '').split('\n')[0];
  return firstLine.startsWith('[') && firstLine.length < 200;
}

function normalizeOrdinals(content: string) {
  return content.replace(/([^\n])\s*(첫째|둘째|셋째|넷째|다섯째|여섯째|일곱째|여덟째|아홉째|열째|마지막으로)[,，]/g, '$1\n$2,');
}

export function renderContent(content: string) {
  return normalizeOrdinals(content).split('\n').map((line, i) => {
    if (line.startsWith('### ')) return <h3 key={i} className="mt-5 mb-2 text-base font-semibold text-foreground">{line.replace('### ', '')}</h3>;
    if (line.startsWith('## ')) return <h2 key={i} className="mt-6 mb-2 text-lg font-bold text-foreground">{line.replace('## ', '')}</h2>;
    if (line.startsWith('# ')) return <h1 key={i} className="mt-6 mb-3 text-xl font-bold text-foreground">{line.replace('# ', '')}</h1>;
    if (line.startsWith('- ')) return <li key={i} className="my-0.5 ml-5 text-[14px] leading-relaxed text-foreground">{line.replace('- ', '')}</li>;
    if (line.startsWith('* ')) return <li key={i} className="my-0.5 ml-5 text-[14px] leading-relaxed text-foreground">{line.replace('* ', '')}</li>;
    if (/^\d+\.\s/.test(line)) return <li key={i} className="my-0.5 ml-5 list-decimal text-[14px] leading-relaxed text-foreground">{line.replace(/^\d+\.\s/, '')}</li>;
    if (line.trim() === '---') return <hr key={i} className="my-5 border-border" />;
    if (line.trim() === '') return <div key={i} className="h-3" />;
    return <p key={i} className="text-[14px] leading-[1.8] text-foreground">{line}</p>;
  });
}

export function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) return '아직 없음';
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatStatusLabel(status: string) {
  return ({ completed: '완료', draft: '초안', submitted: '결재중', approved: '승인됨', rejected: '반려됨' } as Record<string, string>)[status] ?? status;
}

interface HeaderProps {
  doc: DocData;
  isDraft: boolean;
  downloading: boolean;
  onOpenShare: () => void;
  onSearchRelated: () => void;
  onComplete: () => void;
  onOpenVersions: () => void;
  onCreateVersion: () => void;
  onPrint: () => void;
  onDownload: () => void;
  onEditDraft: () => void;
}

export function DocumentViewerHeader({
  doc,
  isDraft,
  downloading,
  onOpenShare,
  onSearchRelated,
  onComplete,
  onOpenVersions,
  onCreateVersion,
  onPrint,
  onDownload,
  onEditDraft,
}: HeaderProps) {
  const statusLabel = isDraft ? '초안' : '완료';
  const statusColor = isDraft ? 'text-foreground-secondary bg-surface-secondary' : 'text-success bg-success/10';
  const ops = doc.ops;

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreOpen]);

  return (
    <div className="flex shrink-0 flex-col gap-3.5 rounded-2xl border border-border bg-white px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between xl:px-6">
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <Link href="/documents" className="flex items-center gap-1.5 text-[12px] text-foreground-secondary transition-colors hover:text-foreground">
          <ArrowLeft size={14} />
          문서 목록
        </Link>
        <span className="text-border">|</span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusColor}`}>{statusLabel}</span>
        <span className="text-[11px] text-foreground-secondary">
          댓글 {ops?.commentCount ?? 0} · 공유 {ops?.activeShareCount ?? 0} · v{ops?.latestVersionNumber ?? doc.version_number ?? 1}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {isDraft && (
          <button onClick={onEditDraft} className="flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-[12px] font-medium text-white transition-colors hover:bg-primary">
            편집하기
          </button>
        )}
        {isDraft && (
          <button onClick={onComplete} className="flex items-center gap-1.5 rounded-lg border border-primary px-3.5 py-2 text-[12px] font-medium text-primary transition-colors hover:bg-primary-tint">
            <CheckCircle2 size={13} />
            완료 처리
          </button>
        )}
        <button onClick={onOpenShare} className="flex items-center gap-1.5 rounded-lg bg-primary-tint px-3.5 py-2 text-[12px] font-medium text-primary transition-colors hover:bg-primary/15">
          <Link2 size={13} />
          공유
        </button>
        <button onClick={onDownload} disabled={downloading} className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-[12px] text-foreground-secondary transition-colors hover:bg-surface-secondary disabled:opacity-50">
          {downloading ? <Spinner size="sm" /> : <Download size={13} />}
          {downloading ? '변환 중...' : '다운로드'}
        </button>
        <div ref={moreRef} className="relative">
          <button onClick={() => setMoreOpen((v) => !v)} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-[12px] text-foreground-secondary transition-colors hover:bg-surface-secondary">
            <MoreHorizontal size={15} />
          </button>
          {moreOpen && (
            <div className="absolute right-0 top-full z-20 mt-1.5 w-40 rounded-xl border border-border bg-white py-1.5 shadow-lg">
              <MoreMenuItem icon={<Printer size={13} />} label="인쇄" onClick={() => { onPrint(); setMoreOpen(false); }} />
              <MoreMenuItem icon={<Search size={13} />} label="관련 검색" onClick={() => { onSearchRelated(); setMoreOpen(false); }} />
              <MoreMenuItem icon={<GitBranch size={13} />} label="버전" onClick={() => { onOpenVersions(); setMoreOpen(false); }} />
              <MoreMenuItem icon={<GitBranch size={13} />} label="새 버전" onClick={() => { onCreateVersion(); setMoreOpen(false); }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MoreMenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 px-3.5 py-2 text-[12px] text-foreground-secondary transition-colors hover:bg-surface-secondary hover:text-foreground">
      {icon}
      {label}
    </button>
  );
}

interface FooterSectionsProps {
  doc: DocData;
  onNavigateDocument: (docId: string) => void;
  onOpenShare: () => void;
}

export function DocumentViewerFooterSections({ doc, onNavigateDocument, onOpenShare }: FooterSectionsProps) {
  const ops = doc.ops;
  const relatedDocs = ops?.relatedDocs ?? [];
  const shareLinks = ops?.shareLinks ?? [];
  const hasRelated = relatedDocs.length > 0;
  const hasShareLinks = shareLinks.length > 0;

  if (!hasRelated && !hasShareLinks) return null;

  return (
    <div className="flex flex-col gap-3">
      {hasRelated && (
        <CollapsibleSection title="관련 문서" count={relatedDocs.length}>
          <div className="flex flex-col gap-3">
            {relatedDocs.map((rd) => (
              <button key={rd.id} onClick={() => onNavigateDocument(rd.id)} className="rounded-xl border border-border bg-surface-tertiary px-4 py-3 text-left transition-colors hover:border-primary hover:bg-white">
                <div className="flex items-center justify-between gap-3">
                  <p className="line-clamp-1 text-[13px] font-semibold text-foreground">{rd.title}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-foreground-secondary">{rd.relationLabel}</span>
                </div>
                <p className="mt-2 text-[11px] text-foreground-secondary">{rd.createdAt} · v{rd.versionNumber} · {formatStatusLabel(rd.status)}</p>
              </button>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {hasShareLinks && (
        <CollapsibleSection title="공유 링크" count={shareLinks.length} action={<button onClick={onOpenShare} className="text-[11px] font-medium text-primary hover:underline">링크 생성</button>}>
          <div className="flex flex-col gap-3">
            {shareLinks.map((sl) => (
              <div key={sl.id} className="rounded-xl border border-border bg-surface-tertiary px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${sl.isActive ? 'bg-success/5 text-success' : 'bg-surface-secondary text-foreground-secondary'}`}>{sl.isActive ? '활성' : '만료'}</span>
                    {sl.hasPassword ? <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[10px] font-medium text-purple-500">비밀번호</span> : null}
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/share/${sl.token}`)} className="text-[11px] font-medium text-primary hover:underline">링크 복사</button>
                </div>
                <p className="mt-2 truncate font-mono text-[11px] text-foreground-secondary">{`${window.location.origin}/share/${sl.token}`}</p>
                <p className="mt-2 text-[11px] text-foreground-secondary">생성 {formatDateTimeLabel(sl.createdAt)} · 만료 {sl.expiresAt ? formatDateTimeLabel(sl.expiresAt) : '없음'} · 조회 {sl.viewCount}회</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

function CollapsibleSection({ title, count, action, children }: { title: string; count: number; action?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-white">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={14} className="text-foreground-secondary" /> : <ChevronRight size={14} className="text-foreground-secondary" />}
          <span className="text-[13px] font-semibold text-foreground">{title}</span>
          <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-[11px] text-foreground-secondary">{count}</span>
        </div>
        {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
      </button>
      {open && <div className="border-t border-border px-4 py-4 sm:px-5">{children}</div>}
    </div>
  );
}

interface ContentProps {
  doc: DocData;
  fileBlobUrl: string | null;
  fileBlobError: boolean;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  authorName?: string;
}

export function DocumentViewerContent({
  doc,
  fileBlobUrl,
  fileBlobError,
  iframeRef,
  contentRef,
  authorName,
}: ContentProps) {
  const fileBased = isFileBased(doc);
  const isProposal = doc.template_name === '제안서';

  if (isProposal) {
    const proposalHtml = renderProposalDocumentHtml({
      title: doc.title,
      content: doc.content ?? '',
      createdAt: doc.created_at?.split('T')[0],
    });

    return (
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-white">
        <div className="min-h-0 flex-1 p-4 sm:p-5">
          <HtmlPreviewFrame
            title={doc.title}
            html={proposalHtml}
            className="h-full min-h-[720px] w-full rounded-xl border border-border bg-white"
          />
        </div>
      </div>
    );
  }

  if (fileBased) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-white">
        <div className="min-h-0 flex-1">
          {fileBlobUrl ? (
            <iframe ref={iframeRef} src={fileBlobUrl} className="h-full w-full border-0" title={doc.title} sandbox="allow-same-origin allow-modals" />
          ) : fileBlobError ? (
            <div className="flex h-full items-center justify-center text-[14px] text-foreground-secondary">파일을 불러올 수 없습니다.</div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-white">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="mb-8 border-b border-border pb-6">
          <h1 className="mb-2 text-[26px] font-bold leading-tight text-foreground">{doc.title}</h1>
          <div className="flex flex-wrap items-center gap-2.5 text-[12px] text-foreground-secondary sm:gap-3">
            {doc.template_name ? <span>템플릿: {doc.template_name}</span> : null}
            <span>{new Date(doc.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>작성자: {authorName}</span>
          </div>
        </div>
        <div ref={contentRef} className="leading-relaxed">
          {doc.content ? renderContent(doc.content) : <p className="text-[14px] text-foreground-quaternary">문서 내용이 없습니다.</p>}
        </div>
      </div>
    </div>
  );
}
