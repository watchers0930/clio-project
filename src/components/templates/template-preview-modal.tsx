'use client';

import type { Template } from './types';
import { createTemplateBundle } from '@/lib/templates/template-schema';
import { renderTemplatePreviewHtml } from '@/lib/templates/template-preview';

export function TemplatePreviewModal({
  open,
  template,
  onClose,
  onEdit,
}: {
  open: boolean;
  template: Template | null;
  onClose: () => void;
  onEdit: (template: Template) => void;
}) {
  if (!open || !template) return null;

  const bundleBase = createTemplateBundle({
    name: template.name,
    description: template.description,
    outline: template.content,
  });
  const previewDoc = renderTemplatePreviewHtml(
    {
      ...bundleBase,
      layoutHtml: template.templateHtml || bundleBase.layoutHtml,
      fields: template.templateFields ?? bundleBase.fields,
      sections: template.templateSections ?? bundleBase.sections,
    },
    template.name,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="template-preview-title">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl mx-4 max-h-[88vh] overflow-y-auto">
        <div className="px-8 py-6 border-b border-[#e5e5e7] flex items-center justify-between">
          <div>
            <h2 id="template-preview-title" className="text-lg font-semibold text-[#1d1d1f]">{template.name}</h2>
            <p className="mt-1 text-sm text-[#6e6e73]">{template.description || '템플릿 미리보기'}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
            <CloseIcon />
          </button>
        </div>

        <div className="px-8 py-6 space-y-4">
          <div className="flex items-center gap-2 text-[11px] text-[#6e6e73]">
            <span>{template.department}</span>
            <span>{template.scope}</span>
            {template.templateFile ? <span>{template.templateFile.type}</span> : null}
            <span>{template.lastUpdated}</span>
          </div>
          <div className="rounded-2xl border border-[#e5e5e7] bg-[#f5f7fb] p-3">
            <iframe
              title={`${template.name}-preview-modal`}
              src={template.templateFile ? `/api/templates/${template.id}/preview-html` : undefined}
              srcDoc={template.templateFile ? undefined : previewDoc}
              className="h-[720px] w-full rounded-xl border border-[#dfe4ea] bg-white"
            />
          </div>
        </div>

        <div className="px-8 py-5 border-t border-[#e5e5e7] flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors">
            닫기
          </button>
          <button onClick={() => onEdit(template)} className="px-6 py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors">
            템플릿 수정
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
}
