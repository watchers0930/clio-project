'use client';

import { DocumentActionRow } from '@/components/documents/document-action-row';
import { ArrowRight } from 'lucide-react';
import type { SearchResult } from './types';
import type { ResumeCardSpacingConfig } from './search-layout-config';

/**
 * 검색 결과 중 가장 먼저 이어볼 문서/파일 1건과 후속 액션을 보여주는 카드.
 */
export function WorkflowResumeCard({
  spacing,
  eyebrow,
  title,
  description,
  result,
  emptyLabel,
  primaryActionLabel,
  secondaryActionLabel,
  tertiaryActionLabel,
  onOpenResult,
  onSecondaryAction,
  onTertiaryAction,
  onShare,
}: {
  spacing: ResumeCardSpacingConfig;
  eyebrow: string;
  title: string;
  description: string;
  result: SearchResult | null;
  emptyLabel: string;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  tertiaryActionLabel: string;
  onOpenResult: (result: SearchResult) => void;
  onSecondaryAction: (result: SearchResult) => void;
  onTertiaryAction: (result: SearchResult) => void;
  onShare: (result: SearchResult) => void;
}) {
  return (
    <div className="relative rounded-2xl border border-border bg-primary-tint p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-secondary">{eyebrow}</p>
      <p className="mt-2 text-[15px] font-semibold text-foreground">{title}</p>
      <p className="text-[12px] leading-5 text-foreground-secondary" style={{ marginTop: spacing.descriptionMarginTop, marginBottom: spacing.descriptionMarginBottom }}>{description}</p>

      {result ? (
        <div className="mt-4 rounded-2xl border border-border-tint bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-foreground">{result.name}</p>
              <p className="mt-1 text-[12px] text-foreground-secondary">{result.fileType} · {result.department} · {result.date}</p>
              {result.relationLabel ? <p className="mt-2 text-[11px] text-primary">{result.relationLabel}{result.originDocumentTitle ? ` · 기준 문서 ${result.originDocumentTitle}` : ''}</p> : null}
            </div>
            <span className="rounded-full bg-primary-tint px-2.5 py-1 text-[11px] font-semibold text-primary">{result.relevance}%</span>
          </div>
          <p className="line-clamp-2 text-[12px] leading-5 text-foreground-secondary" style={{ marginTop: spacing.excerptMarginTop }}>{result.excerpt}</p>
          <div aria-hidden="true" style={{ height: 10 }} />
          <div style={{ marginTop: spacing.actionsMarginTop }}>
            <DocumentActionRow
              items={[
                {
                  label: primaryActionLabel,
                  onClick: () => onOpenResult(result),
                  variant: 'primary',
                  trailing: <ArrowRight size={14} />,
                },
                {
                  label: secondaryActionLabel,
                  onClick: () => onSecondaryAction(result),
                  variant: 'secondary',
                },
                {
                  label: '공유',
                  onClick: () => onShare(result),
                  variant: 'share',
                },
                {
                  label: tertiaryActionLabel,
                  onClick: () => onTertiaryAction(result),
                  variant: 'secondary',
                },
              ]}
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border-tint bg-white px-4 py-5 text-[12px] leading-5 text-foreground-secondary">{emptyLabel}</div>
      )}
    </div>
  );
}
