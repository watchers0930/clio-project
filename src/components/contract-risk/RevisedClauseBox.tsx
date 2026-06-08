'use client';

import { useState } from 'react';
import { Copy, Check, Pencil, X } from 'lucide-react';

interface RevisedClauseBoxProps {
  revised: string;
  reason: string;
  editedRevised?: string;
  onEditRevised?: (text: string) => void;
}

export function RevisedClauseBox({ revised, reason, editedRevised, onEditRevised }: RevisedClauseBoxProps) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const displayText = editedRevised ?? revised;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleStartEdit = () => {
    setDraft(displayText);
    setEditing(true);
  };

  const handleSave = () => {
    onEditRevised?.(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 수정 제안 조항 */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold text-foreground">
            수정 제안 조항
            {editedRevised && (
              <span className="ml-1.5 text-[10px] font-medium text-primary bg-primary-tint px-1.5 py-0.5 rounded">편집됨</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            {onEditRevised && !editing && (
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-1 text-[12px] text-foreground-secondary hover:text-foreground transition-colors"
              >
                <Pencil className="w-3 h-3" /> 편집
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[12px] text-primary hover:underline transition-opacity"
            >
              {copied ? (
                <><Check className="w-3 h-3" /> 복사됨</>
              ) : (
                <><Copy className="w-3 h-3" /> 복사</>
              )}
            </button>
          </div>
        </div>

        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="rounded-2xl border border-primary/30 bg-primary-tint px-4 py-3.5 text-[13px] text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary resize-y min-h-[100px]"
              rows={5}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-[12px] text-foreground-secondary hover:bg-surface-secondary transition-colors"
              >
                <X className="w-3 h-3" /> 취소
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-[12px] text-white font-medium hover:bg-primary-dark transition-colors"
              >
                <Check className="w-3 h-3" /> 저장
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-primary/30 bg-primary-tint px-4 py-3.5 my-2.5">
            <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">
              {displayText || '수정 제안을 생성 중입니다…'}
            </p>
          </div>
        )}
      </div>

      {/* 수정 이유 */}
      {reason && (
        <div>
          <span className="text-[12px] font-semibold text-foreground-quaternary block mb-1.5">수정 이유</span>
          <p className="text-[12px] text-foreground-quaternary leading-relaxed">
            {reason}
          </p>
        </div>
      )}
    </div>
  );
}
