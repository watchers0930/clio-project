'use client';

import type { DocumentItem } from '@/components/documents/page-types';

/**
 * 문서 뷰어 하단 액션 바(상태 전환 + 저장/다운로드/검수 등).
 *
 * 단일 책임: 액션 버튼 UI와 비활성 조건만 담당한다. 저장/완료 로직·검증 판정은 상위(모달·훅)가
 * 결정해 props로 전달한다. 입력값 모드에서는 "초안 저장"을 숨겨 content 전용 저장(에디터 내부
 * 버튼)으로 통일하고, 완료/저장은 공유 검증 결과(inputValid)를 그대로 반영한다.
 */
interface DocumentViewerFooterProps {
  viewDoc: DocumentItem;
  isDraft: boolean;
  saving: boolean;
  isEdited: boolean;
  /** viewMode === 'inputs' — 입력값 편집 모드에서는 하단 "초안 저장"을 숨긴다. */
  inputsMode: boolean;
  inputValid: boolean;
  inputInvalidTitle?: string;
  downloadFormat: string;
  selectedFont: string;
  availableDownloadFormats: readonly string[];
  fontOptions: string[];
  onComplete: () => void;
  onRevertToDraft: () => void;
  onSave: () => void;
  onChangeDownloadFormat: (value: string) => void;
  onChangeSelectedFont: (value: string) => void;
  onOpenContractRisk: (doc: DocumentItem) => void;
  onDownload: (doc: DocumentItem) => void;
  onOpenQualityCheck: (docId: string) => void;
  onOpenTodoExtract: () => void;
}

export function DocumentViewerFooter({
  viewDoc,
  isDraft,
  saving,
  isEdited,
  inputsMode,
  inputValid,
  inputInvalidTitle,
  downloadFormat,
  selectedFont,
  availableDownloadFormats,
  fontOptions,
  onComplete,
  onRevertToDraft,
  onSave,
  onChangeDownloadFormat,
  onChangeSelectedFont,
  onOpenContractRisk,
  onDownload,
  onOpenQualityCheck,
  onOpenTodoExtract,
}: DocumentViewerFooterProps) {
  const isMeeting = viewDoc.title.includes('회의록') || viewDoc.title.includes('회의');
  return (
    <div className="flex shrink-0 flex-col gap-3 border-t border-border px-4 py-4 min-w-0 sm:px-6 sm:py-4">
      <div className="flex flex-wrap gap-2.5">
        {isDraft && (
          <button
            onClick={onComplete}
            disabled={saving || !inputValid}
            title={inputInvalidTitle}
            className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {saving ? '처리 중...' : '완료 문서로 전환'}
          </button>
        )}
        {viewDoc.status === '완료' && (
          <button onClick={onRevertToDraft} disabled={saving} className="px-4 py-2.5 rounded-xl border border-border text-sm text-foreground-secondary hover:bg-surface-secondary disabled:opacity-50 transition-colors whitespace-nowrap">
            초안으로 되돌리기
          </button>
        )}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        {isDraft && !inputsMode && (
          <button
            onClick={onSave}
            disabled={saving || !isEdited || !inputValid}
            title={inputInvalidTitle}
            className="px-4 py-2.5 rounded-xl border border-primary text-sm text-primary font-medium hover:bg-surface-secondary disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {saving ? '저장 중...' : '초안 저장'}
          </button>
        )}
        <select value={downloadFormat} onChange={(e) => onChangeDownloadFormat(e.target.value)} className="px-3 py-2.5 rounded-xl border border-border text-sm text-foreground-secondary bg-white">
          {availableDownloadFormats.map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}
        </select>
        <select value={selectedFont} onChange={(e) => onChangeSelectedFont(e.target.value)} className="px-3 py-2.5 rounded-xl border border-border text-sm text-foreground-secondary bg-white max-w-[120px]">
          {fontOptions.map((font) => <option key={font} value={font}>{font}</option>)}
        </select>
        <button onClick={() => onOpenContractRisk(viewDoc)} className="px-4 py-2.5 rounded-xl border border-danger/30 text-sm text-danger font-medium hover:bg-danger/5 transition-colors whitespace-nowrap">
          계약 리스크 검토
        </button>
        <button onClick={() => onDownload(viewDoc)} className="px-4 py-2.5 rounded-xl border border-border text-sm text-foreground-secondary hover:bg-surface-secondary transition-colors whitespace-nowrap">
          다운로드
        </button>
        <button onClick={() => onOpenQualityCheck(viewDoc.id)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary text-sm text-primary font-medium hover:bg-primary-tint transition-colors whitespace-nowrap">
          AI 검수 시작
        </button>
        {isMeeting && (
          <button onClick={onOpenTodoExtract} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-purple-500 text-sm text-purple-500 font-medium hover:bg-purple-50 transition-colors whitespace-nowrap">
            할일 추출
          </button>
        )}
      </div>
    </div>
  );
}
