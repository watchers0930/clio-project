'use client';

import { useId } from 'react';

export type DocumentViewMode = 'preview' | 'edit' | 'inputs';

interface ViewModeToggleProps {
  viewMode: DocumentViewMode;
  onChange: (mode: DocumentViewMode) => void;
  /** 입력값 편집 버튼 노출 여부(빌트인 양식 등). 없으면 레이아웃 보기·원문 편집만 표시 */
  inputEdit?: { available: boolean; reason?: string };
}

const baseClass = 'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors';
const activeClass = 'bg-foreground text-white';
const idleClass = 'border border-border text-foreground-secondary hover:bg-surface-secondary';

/** 문서 뷰어 보기 모드 토글 — 선택 상태(aria-pressed)와 비활성 사유를 보조기술에도 전달한다. */
export function ViewModeToggle({ viewMode, onChange, inputEdit }: ViewModeToggleProps) {
  const reasonId = useId();
  const inputDisabled = !!inputEdit && !inputEdit.available;

  const modeButton = (mode: DocumentViewMode, label: string) => (
    <button
      type="button"
      onClick={() => onChange(mode)}
      aria-pressed={viewMode === mode}
      className={`${baseClass} ${viewMode === mode ? activeClass : idleClass}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="문서 보기 모드">
        {modeButton('preview', '레이아웃 보기')}
        {inputEdit && (
          <button
            type="button"
            onClick={() => inputEdit.available && onChange('inputs')}
            // disabled 대신 aria-disabled: 포커스를 유지해 스크린리더가 비활성 사유(aria-describedby)를 읽게 한다
            aria-disabled={inputDisabled}
            aria-pressed={viewMode === 'inputs'}
            aria-describedby={inputDisabled && inputEdit.reason ? reasonId : undefined}
            title={inputDisabled ? inputEdit.reason : undefined}
            className={`${baseClass} aria-disabled:cursor-not-allowed aria-disabled:opacity-40 ${viewMode === 'inputs' ? activeClass : idleClass}`}
          >
            입력값 편집
          </button>
        )}
        {modeButton('edit', '원문 편집')}
      </div>
      {inputDisabled && inputEdit.reason && (
        <p id={reasonId} className="text-[11px] text-foreground-secondary">
          입력값 편집 불가: {inputEdit.reason}
        </p>
      )}
    </div>
  );
}
