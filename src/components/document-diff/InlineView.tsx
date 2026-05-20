'use client';

import { cn } from '@/lib/utils';
import type { DiffLine } from '@/lib/utils/myers-diff';

interface InlineViewProps {
  lines: DiffLine[];
  onChangeRef: (idx: number, el: HTMLTableRowElement | null) => void;
}

const ROW_BG: Record<string, string> = {
  added: 'bg-green-50',
  removed: 'bg-red-50',
  modified: 'bg-yellow-50',
  unchanged: '',
};

const GUTTER_STYLE: Record<string, string> = {
  added: 'text-green-600',
  removed: 'text-red-600',
  modified: 'text-yellow-600',
  unchanged: 'text-transparent',
};

export function InlineView({ lines, onChangeRef }: InlineViewProps) {
  let changeCount = 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px] font-mono">
        <tbody>
          {lines.map((line, idx) => {
            const isChange = line.type !== 'unchanged';
            const changeIdx = isChange ? changeCount++ : -1;
            const bg = ROW_BG[line.type] ?? '';
            const gutterCls = GUTTER_STYLE[line.type] ?? '';

            // modified 타입: 구 버전 줄과 신 버전 줄을 각각 한 행씩 표시
            if (line.type === 'modified') {
              return (
                <>
                  {/* 구 버전 줄 (삭제) */}
                  <tr
                    key={`${idx}-old`}
                    ref={(el) => onChangeRef(changeIdx, el)}
                    className="bg-red-50 border-b border-border"
                  >
                    <td className="w-10 px-2 text-right text-foreground-quaternary select-none border-r border-border bg-surface-tertiary">
                      {line.oldLine}
                    </td>
                    <td className="w-5 text-center select-none font-bold text-[11px] text-red-600">-</td>
                    <td className="px-3 py-1 text-red-800">
                      {line.wordDiff ? (
                        line.wordDiff
                          .filter((w) => w.type !== 'added')
                          .map((w, i) =>
                            w.type === 'removed' ? (
                              <mark key={i} className="bg-red-200 line-through text-red-800 rounded-sm">{w.text}</mark>
                            ) : (
                              <span key={i}>{w.text}</span>
                            )
                          )
                      ) : (
                        <del>{line.oldContent}</del>
                      )}
                    </td>
                  </tr>
                  {/* 신 버전 줄 (추가) */}
                  <tr key={`${idx}-new`} className="bg-green-50 border-b border-border">
                    <td className="w-10 px-2 text-right text-foreground-quaternary select-none border-r border-border bg-surface-tertiary">
                      {line.newLine}
                    </td>
                    <td className="w-5 text-center select-none font-bold text-[11px] text-green-600">+</td>
                    <td className="px-3 py-1 text-green-800">
                      {line.wordDiff ? (
                        line.wordDiff
                          .filter((w) => w.type !== 'removed')
                          .map((w, i) =>
                            w.type === 'added' ? (
                              <mark key={i} className="bg-green-200 underline text-green-800 rounded-sm">{w.text}</mark>
                            ) : (
                              <span key={i}>{w.text}</span>
                            )
                          )
                      ) : (
                        <ins>{line.content}</ins>
                      )}
                    </td>
                  </tr>
                </>
              );
            }

            return (
              <tr
                key={idx}
                ref={isChange ? (el) => onChangeRef(changeIdx, el) : undefined}
                className={cn('border-b border-border', bg)}
              >
                <td className="w-10 px-2 text-right text-foreground-quaternary select-none border-r border-border bg-surface-tertiary">
                  {line.type === 'added' ? line.newLine : line.oldLine}
                </td>
                <td className={cn('w-5 text-center select-none font-bold text-[11px]', gutterCls)}>
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ''}
                </td>
                <td className={cn(
                  'px-3 py-1',
                  line.type === 'added' ? 'text-green-800' :
                  line.type === 'removed' ? 'text-red-800 line-through' :
                  'text-foreground',
                )}>
                  {line.content}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
