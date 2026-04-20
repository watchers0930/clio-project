'use client';

import { useEffect, useState } from 'react';
import type { MemoItem } from '@/lib/supabase/types';

interface RelatedMemoEntry {
  id: string;
  title: string;
  similarity: number;
}

interface RelatedMemosProps {
  memoId: string;
  onNavigate: (id: string, title: string) => void;
}

function SimilarityBadge({ similarity }: { similarity: number }) {
  if (similarity >= 0.85) {
    return (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#EEF3FE] text-[#2E6FF2] flex-shrink-0">
        유사도 높음
      </span>
    );
  }
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#F1F3F5] text-[#7C8494] flex-shrink-0">
      유사도 보통
    </span>
  );
}

export default function RelatedMemos({ memoId, onNavigate }: RelatedMemosProps) {
  const [relatedMemos, setRelatedMemos] = useState<RelatedMemoEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!memoId) return;

    fetch(`/api/memos/${memoId}/related`)
      .then((r) => {
        if (!r.ok) throw new Error('related fetch failed');
        return r.json();
      })
      .then((res: { success: boolean; data?: RelatedMemoEntry[] }) => {
        if (res.success && Array.isArray(res.data)) {
          setRelatedMemos(res.data);
        }
      })
      .catch((err: unknown) => {
        console.warn('[RelatedMemos] 연관 메모 로드 실패:', err);
      })
      .finally(() => setLoaded(true));
  }, [memoId]);

  if (!loaded || relatedMemos.length === 0) return null;

  return (
    <div className="px-8 pb-6 flex-shrink-0">
      <div className="border-t border-[#E2E5EA] pt-4">
        <p className="text-[12px] font-semibold text-[#A0A7B5] mb-3 uppercase tracking-wide">
          관련 메모
        </p>
        <ul className="flex flex-col gap-2">
          {relatedMemos.map((entry) => (
            <li key={entry.id}>
              <button
                onClick={() => onNavigate(entry.id, entry.title)}
                className="flex items-center justify-between w-full px-3 py-2 rounded-lg hover:bg-[#F7F8FA] transition-colors text-left gap-3"
              >
                <span className="text-[12px] text-[#1B1F2B] truncate">
                  {entry.title}
                </span>
                <SimilarityBadge similarity={entry.similarity} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
