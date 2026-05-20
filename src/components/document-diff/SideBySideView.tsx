'use client';

import { cn } from '@/lib/utils';
import type { DiffLine } from '@/lib/utils/myers-diff';

interface SideBySideViewProps {
  lines: DiffLine[];
  onChangeRef: (idx: number, el: HTMLTableRowElement | null) => void;
}

const GUTTER: Record<string, string> = {
  added: '+',
  removed: '-',
  modified: '~',
  unchanged: '',
};

const ROW_BG: Record<string, string> = {
  added: 'bg-green-50',
  removed: 'bg-red-50',
  modified: 'bg-yellow-50',
  unchanged: '',
};

const CELL_TEXT: Record<string, string> = {
  added: 'text-green-800',
  removed: 'text-red-800',
  modified: 'text-yellow-800',
  unchanged: 'text-foreground',
};

function WordHighlight({ line }: { line: DiffLine }) {
  if (line.type !== 'modified' || !line.wordDiff) {
    return <>{line.content}</>;
  }
  return (
    <>
      {line.wordDiff.map((w, i) =>
        w.type === 'removed' ? (
          <mark key={i} className="bg-red-200 line-through text-red-800 rounded-sm">{w.text}</mark>
        ) : w.type === 'added' ? (
          <mark key={i} className="bg-green-200 underline text-green-800 rounded-sm">{w.text}</mark>
        ) : (
          <span key={i}>{w.text}</span>
        )
      )}
    </>
  );
}

function OldWordHighlight({ line }: { line: DiffLine }) {
  if (line.type !== 'modified' || !line.wordDiff) {
    return <>{line.oldContent}</>;
  }
  return (
    <>
      {line.wordDiff
        .filter((w) => w.type !== 'added')
        .map((w, i) =>
          w.type === 'removed' ? (
            <mark key={i} className="bg-red-200 line-through text-red-800 rounded-sm">{w.text}</mark>
          ) : (
            <span key={i}>{w.text}</span>
          )
        )}
    </>
  );
}

export function SideBySideView({ lines, onChangeRef }: SideBySideViewProps) {
  let changeCount = 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px] font-mono">
        <tbody>
          {lines.map((line, idx) => {
            const isChange = line.type !== 'unchanged';
            const changeIdx = isChange ? changeCount++ : -1;
            const bg = ROW_BG[line.type] ?? '';
            const textCls = CELL_TEXT[line.type] ?? 'text-foreground';
            const gutter = GUTTER[line.type] ?? '';

            return (
              <tr
                key={idx}
                ref={isChange ? (el) => onChangeRef(changeIdx, el) : undefined}
                className={cn('border-b border-border', bg)}
              >
                {/* 구 버전 줄 번호 */}
                <td className="w-10 px-2 text-right text-foreground-quaternary select-none border-r border-border bg-surface-tertiary">
                  {line.oldLine ?? ''}
                </td>
                {/* 구 버전 내용 */}
                <td className={cn('px-3 py-1 align-top border-r border-border w-1/2', textCls)}>
                  {line.type === 'added' ? (
                    <span className="text-foreground-quaternary italic">—</span>
                  ) : line.type === 'modified' ? (
                    <OldWordHighlight line={line} />
                  ) : (
                    line.content
                  )}
                </td>
                {/* 거터 */}
                <td className={cn(
                  'w-5 text-center select-none font-bold text-[11px]',
                  line.type === 'added' ? 'text-green-600' :
                  line.type === 'removed' ? 'text-red-600' :
                  line.type === 'modified' ? 'text-yellow-600' : '',
                )}>
                  {gutter}
                </td>
                {/* 신 버전 줄 번호 */}
                <td className="w-10 px-2 text-right text-foreground-quaternary select-none border-l border-border bg-surface-tertiary">
                  {line.newLine ?? ''}
                </td>
                {/* 신 버전 내용 */}
                <td className={cn('px-3 py-1 align-top w-1/2', textCls)}>
                  {line.type === 'removed' ? (
                    <span className="text-foreground-quaternary italic">—</span>
                  ) : line.type === 'modified' ? (
                    <WordHighlight line={line} />
                  ) : (
                    line.content
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
