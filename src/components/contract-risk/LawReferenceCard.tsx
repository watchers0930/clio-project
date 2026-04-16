'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { LawChunk } from '@/lib/types/contract-suggest';

interface LawReferenceCardProps {
  law: LawChunk & { similarity: number };
  index: number;
}

export function LawReferenceCard({ law, index }: LawReferenceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = law.content.length > 150;
  const displayContent = !isLong || expanded ? law.content : law.content.slice(0, 150) + '…';
  const similarityPct = Math.round((law.similarity ?? 0) * 100);

  return (
    <div className="rounded-2xl border border-[#C7D9FB] bg-[#EEF3FE] px-4 py-3.5 my-2.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#2E6FF2] text-white text-[10px] font-bold flex-shrink-0">
            {index}
          </span>
          <span className="text-[13px] font-semibold text-[#2E6FF2]">
            {law.law_name} {law.article_no}{law.clause_no ? ` ${law.clause_no}` : ''}
          </span>
        </div>
        <span className="text-[11px] text-[#2E6FF2] font-medium flex-shrink-0">
          유사도 {similarityPct}%
        </span>
      </div>

      <p className="text-[12px] text-[#1B1F2B] leading-relaxed">
        {displayContent}
      </p>

      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex items-center gap-0.5 text-[12px] text-[#2E6FF2] hover:underline"
        >
          {expanded ? (
            <><ChevronUp className="w-3 h-3" /> 접기</>
          ) : (
            <><ChevronDown className="w-3 h-3" /> 전체 보기</>
          )}
        </button>
      )}
    </div>
  );
}
