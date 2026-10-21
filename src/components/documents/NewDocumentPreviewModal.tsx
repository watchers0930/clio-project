'use client';

import type { TemplateItem } from '@/components/documents/page-types';

interface NewDocumentPreviewModalProps {
  open: boolean;
  onClose: () => void;
  templateItem: TemplateItem;
  previewSrc?: string;
  previewDoc?: string;
}

export function NewDocumentPreviewModal({ open, onClose, templateItem, previewSrc, previewDoc }: NewDocumentPreviewModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="new-doc-template-preview-title">
      <div className="mx-4 flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 id="new-doc-template-preview-title" className="text-lg font-semibold text-foreground">{templateItem.name}</h2>
            <p className="mt-1 text-sm text-foreground-secondary">{templateItem.description || '템플릿 미리보기'}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-foreground-secondary hover:bg-surface-secondary">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="rounded-2xl border border-border bg-surface-secondary p-3">
            <iframe
              title="selected-template-preview-modal"
              src={previewSrc}
              srcDoc={previewSrc ? undefined : previewDoc}
              className="h-[720px] w-full rounded-xl border border-border bg-white"
            />
          </div>
        </div>
        <div className="flex justify-end border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-5 py-2.5 text-sm text-foreground-secondary transition-colors hover:bg-surface-secondary"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
