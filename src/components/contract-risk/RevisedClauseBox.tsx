'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface RevisedClauseBoxProps {
  revised: string;
  reason: string;
}

export function RevisedClauseBox({ revised, reason }: RevisedClauseBoxProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(revised);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 수정 제안 조항 */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold text-[#1B1F2B]">수정 제안 조항</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[12px] text-[#2E6FF2] hover:underline transition-opacity"
          >
            {copied ? (
              <><Check className="w-3 h-3" /> 복사됨</>
            ) : (
              <><Copy className="w-3 h-3" /> 복사</>
            )}
          </button>
        </div>
        <div className="rounded-2xl border border-[#C7D9FB] bg-[#F0F5FF] px-4 py-3.5 my-2.5">
          <p className="text-[13px] text-[#1B1F2B] leading-relaxed whitespace-pre-wrap">
            {revised || '수정 제안을 생성 중입니다…'}
          </p>
        </div>
      </div>

      {/* 수정 이유 */}
      {reason && (
        <div>
          <span className="text-[12px] font-semibold text-[#888] block mb-1.5">수정 이유</span>
          <p className="text-[12px] text-[#888] leading-relaxed">
            {reason}
          </p>
        </div>
      )}
    </div>
  );
}
