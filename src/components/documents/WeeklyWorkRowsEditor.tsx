'use client';

import { useMemo, useState } from 'react';

export interface WorkRow {
  date: string;
  content: string;
  progress: string;
  note: string;
}

/**
 * 주간업무 '금주 업무' 표의 동적 행 에디터.
 * 날짜/내용/진행율/비고를 입력하고 [추가]를 누르면 행이 누적된다.
 * 값은 JSON 문자열로 상위 documentInputs.work_rows에 저장된다.
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

  const [draft, setDraft] = useState<WorkRow>({ date: '', content: '', progress: '', note: '' });

  const commit = (next: WorkRow[]) => onChange(JSON.stringify(next));

  const addRow = () => {
    if (!draft.date.trim() && !draft.content.trim()) return; // 날짜·내용 모두 비면 추가 안 함
    commit([...rows, draft]);
    setDraft({ date: '', content: '', progress: '', note: '' });
  };
  const removeRow = (index: number) => commit(rows.filter((_, i) => i !== index));

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <div>
      <p className="text-sm font-medium text-foreground" style={{ marginBottom: 8 }}>금주 업무</p>

      {/* 추가된 행 목록 */}
      {rows.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden" style={{ marginBottom: 10 }}>
          <div className="grid grid-cols-[1.1fr_4fr_0.9fr_1.3fr_auto] gap-0 bg-surface-secondary text-xs font-medium text-foreground-secondary">
            <div className="px-3 py-2">날짜</div>
            <div className="px-3 py-2">내용</div>
            <div className="px-3 py-2">진행율</div>
            <div className="px-3 py-2">비고</div>
            <div className="px-3 py-2" style={{ width: 36 }} />
          </div>
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-[1.1fr_4fr_0.9fr_1.3fr_auto] gap-0 border-t border-border text-sm text-foreground">
              <div className="px-3 py-2 break-words">{row.date}</div>
              <div className="px-3 py-2 break-words">{row.content}</div>
              <div className="px-3 py-2 break-words">{row.progress}</div>
              <div className="px-3 py-2 break-words">{row.note}</div>
              <button
                type="button"
                onClick={() => removeRow(index)}
                aria-label="행 삭제"
                className="px-3 py-2 text-foreground-quaternary hover:text-danger"
                style={{ width: 36 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 입력 폼 + 추가 버튼 */}
      <div className="grid grid-cols-[1.1fr_4fr_0.9fr_1.3fr] gap-2" style={{ marginBottom: 8 }}>
        <input className={inputCls} placeholder="예: 10/21 (화)" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
        <input className={inputCls} placeholder="업무 내용" value={draft.content} onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))} />
        <input className={inputCls} placeholder="예: 50%" value={draft.progress} onChange={(e) => setDraft((d) => ({ ...d, progress: e.target.value }))} />
        <input
          className={inputCls}
          placeholder="비고"
          value={draft.note}
          onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRow(); } }}
        />
      </div>
      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-tint"
      >
        ＋ 행 추가
      </button>
    </div>
  );
}
