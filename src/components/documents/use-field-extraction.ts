'use client';

import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';
import { isWorklogTemplateName, WORKLOG_FIELDS } from '@/lib/templates/worklog';
import type { TemplateFieldDefinition } from '@/lib/templates/template-schema';
import type { TemplateItem as Template } from '@/components/documents/page-types';
import type { useToast } from '@/components/ui/toast';

interface UseFieldExtractionParams {
  selectedFiles: Set<string>;
  templates: Template[];
  selectedTemplate: string | null;
  setDocumentInputs: Dispatch<SetStateAction<Record<string, string>>>;
  toast: ReturnType<typeof useToast>;
}

export function useFieldExtraction({
  selectedFiles,
  templates,
  selectedTemplate,
  setDocumentInputs,
  toast,
}: UseFieldExtractionParams) {
  const [extractingFields, setExtractingFields] = useState(false);
  const [extractedFieldKeys, setExtractedFieldKeys] = useState<Set<string>>(new Set());

  const extractFieldsFromSources = useCallback(async () => {
    if (selectedFiles.size === 0) return;
    const selectedTemplateItem = templates.find((t) => t.id === selectedTemplate);
    if (!selectedTemplateItem) return;
    const resolvedFields = (selectedTemplateItem.templateFields
      ?? (isWorklogTemplateName(selectedTemplateItem.name) ? [...WORKLOG_FIELDS] : [
        { key: 'report_title', label: '문서 제목', type: 'text' as const, required: true, placeholder: '예: 2026년 2분기 사업 보고서' },
        { key: 'subtitle', label: '소제목', type: 'text' as const, placeholder: '예: 경영회의 보고용' },
      ])) as TemplateFieldDefinition[];

    const AUTO_INPUT_KEYS = new Set(['author', 'author_department', 'author_position', 'report_date', 'report_time']);
    const targetFields = resolvedFields.filter((f) => !f.autoFill && !f.aiAssist && !AUTO_INPUT_KEYS.has(f.key));
    if (targetFields.length === 0) return;

    setExtractingFields(true);
    try {
      const res = await fetch('/api/generate/extract-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFileIds: Array.from(selectedFiles),
          fields: targetFields.map((f) => ({ key: f.key, label: f.label, placeholder: f.placeholder })),
          templateName: selectedTemplateItem.name,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        console.error('[extract-fields] API error:', res.status, errData);
        toast.error(`참조파일 분석 실패: ${errData?.error ?? res.statusText}`);
        return;
      }
      const data = await res.json();
      if (data.reason === 'no_text') {
        toast.info('선택한 참조파일에서 텍스트를 추출할 수 없습니다.');
        return;
      }
      const extracted = (data.extractedInputs ?? {}) as Record<string, string>;
      const filledCount = Object.values(extracted).filter((v) => v).length;
      const newKeys = new Set<string>();
      setDocumentInputs((prev) => {
        const next = { ...prev };
        for (const [key, value] of Object.entries(extracted)) {
          if (value && !prev[key]?.trim()) {
            next[key] = value;
            newKeys.add(key);
          }
        }
        return next;
      });
      setExtractedFieldKeys(newKeys);
      if (filledCount > 0) {
        toast.success(`참조파일에서 ${filledCount}개 항목을 자동 입력했습니다.`);
      } else {
        toast.info('참조파일에서 자동 입력할 항목을 찾지 못했습니다.');
      }
    } catch (err) {
      console.error('[extract-fields] fetch error:', err);
      toast.error('참조파일 분석 중 오류가 발생했습니다.');
    } finally {
      setExtractingFields(false);
    }
  }, [selectedFiles, templates, selectedTemplate, toast]);

  return {
    extractingFields,
    extractedFieldKeys,
    setExtractedFieldKeys,
    extractFieldsFromSources,
  };
}
