'use client';

import type { DocumentItem as Document } from '@/components/documents/page-types';
import type { useToast } from '@/components/ui/toast';

type GeneratedDownloadMeta = {
  fileName: string | null;
  extension: string | null;
  mimeType: string | null;
};

interface UseGeneratedFileDownloadParams {
  generatedDoc: Document | null;
  generatedDownloadUrl: string | null;
  generatedDownloadMeta: GeneratedDownloadMeta;
  outputFormat: string;
  toast: ReturnType<typeof useToast>;
}

export function useGeneratedFileDownload({
  generatedDoc,
  generatedDownloadUrl,
  generatedDownloadMeta,
  outputFormat,
  toast,
}: UseGeneratedFileDownloadParams) {
  const handleDownloadGeneratedFile = async () => {
    if (!generatedDoc) return;
    const opensPrintWindow = generatedDownloadMeta.extension === 'html' || generatedDownloadMeta.mimeType?.startsWith('text/html');
    try {
      if (opensPrintWindow) {
        // 팝업은 사용자 클릭 제스처 내에서 먼저 열어야 차단되지 않는다 (await 전에 open).
        const printWindow = window.open('', '_blank');
        if (!printWindow) { toast.error('팝업이 차단되었습니다. 팝업을 허용해 주세요.'); return; }
        printWindow.document.write('<!doctype html><meta charset="utf-8"><title>문서 여는 중…</title><body style="font-family:sans-serif;padding:24px;color:#555">문서를 불러오는 중입니다…</body>');
        try {
          const res = generatedDoc.id
            ? await fetch(`/api/documents/${generatedDoc.id}/download?format=pdf`)
            : generatedDownloadUrl
            ? await fetch(generatedDownloadUrl)
            : null;
          if (!res?.ok) throw new Error('다운로드 실패');
          const contentType = res.headers.get('Content-Type') ?? '';
          if (contentType.includes('application/pdf')) {
            // 서버가 실제 PDF 바이너리를 반환(v7.68.0~): blob URL로 열어 브라우저 PDF 뷰어로 표시
            const blobUrl = URL.createObjectURL(await res.blob());
            printWindow.location.href = blobUrl;
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
          } else {
            // 양식 HTML(휴가원·재직증명서 등)은 기존처럼 인쇄 창으로 렌더
            const html = await res.text();
            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.onload = () => {
              setTimeout(() => printWindow.print(), 300);
            };
          }
        } catch (e) {
          printWindow.close();
          throw e;
        }
        return;
      }

      const triggerBrowserDownload = (blob: Blob, fileName: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      if (generatedDownloadUrl) {
        const res = await fetch(generatedDownloadUrl);
        if (!res.ok) throw new Error('다운로드 실패');
        const blob = await res.blob();
        const extension = generatedDownloadMeta.extension ?? outputFormat;
        triggerBrowserDownload(blob, generatedDownloadMeta.fileName ?? `${generatedDoc.title}.${extension}`);
      } else {
        // signed URL이 없는 경우 document ID로 직접 다운로드
        const res = await fetch(`/api/documents/${generatedDoc.id}/download?format=${outputFormat}`);
        if (!res.ok) throw new Error('다운로드 실패');
        const blob = await res.blob();
        triggerBrowserDownload(blob, generatedDownloadMeta.fileName ?? `${generatedDoc.title}.${outputFormat}`);
      }
    } catch {
      toast.error('다운로드에 실패했습니다.');
    }
  };

  return {
    handleDownloadGeneratedFile,
  };
}
