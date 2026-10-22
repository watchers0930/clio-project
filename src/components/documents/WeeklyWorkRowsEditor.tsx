'use client';

import { useMemo } from 'react';

export interface WorkRow {
  date: string;
  content: string;
  progress: string;
  note: string;
}

const EMPTY: WorkRow = { date: '', content: '', progress: '', note: '' };
const isBlank = (r: WorkRow) =>
  !r.date?.trim() && !r.content?.trim() && !r.progress?.trim() && !r.note?.trim();

/**
 * 주간업무 '금주 업무' 표의 동적 행 에디터.
 * 표에서 날짜/내용/진행율/비고를 직접 인라인 편집한다. 타이핑 즉시 상위
 * documentInputs.work_rows(JSON 문자열)에 반영되며, 마지막 빈 행에 입력하면
 * 새 빈 행이 자동으로 생긴다. (과거 draft→[＋추가] 방식은 버튼을 안 누르면
 * 입력이 통째로 유실되어 금주 업무가 저장되지 않는 함정이 있었다.)
 */
export function WeeklyWorkRowsEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (json: string) => void;
}) {
  const rows = useMemo<WorkRow[]>(() => {
    try {
      const parsed = JSON.parse(value || '[]');
      return Array.isArray(parsed) ? (parsed as WorkRow[]) : [];
    } catch {
      return [];
    }
  }, [value]);

  // 편집용: 저장된 행 + 항상 마지막에 빈 입력 행 1개.
  const editRows = [...rows, { ...EMPTY }];

  // 완전히 빈 행은 제외하고 저장(렌더 측 buildWorkRowsHtml 필터와 일치).
  const commit = (next: WorkRow[]) => onChange(JSON.stringify(next.filter((r) => !isBlank(r))));

  const updateCell = (index: number, key: keyof WorkRow, v: string) =>
    commit(editRows.map((r, i) => (i === index ? { ...r, [key]: v } : r)));
  const removeRow = (index: number) => commit(editRows.filter((_, i) => i !== index));

  const cellCls =
    'w-full px-3 py-2.5 border-0 bg-transparent text-sm text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white rounded';

  return (
    <div>
      <p className="text-sm font-medium text-foreground" style={{ marginBottom: 8 }}>금주 업무</p>

      <div className="rounded-xl border border-border overflow-hidden">
        {/* 헤더 */}
        <div className="grid grid-cols-[1.1fr_4fr_0.9fr_1.3fr_auto] bg-surface-secondary text-xs font-medium text-foreground-secondary">
          <div className="px-3 py-2">날짜</div>
          <div className="px-3 py-2">내용</div>
          <div className="px-3 py-2">진행율</div>
          <div className="px-3 py-2">비고</div>
          <div className="px-3 py-2" style={{ width: 36 }} />
        </div>

        {/* 인라인 편집 행 (마지막은 빈 입력 행) */}
        {editRows.map((row, index) => {
          const isLast = index === editRows.length - 1;
          return (
            <div key={index} className="grid grid-cols-[1.1fr_4fr_0.9fr_1.3fr_auto] border-t border-border items-center">
              <input className={cellCls} placeholder={isLast ? '예: 10/21 (화)' : ''} value={row.date} onChange={(e) => updateCell(index, 'date', e.target.value)} />
              <input className={cellCls} placeholder={isLast ? '업무 내용' : ''} value={row.content} onChange={(e) => updateCell(index, 'content', e.target.value)} />
              <input className={cellCls} placeholder={isLast ? '예: 50%' : ''} value={row.progress} onChange={(e) => updateCell(index, 'progress', e.target.value)} />
              <input className={cellCls} placeholder={isLast ? '비고' : ''} value={row.note} onChange={(e) => updateCell(index, 'note', e.target.value)} />
              {isLast ? (
                <span style={{ width: 36 }} />
              ) : (
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  aria-label="행 삭제"
                  className="px-3 py-2 text-foreground-quaternary hover:text-danger"
                  style={{ width: 36 }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-foreground-quaternary" style={{ marginTop: 6 }}>표에 직접 입력하면 자동 저장되고, 마지막 줄에 입력하면 새 행이 추가됩니다.</p>
    </div>
  );
}
