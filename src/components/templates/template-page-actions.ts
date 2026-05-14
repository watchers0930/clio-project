import type { AutoPlaceholder } from './types';
import type { useToast } from '@/components/ui/toast';

const MAX_TEMPLATE_UPLOAD_SIZE = 4.5 * 1024 * 1024;

export function getTemplateUploadError(file: File | null) {
  if (!file) return null;
  if (file.size > MAX_TEMPLATE_UPLOAD_SIZE) {
    return '표준양식 파일은 4.5MB 이하여야 합니다. 현재 업로드 경로는 Vercel 요청 한도를 받습니다.';
  }
  return null;
}

export async function readApiError(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return data?.error ?? fallback;
  } catch {
    if (response.status === 413) {
      return '표준양식 파일은 4.5MB 이하여야 합니다. 현재 업로드 경로는 Vercel 요청 한도를 받습니다.';
    }
    return `${fallback} (HTTP ${response.status})`;
  }
}

export async function analyzeAutoRegFile({
  autoRegFile,
  setAnalyzing,
  setAutoRegFileId,
  setAutoRegPreview,
  setAutoRegPreviewHtml,
  setAutoRegName,
  setDetectedPlaceholders,
  setAutoRegStep,
  toast,
}: {
  autoRegFile: File | null;
  setAnalyzing: (value: boolean) => void;
  setAutoRegFileId: (value: string | null) => void;
  setAutoRegPreview: (value: string) => void;
  setAutoRegPreviewHtml: (value: string) => void;
  setAutoRegName: (value: string) => void;
  setDetectedPlaceholders: (value: AutoPlaceholder[]) => void;
  setAutoRegStep: (value: number) => void;
  toast: ReturnType<typeof useToast>;
}) {
  if (!autoRegFile) return;
  const fileError = getTemplateUploadError(autoRegFile);
  if (fileError) {
    toast.error(fileError);
    return;
  }

  setAnalyzing(true);
  try {
    const fd = new FormData();
    fd.append('file', autoRegFile);
    const res = await fetch('/api/templates/analyze', { method: 'POST', body: fd });
    if (!res.ok) {
      toast.error(await readApiError(res, '분석 실패'));
      return;
    }

    const data = await res.json();
    if (data.success) {
      setAutoRegFileId(data.data.fileId);
      setAutoRegPreview(data.data.preview);
      setAutoRegPreviewHtml(data.data.previewHtml ?? '');
      setAutoRegName(autoRegFile.name.replace(/\.(docx|dotx|hwpx)$/i, ''));
      setDetectedPlaceholders((data.data.placeholders ?? []).map((placeholder: Omit<AutoPlaceholder, 'selected'>) => ({ ...placeholder, selected: true })));
      setAutoRegStep(2);
    } else {
      toast.error(data.error ?? '분석 실패');
    }
  } catch {
    toast.error('서버 오류');
  }
  setAnalyzing(false);
}

export async function submitAutoRegTemplate({
  autoRegName,
  autoRegDesc,
  autoRegDeptId,
  autoRegScope,
  autoRegFileId,
  detectedPlaceholders,
  setAutoRegSaving,
  setShowAutoReg,
  loadTemplates,
  toast,
}: {
  autoRegName: string;
  autoRegDesc: string;
  autoRegDeptId: string;
  autoRegScope: '전사 공용' | '부서 전용';
  autoRegFileId: string | null;
  detectedPlaceholders: AutoPlaceholder[];
  setAutoRegSaving: (value: boolean) => void;
  setShowAutoReg: (value: boolean) => void;
  loadTemplates: () => Promise<void>;
  toast: ReturnType<typeof useToast>;
}) {
  if (!autoRegName.trim()) {
    toast.error('이름을 입력해주세요.');
    return;
  }

  setAutoRegSaving(true);
  try {
    const selectedPlaceholders = detectedPlaceholders
      .filter((placeholder) => placeholder.selected)
      .map(({ key, label, type, location, context }) => ({ key, label, type, location, context }));

    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: autoRegName.trim(),
        description: autoRegDesc.trim(),
        departmentId: autoRegDeptId || null,
        scope: autoRegScope,
        content: '',
        templateFileId: autoRegFileId,
        placeholders: selectedPlaceholders,
      }),
    });
    const data = await res.json();

    if (data.template) {
      setShowAutoReg(false);
      await loadTemplates();
    } else {
      toast.error(data.error ?? '등록 실패');
    }
  } catch {
    toast.error('서버 오류');
  }
  setAutoRegSaving(false);
}
