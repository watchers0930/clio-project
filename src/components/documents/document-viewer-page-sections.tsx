'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Download, GitBranch, Link2, Printer, Search } from 'lucide-react';
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

  return (
    <div className="flex shrink-0 flex-col gap-3.5 rounded-2xl border border-border bg-white px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <Link href="/documents" className="flex items-center gap-1.5 text-[12px] text-foreground-secondary transition-colors hover:text-foreground">
          <ArrowLeft size={14} />
          문서 목록
        </Link>
        <span className="text-border">|</span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusColor}`}>{statusLabel}</span>
        {(doc.version_number ?? 1) > 1 && (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
            v{doc.version_number}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <HeaderActionButton onClick={onOpenShare} icon={<Link2 size={13} />} label="공유" />
        <HeaderActionButton onClick={onSearchRelated} icon={<Search size={13} />} label="관련 검색" />
        {isDraft && (
          <button onClick={onComplete} className="flex items-center gap-1.5 rounded-lg border border-primary px-3.5 py-2 text-[12px] font-medium text-primary transition-colors hover:bg-primary-tint">
            <CheckCircle2 size={13} />
            완료 처리
          </button>
        )}
        <HeaderActionButton onClick={onOpenVersions} icon={<GitBranch size={13} />} label="버전" />
        <button onClick={onCreateVersion} className="flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/5 px-3.5 py-2 text-[12px] font-medium text-success transition-colors hover:bg-success/5">
          <GitBranch size={13} />
          새 버전
        </button>
        <HeaderActionButton onClick={onPrint} icon={<Printer size={13} />} label="인쇄" />
        <button onClick={onDownload} disabled={downloading} className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-[12px] text-foreground-secondary transition-colors hover:bg-surface-secondary disabled:opacity-50">
          {downloading ? <Spinner size="sm" /> : <Download size={13} />}
          {downloading ? '변환 중...' : '다운로드'}
        </button>
        {isDraft && (
          <button onClick={onEditDraft} className="flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-[12px] font-medium text-white transition-colors hover:bg-primary">
            편집하기
          </button>
        )}
      </div>
    </div>
  );
}

function HeaderActionButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-[12px] text-foreground-secondary transition-colors hover:bg-surface-secondary">
      {icon}
      {label}
    </button>
  );
}

export function DocumentViewerOverviewSection({
  doc,
  isDraft,
  onNavigateDocument,
}: {
  doc: DocData;
  isDraft: boolean;
  onNavigateDocument: (docId: string) => void;
}) {
  const ops = doc.ops;
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-[20px]">
      <div className="rounded-2xl border border-border bg-white px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-secondary">Ops Status</p>
            <p className="mt-[10px] text-[14px] font-semibold text-foreground">공유, 코멘트, 버전, 재활용 흐름의 현재 상태입니다.</p>
          </div>
          <div className="rounded-full bg-surface-secondary px-3 py-1.5 text-[11px] text-foreground-secondary">소스 {doc.source_file_ids?.length ?? 0}개</div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4 lg:mt-6 lg:gap-[20px]">
          <OverviewCard tone="blue" title="코멘트" value={`${ops?.commentCount ?? 0}`} description={`마지막 의견 ${formatDateTimeLabel(ops?.latestCommentAt)}`} />
          <OverviewCard tone="purple" title="공유 링크" value={`${ops?.activeShareCount ?? 0} 활성`} description={`전체 ${ops?.shareLinkCount ?? 0}개 · 조회 ${ops?.totalShareViews ?? 0}회`} subDescription={`내부 공유 ${ops?.internalShareCount ?? 0}건`} />
          <OverviewCard tone="green" title="버전" value={`${ops?.latestVersionNumber ?? doc.version_number ?? 1}`} description={`누적 ${ops?.versionCount ?? 1}개 버전이 연결되어 있습니다.`} />
          <OverviewCard tone="amber" title="후속 작업" value={isDraft ? '검토 공유와 댓글 반영이 우선입니다.' : '공유 확장과 재활용 문서 작성이 우선입니다.'} description={isDraft ? '공유 링크를 만들고 검토 코멘트를 수집한 뒤 버전으로 남기세요.' : '기준 문서로 유지하면서 검색과 후속 생성 흐름에 연결하세요.'} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-secondary">Related Docs</p>
            <p className="mt-[10px] text-[14px] font-semibold text-foreground">같이 열어볼 문서</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-4">
          {(ops?.relatedDocs ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-tertiary px-4 py-5 text-[12px] leading-5 text-foreground-secondary">
              같은 템플릿이나 소스를 공유하는 문서를 아직 찾지 못했습니다. 검색으로 유사 문서를 직접 이어서 확인하세요.
            </div>
          ) : (
            (ops?.relatedDocs ?? []).map((relatedDoc) => (
              <button key={relatedDoc.id} onClick={() => onNavigateDocument(relatedDoc.id)} className="rounded-xl border border-border bg-surface-tertiary px-4 py-3 text-left transition-colors hover:border-primary hover:bg-white">
                <div className="flex items-center justify-between gap-3">
                  <p className="line-clamp-1 text-[13px] font-semibold text-foreground">{relatedDoc.title}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-foreground-secondary">{relatedDoc.relationLabel}</span>
                </div>
                <p className="mt-2 text-[11px] text-foreground-secondary">{relatedDoc.createdAt} · v{relatedDoc.versionNumber} · {formatStatusLabel(relatedDoc.status)}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function OverviewCard({
  tone,
  title,
  value,
  description,
  subDescription,
}: {
  tone: 'blue' | 'purple' | 'green' | 'amber';
  title: string;
  value: string;
  description: string;
  subDescription?: string;
}) {
  const toneMap = {
    blue: 'border-border-tint bg-primary-tint text-primary',
    purple: 'border-purple-200 bg-purple-50 text-purple-500',
    green: 'border-success/30 bg-success/5 text-success',
    amber: 'border-warning/30 bg-warning/5 text-warning',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneMap[tone]}`}>
      <p className="text-[11px] font-semibold">{title}</p>
      <p className="mt-[10px] text-[13px] font-semibold text-foreground sm:text-[22px]">{value}</p>
      <p className="mt-[10px] text-[12px] leading-5 text-foreground-secondary">{description}</p>
      {subDescription ? <p className="mt-1 text-[11px] text-foreground-secondary">{subDescription}</p> : null}
    </div>
  );
}

interface OpsSectionsProps {
  doc: DocData;
  onNavigateDocument: (docId: string) => void;
  onOpenShare: () => void;
}

export function DocumentViewerOpsSections({ doc, onNavigateDocument, onOpenShare }: OpsSectionsProps) {
  const ops = doc.ops;
  const originDocument = ops?.originDocument ?? null;
  const derivedDocuments = ops?.derivedDocuments ?? [];

  return (
    <>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-[20px]">
        <div className="rounded-2xl border border-border bg-white px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-secondary">Document Relation</p>
            <p className="mt-[10px] text-[14px] font-semibold text-foreground">기준 문서와 후속 문서</p>
          </div>
          <div className="mt-6 flex flex-col gap-4">
            {originDocument ? (
              <button onClick={() => onNavigateDocument(originDocument.id)} className="rounded-xl border border-border-tint bg-primary-tint px-4 py-3 text-left transition-colors hover:border-primary">
                <p className="text-[11px] font-semibold text-primary">이 문서의 기준 문서</p>
                <p className="mt-2 text-[13px] font-semibold text-foreground">{originDocument.title}</p>
                <p className="mt-2 text-[11px] text-foreground-secondary">{originDocument.relationLabel} · {originDocument.createdAt} · v{originDocument.versionNumber}</p>
              </button>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-surface-tertiary px-4 py-4 text-[12px] leading-5 text-foreground-secondary">이 문서는 다른 기준 문서와 연결되지 않은 독립 문서입니다.</div>
            )}

            {derivedDocuments.length > 0 ? (
              <div className="rounded-xl border border-border bg-surface-tertiary px-4 py-3">
                <p className="text-[11px] font-semibold text-foreground-secondary">이 문서를 기반으로 만들어진 후속 문서</p>
                <div className="mt-4 flex flex-col gap-3">
                  {derivedDocuments.map((relatedDoc) => (
                    <button key={relatedDoc.id} onClick={() => onNavigateDocument(relatedDoc.id)} className="rounded-xl border border-white bg-white px-3 py-3 text-left transition-colors hover:border-primary">
                      <div className="flex items-center justify-between gap-3">
                        <p className="line-clamp-1 text-[13px] font-semibold text-foreground">{relatedDoc.title}</p>
                        <span className="rounded-full bg-primary-tint px-2 py-1 text-[10px] font-medium text-primary">{relatedDoc.relationLabel}</span>
                      </div>
                      <p className="mt-2 text-[11px] text-foreground-secondary">{relatedDoc.createdAt} · v{relatedDoc.versionNumber} · {formatStatusLabel(relatedDoc.status)}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-secondary">Share Links</p>
              <p className="mt-[10px] text-[14px] font-semibold text-foreground">외부 공유 링크 운영</p>
            </div>
            <button onClick={onOpenShare} className="rounded-lg border border-border-tint bg-white px-3.5 py-2.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary-tint">링크 생성</button>
          </div>
          <div className="mt-6 flex flex-col gap-4">
            {(ops?.shareLinks ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface-tertiary px-4 py-5 text-[12px] leading-5 text-foreground-secondary">아직 생성된 공유 링크가 없습니다. 검토 요청이나 외부 전달이 필요하면 링크를 먼저 만드세요.</div>
            ) : (
              (ops?.shareLinks ?? []).map((shareLink) => (
                <div key={shareLink.id} className="rounded-xl border border-border bg-surface-tertiary px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${shareLink.isActive ? 'bg-success/5 text-success' : 'bg-surface-secondary text-foreground-secondary'}`}>{shareLink.isActive ? '활성' : '만료'}</span>
                      {shareLink.hasPassword ? <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[10px] font-medium text-purple-500">비밀번호</span> : null}
                    </div>
                    <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/share/${shareLink.token}`)} className="text-[11px] font-medium text-primary hover:underline">링크 복사</button>
                  </div>
                  <p className="mt-2 truncate font-mono text-[11px] text-foreground-secondary">{`${window.location.origin}/share/${shareLink.token}`}</p>
                  <p className="mt-2 text-[11px] text-foreground-secondary">생성 {formatDateTimeLabel(shareLink.createdAt)} · 만료 {shareLink.expiresAt ? formatDateTimeLabel(shareLink.expiresAt) : '없음'} · 조회 {shareLink.viewCount}회</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-secondary">Activity Timeline</p>
            <p className="mt-[10px] text-[14px] font-semibold text-foreground">최근 운영 이벤트</p>
          </div>
          <div className="mt-6 flex flex-col gap-5">
            {[
              {
                label: '최근 공유',
                value: formatDateTimeLabel(ops?.latestShareAt),
                description: (ops?.activeShareCount ?? 0) > 0 ? `활성 링크 ${ops?.activeShareCount ?? 0}개가 유지되고 있습니다.` : '아직 활성 공유 링크가 없습니다.',
              },
              {
                label: '최근 코멘트',
                value: formatDateTimeLabel(ops?.latestCommentAt),
                description: (ops?.commentCount ?? 0) > 0 ? `누적 ${ops?.commentCount ?? 0}개 코멘트가 문서에 연결되어 있습니다.` : '아직 코멘트가 등록되지 않았습니다.',
              },
              {
                label: '최근 버전 갱신',
                value: formatDateTimeLabel(ops?.latestVersionAt),
                description: `현재 v${ops?.latestVersionNumber ?? doc.version_number ?? 1} / 총 ${ops?.versionCount ?? 1}개 버전입니다.`,
              },
            ].map((item, index, array) => (
              <div key={item.label} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  {index < array.length - 1 ? <div className="mt-1 h-full w-px bg-border" /> : null}
                </div>
                <div className="pb-2">
                  <p className="text-[12px] font-semibold text-foreground">{item.label}</p>
                  <p className="mt-1 text-[12px] text-primary">{item.value}</p>
                  <p className="mt-1 text-[12px] leading-5 text-foreground-secondary">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-secondary">Internal Shares</p>
            <p className="mt-[10px] text-[14px] font-semibold text-foreground">부서/사용자 공유 대상</p>
          </div>
          <button onClick={onOpenShare} className="rounded-lg border border-purple-200 bg-white px-3.5 py-2.5 text-[12px] font-medium text-purple-500 transition-colors hover:bg-purple-50">내부 공유 관리</button>
        </div>
        <div className="mt-6 flex flex-col gap-4">
          {(ops?.internalShares ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-tertiary px-5 py-6 text-[12px] leading-5 text-foreground-secondary">아직 사용자나 부서에 직접 공유된 대상이 없습니다. 내부 공유가 필요하면 공유 모달에서 대상을 추가하세요.</div>
          ) : (
            (ops?.internalShares ?? []).map((share) => (
              <div key={share.id} className="rounded-xl border border-border bg-surface-tertiary px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${share.targetType === 'user' ? 'bg-purple-50 text-purple-500' : 'bg-primary-tint text-primary'}`}>{share.targetType === 'user' ? '사용자' : '부서'}</span>
                    <p className="text-[13px] font-semibold text-foreground">{share.targetName}</p>
                  </div>
                  <span className="text-[11px] text-foreground-secondary">{formatDateTimeLabel(share.createdAt)}</span>
                </div>
                {share.targetMeta ? <p className="mt-2 text-[11px] text-foreground-secondary">{share.targetMeta}</p> : null}
              </div>
            ))
          )}
        </div>
      </section>
    </>
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
