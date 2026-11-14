import { HtmlPreviewFrame } from '@/components/documents/html-preview-frame';
import type { DocumentItem, TemplateItem } from '@/components/documents/page-types';

interface NewDocumentResultStepProps {
  generatedDoc: DocumentItem;
  outputFormat: string;
  selectedTemplateItem?: TemplateItem;
  generatedProposalHtml: string;
  generatedOutline: Record<string, unknown> | null;
  generatedDownloadUrl: string | null;
  generatedUsesPrintWindow: boolean | undefined;
  onDownloadGeneratedFile: () => void;
  onDownloadAiContext: (docId: string, lang: 'ko' | 'en') => void;
}

/**
 * 새 문서 생성 폼의 "생성 결과" step.
 * 포맷별 미리보기(본문·시트·슬라이드)와 다운로드·AI 컨텍스트 내려받기 버튼을 그린다.
 */
export function NewDocumentResultStep({
  generatedDoc,
  outputFormat,
  selectedTemplateItem,
  generatedProposalHtml,
  generatedOutline,
  generatedDownloadUrl,
  generatedUsesPrintWindow,
  onDownloadGeneratedFile,
  onDownloadAiContext,
}: NewDocumentResultStepProps) {
  return (
    <div className="flex flex-col gap-[20px]">
      <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-secondary border border-border">
        <div>
          <h4 className="font-semibold text-foreground">{outputFormat.toUpperCase()} 문서가 생성되었습니다!</h4>
          <p className="text-sm text-foreground-secondary">{generatedDoc.title}</p>
        </div>
      </div>
      {(outputFormat === 'docx' || outputFormat === 'pdf' || outputFormat === 'hwpx') && (
        <div className={`bg-surface-secondary rounded-xl p-4 ${selectedTemplateItem?.name === '제안서' ? '' : 'max-h-60 overflow-y-auto'}`}>
          {selectedTemplateItem?.name === '제안서' ? (
            <HtmlPreviewFrame
              title="generated-proposal-preview"
              html={generatedProposalHtml}
              className="h-[480px] w-full rounded-lg border border-border bg-white"
            />
          ) : (
            <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {generatedDoc.content ?? '내용 없음'}
            </div>
          )}
        </div>
      )}
      {outputFormat === 'xlsx' && generatedOutline && (generatedOutline as { sheets?: { sheetName: string; headers: string[]; rows: unknown[][] }[] }).sheets && (
        <div className="bg-surface-secondary rounded-xl p-4 max-h-60 overflow-y-auto space-y-3">
          {((generatedOutline as { sheets: { sheetName: string; headers: string[]; rows: unknown[][] }[] }).sheets).map((sheet, index) => (
            <div key={index} className="bg-white rounded-lg p-3 border border-border">
              <p className="text-sm font-medium text-foreground">{sheet.sheetName} ({sheet.rows?.length ?? 0}행)</p>
              <p className="text-xs text-foreground-secondary mt-1">컬럼: {sheet.headers?.join(', ')}</p>
            </div>
          ))}
        </div>
      )}
      {outputFormat === 'pptx' && generatedOutline && (generatedOutline as { slides?: { title: string; bullets?: string[] }[] }).slides && (
        <div className="bg-surface-secondary rounded-xl p-4 max-h-60 overflow-y-auto space-y-2">
          {((generatedOutline as { slides: { title: string; bullets?: string[] }[] }).slides).map((slide, index) => (
            <div key={index} className="bg-white rounded-lg p-3 border border-border">
              <p className="text-sm font-medium text-foreground">{index + 1}. {slide.title}</p>
              {slide.bullets && (
                <ul className="text-xs text-foreground-secondary mt-1 ml-4 list-disc">
                  {slide.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      {(generatedDownloadUrl || generatedDoc.id) && (
        <button onClick={onDownloadGeneratedFile} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors">
          {generatedUsesPrintWindow ? 'PDF 저장창 열기' : `${outputFormat.toUpperCase()} 파일 다운로드`}
        </button>
      )}
      {selectedTemplateItem?.name === '제안서' && generatedDoc.id && (
        <div className="mt-4 p-4 rounded-xl bg-success/5 border border-success/30">
          <div className="flex gap-2">
            <button onClick={() => onDownloadAiContext(generatedDoc.id, 'ko')} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-success text-success hover:bg-white transition-colors">
              국문
            </button>
            <button onClick={() => onDownloadAiContext(generatedDoc.id, 'en')} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-success text-success hover:bg-white transition-colors">
              English
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
