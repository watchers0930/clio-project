'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  DocumentItem as Document,
  SourceFile,
  TemplateItem as Template,
  TemplateFile,
} from '@/components/documents/page-types';
import { TEMPLATE_DISPLAY_ORDER } from '@/components/documents/document-page-constants';

/** 문서 화면의 서버 데이터(문서·템플릿·원본 파일·참고 문서) 상태와 로더, 최초 로드 effect. */
export function useDocumentsData() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [referenceDocuments, setReferenceDocuments] = useState<Document[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);

  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents ?? []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        const templateData = data.data ?? data.templates ?? [];
        // 새 문서 생성에서 노출할 템플릿 (DB 데이터는 보존)
        const ALLOWED_TEMPLATES = ['재직증명서', '회의록', '휴가원', '품의서', '표준근로계약서', '주간업무'];
        const mapped = templateData
          .filter((template: Record<string, unknown>) => ALLOWED_TEMPLATES.includes(template.name as string))
          .map((template: Record<string, unknown>) => ({
            id: template.id as string,
            name: template.name as string,
            description: template.description as string,
            templateMode: (template.templateMode as Template['templateMode']) ?? 'html-template',
            templateHtml: (template.templateHtml as string | undefined) ?? '',
            templateFile: (template.templateFile as TemplateFile | null) ?? null,
            templateFields: (template.templateFields as Template['templateFields']) ?? [],
            templateSections: (template.templateSections as Template['templateSections']) ?? [],
          }));
        mapped.sort((a: { name: string }, b: { name: string }) => {
          const ai = TEMPLATE_DISPLAY_ORDER.indexOf(a.name);
          const bi = TEMPLATE_DISPLAY_ORDER.indexOf(b.name);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
        setTemplates(mapped);
      }
    } catch {
    }
  }, []);

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files?limit=500');
      if (res.ok) {
        const data = await res.json();
        const fileData = data.data ?? data.files ?? [];
        setSourceFiles(fileData.filter((file: Record<string, unknown>) => file.status !== '오류').map((file: Record<string, unknown>) => ({
          id: file.id as string,
          name: (file.name as string) ?? '',
          type: (file.type as string) ?? 'FILE',
          department: (file.department as string) ?? '미분류',
          size: (file.size as string) ?? '',
          uploadDate: (file.uploadDate as string) ?? '',
          status: (file.status as string) ?? '',
        })));
      }
    } catch {
    }
  }, []);

  const loadReferenceDocuments = useCallback(async (templateId: string) => {
    try {
      const res = await fetch(`/api/documents?templateId=${templateId}&status=completed&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setReferenceDocuments(data.documents ?? []);
      }
    } catch {
      setReferenceDocuments([]);
    }
  }, []);

  useEffect(() => {
    loadDocs();
    loadTemplates();
    loadFiles();
  }, [loadDocs, loadTemplates, loadFiles]);

  return {
    docs, setDocs, loading, templates, sourceFiles, referenceDocuments, setReferenceDocuments,
    loadDocs, loadFiles, loadReferenceDocuments,
  };
}
