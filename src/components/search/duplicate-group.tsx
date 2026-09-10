'use client';

import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Paperclip } from 'lucide-react';
import type { SearchResult } from './types';

/**
 * 같은 제목으로 접힌 나머지 개별 항목을 펼쳐 보여준다.
 * 제목만 같을 뿐 내용·첨부가 다를 수 있으므로 각 건을 개별로 열 수 있게 한다.
 */
export function DuplicateGroup({
  items,
  onOpen,
  onOpenAttachments,
}: {
  items: SearchResult[];
  onOpen: (result: SearchResult) => void;
  onOpenAttachments?: (result: SearchResult) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full border border-border-tint bg-white px-3 py-1 text-[11px] font-semibold text-foreground-secondary transition-colors hover:bg-primary-tint"
      >
        같은 제목 {items.length}건 더 {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open ? (
        <ul className="mt-2 divide-y divide-border-tint overflow-hidden rounded-xl border border-border-tint bg-white">
          {items.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[12px] text-foreground">{m.name}</p>
                <p className="mt-0.5 text-[11px] text-foreground-secondary">{m.fileType} · {m.date}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {m.dataSource === 'gmail' && onOpenAttachments ? (
                  <button
                    type="button"
                    onClick={() => onOpenAttachments(m)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border-tint px-2 py-1 text-[11px] text-foreground-secondary hover:bg-primary-tint"
                  >
                    <Paperclip size={12} /> 첨부
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onOpen(m)}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90"
                >
                  {m.dataSource === 'gmail' ? '이메일 보기·번역' : '열기'} <ArrowRight size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
