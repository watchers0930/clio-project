'use client';

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { isContractTemplate } from '@/lib/contract-fields';
import type { DocumentItem as Document, TemplateItem as Template } from '@/components/documents/page-types';
import { getAllowedOutputFormats, interpolateFieldDefaultValue, type AllowedOutputFormat } from '@/components/documents/document-output-formats';

interface UseTemplateFieldDefaultsParams {
  selectedTemplate: string | null;
  templates: Template[];
  outputFormat: string;
  documentInputs: Record<string, string>;
  setDocumentInputs: Dispatch<SetStateAction<Record<string, string>>>;
  setOutputFormat: Dispatch<SetStateAction<string>>;
  loadReferenceDocuments: (templateId: string) => Promise<void>;
  setReferenceDocuments: Dispatch<SetStateAction<Document[]>>;
  setReferenceDocId: Dispatch<SetStateAction<string | null>>;
}

export function useTemplateFieldDefaults({
  selectedTemplate,
  templates,
  outputFormat,
  documentInputs,
  setDocumentInputs,
  setOutputFormat,
  loadReferenceDocuments,
  setReferenceDocuments,
  setReferenceDocId,
}: UseTemplateFieldDefaultsParams) {
  const previousSelectedTemplateRef = useRef<string | null>(null);
  const autoDefaultInputValuesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const selectedTemplateItem = templates.find((template) => template.id === selectedTemplate);
    const isContract = selectedTemplateItem ? isContractTemplate(selectedTemplateItem.name) : false;
    const allowedFormats = getAllowedOutputFormats(selectedTemplateItem?.templateFile, isContract, selectedTemplateItem?.templateMode, selectedTemplateItem?.name);

    if (!allowedFormats.includes(outputFormat as AllowedOutputFormat)) {
      setOutputFormat(allowedFormats[0]);
    }

    // 제안서 템플릿 선택 시 참조 제안서 목록 로드
    if (selectedTemplate && selectedTemplateItem?.name === '제안서') {
      loadReferenceDocuments(selectedTemplate);
    } else {
      setReferenceDocuments([]);
      setReferenceDocId(null);
    }

    if (previousSelectedTemplateRef.current !== selectedTemplate) {
      previousSelectedTemplateRef.current = selectedTemplate;
      const fieldsWithDefaults = selectedTemplateItem?.templateFields?.filter((field) => field.defaultValue) ?? [];
      autoDefaultInputValuesRef.current = {};
      if (fieldsWithDefaults.length > 0) {
        setDocumentInputs((prev) => {
          const next = { ...prev };
          for (const field of fieldsWithDefaults) {
            if (!next[field.key]?.trim()) {
              const defaultValue = interpolateFieldDefaultValue(field.defaultValue ?? '', next, selectedTemplateItem?.templateFields ?? []);
              next[field.key] = defaultValue;
              autoDefaultInputValuesRef.current[field.key] = defaultValue;
            }
          }
          return next;
        });
      }
    }
  }, [selectedTemplate, templates, outputFormat, loadReferenceDocuments]);

  useEffect(() => {
    const selectedTemplateItem = templates.find((template) => template.id === selectedTemplate);
    const fieldsWithDefaults = selectedTemplateItem?.templateFields?.filter((field) => field.defaultValue) ?? [];
    if (fieldsWithDefaults.length === 0) return;

    setDocumentInputs((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const field of fieldsWithDefaults) {
        const previousAutoValue = autoDefaultInputValuesRef.current[field.key];
        const hasExistingValue = Object.prototype.hasOwnProperty.call(next, field.key);
        if (hasExistingValue && next[field.key] !== previousAutoValue) continue;
        const defaultValue = interpolateFieldDefaultValue(field.defaultValue ?? '', next, selectedTemplateItem?.templateFields ?? []);
        if (next[field.key] !== defaultValue) {
          next[field.key] = defaultValue;
          changed = true;
        }
        autoDefaultInputValuesRef.current[field.key] = defaultValue;
      }
      return changed ? next : prev;
    });
  }, [documentInputs, selectedTemplate, templates]);

  const resetDefaults = () => {
    autoDefaultInputValuesRef.current = {};
  };

  return {
    resetDefaults,
  };
}
