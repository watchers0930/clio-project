'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { isContractTemplate } from '@/lib/contract-fields';
import type { DocumentItem as Document, TemplateItem as Template } from '@/components/documents/page-types';
import type { useToast } from '@/components/ui/toast';
import { csrfFetch } from '@/hooks/csrf-client';
import { getAllowedOutputFormats, type AllowedOutputFormat } from '@/components/documents/document-output-formats';

type GeneratedDownloadMeta = {
  fileName: string | null;
  extension: string | null;
  mimeType: string | null;
};

interface UseDocumentGenerationParams {
  selectedTemplate: string | null;
  customStructure: string;
  instructions: string;
  templates: Template[];
  outputFormat: string;
  setOutputFormat: Dispatch<SetStateAction<string>>;
  selectedFiles: Set<string>;
  selectedFont: string;
  documentInputs: Record<string, string>;
  aiAssistEnabled: boolean;
  aiAssistPrompt: string;
  contractFormData: Record<string, string>;
  newVersionDocId: string | null;
  setNewVersionDocId: (id: string | null) => void;
  originDocumentId: string | null;
  originContext: string | null;
  referenceDocId: string | null;
  setDocs: Dispatch<SetStateAction<Document[]>>;
  setStep: Dispatch<SetStateAction<number>>;
  toast: ReturnType<typeof useToast>;
}

/** 새 문서 생성 요청(/api/generate)과 생성 결과(문서·다운로드 정보·개요) 상태. */
export function useDocumentGeneration({
  selectedTemplate,
  customStructure,
  instructions,
  templates,
  outputFormat,
  setOutputFormat,
  selectedFiles,
  selectedFont,
  documentInputs,
  aiAssistEnabled,
  aiAssistPrompt,
  contractFormData,
  newVersionDocId,
  setNewVersionDocId,
  originDocumentId,
  originContext,
  referenceDocId,
  setDocs,
  setStep,
  toast,
}: UseDocumentGenerationParams) {
  const [generating, setGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<Document | null>(null);
  const [generatedDownloadUrl, setGeneratedDownloadUrl] = useState<string | null>(null);
  const [generatedDownloadMeta, setGeneratedDownloadMeta] = useState<GeneratedDownloadMeta>({
    fileName: null,
    extension: null,
    mimeType: null,
  });
  const [generatedOutline, setGeneratedOutline] = useState<Record<string, unknown> | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratedDownloadUrl(null);
    setGeneratedDownloadMeta({ fileName: null, extension: null, mimeType: null });
    setGeneratedOutline(null);
    try {
      const isCustom = selectedTemplate === '__none__';
      const finalInstructions = isCustom ? `## 문서 구조:\n${customStructure.trim()}\n\n${instructions.trim() ? `## 추가 지시사항:\n${instructions.trim()}` : ''}` : instructions.trim() || undefined;
      const selectedTemplateItem = templates.find((template) => template.id === selectedTemplate);
      const isContract = selectedTemplateItem ? isContractTemplate(selectedTemplateItem.name) : false;
      const allowedFormats = getAllowedOutputFormats(selectedTemplateItem?.templateFile, isContract, selectedTemplateItem?.templateMode, selectedTemplateItem?.name);
      const actualFormat = allowedFormats.includes(outputFormat as AllowedOutputFormat) ? outputFormat : allowedFormats[0];
      if (actualFormat !== outputFormat) setOutputFormat(actualFormat);
      const res = await csrfFetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: isCustom ? undefined : selectedTemplate,
          sourceFileIds: Array.from(selectedFiles),
          instructions: finalInstructions,
          outputFormat: actualFormat,
          font: selectedFont,
          customStructure: isCustom ? customStructure.trim() : undefined,
          documentInputs,
          aiAssist: aiAssistEnabled,
          aiAssistPrompt: aiAssistPrompt.trim() || undefined,
          ...(isContract && Object.keys(contractFormData).length > 0 ? { contractFormData } : {}),
          ...(newVersionDocId ? { parentId: newVersionDocId } : {}),
          ...(originDocumentId ? { originDocumentId } : {}),
          ...(originContext ? { originContext } : {}),
          ...(referenceDocId ? { referenceDocId } : {}),
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        toast.error(errorData?.error ?? '문서 생성에 실패했습니다. 다시 시도해 주세요.');
        return;
      }
      const data = await res.json();
      const newDoc = data.document as Document | undefined;
      if (!newDoc) return;
      setGeneratedDoc(newDoc);
      setDocs((prev) => [newDoc, ...prev]);
      if (data.downloadUrl) setGeneratedDownloadUrl(data.downloadUrl);
      setGeneratedDownloadMeta({
        fileName: typeof data.downloadFileName === 'string' ? data.downloadFileName : null,
        extension: typeof data.downloadExtension === 'string' ? data.downloadExtension : null,
        mimeType: typeof data.downloadMimeType === 'string' ? data.downloadMimeType : null,
      });
      if (data.outline) setGeneratedOutline(data.outline);
      if (data.format) setOutputFormat(data.format);
      setNewVersionDocId(null);
      setStep(5);
    } catch {
      toast.error('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setGenerating(false);
    }
  };

  return {
    generating, setGenerating, generatedDoc, setGeneratedDoc,
    generatedDownloadUrl, setGeneratedDownloadUrl, generatedDownloadMeta, setGeneratedDownloadMeta,
    generatedOutline, setGeneratedOutline, handleGenerate,
  };
}
