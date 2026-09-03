'use client';

import type { Caption } from '@/hooks/useLiveCaptions';

export const CAPTION_LANGS: { code: string; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'es', label: 'Español' },
  { code: 'vi', label: 'Tiếng Việt' },
];

interface CaptionOverlayProps {
  captions: Caption[];
  enabled: boolean;
}

/**
 * 화면 하단 자막 오버레이. Daily 컨트롤바 위에 떠서 번역 자막을 보여준다.
 * pointer-events-none 으로 클릭을 방해하지 않는다.
 */
export function CaptionOverlay({ captions, enabled }: CaptionOverlayProps) {
  if (!enabled || captions.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-20 z-20 flex flex-col items-center gap-1 px-6">
      {captions.map((c) => (
        <div
          key={c.id}
          className="max-w-3xl rounded-lg bg-black/70 px-4 py-2 text-center text-white shadow-lg"
        >
          <span className="mr-2 text-[12px] font-semibold text-primary-foreground/80 text-sky-300">{c.name}</span>
          <span className="text-[15px] leading-snug">{c.translated || c.original}</span>
          {c.translated && (
            <span className="ml-2 text-[11px] text-white/50">({c.original})</span>
          )}
        </div>
      ))}
    </div>
  );
}
