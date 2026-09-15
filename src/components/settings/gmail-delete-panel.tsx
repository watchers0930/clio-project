'use client';

import { useState } from 'react';
import { Trash2, Search, AlertTriangle, Inbox } from 'lucide-react';
import { Spinner, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useGmailDelete, type GmailDeleteHit } from '@/hooks/useGmailDelete';

/** Gmail Date 헤더(RFC 2822)를 짧은 한국어 날짜로. 파싱 실패 시 원문 폴백. */
function formatDate(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' });
}

interface RowProps {
  hit: GmailDeleteHit;
  checked: boolean;
  onToggle: (id: string) => void;
}

function MailRow({ hit, checked, onToggle }: RowProps) {
  return (
    <label className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(hit.id)}
        className="w-4 h-4 shrink-0 accent-[#2E6FF2]"
      />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate">{hit.subject || '(제목 없음)'}</p>
        <p className="text-[11px] text-foreground-secondary truncate">{hit.from}</p>
      </div>
      <span className="text-[11px] text-foreground-secondary shrink-0">{formatDate(hit.date)}</span>
    </label>
  );
}

export function GmailDeletePanel() {
  const [keyword, setKeyword] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const toast = useToast();
  const { hits, selected, searching, deleting, searched, meta, search, toggle, toggleAll, remove } = useGmailDelete();

  const handleSearch = async () => {
    const kw = keyword.trim();
    if (kw.length < 2) {
      toast.error('검색어는 2자 이상 입력해 주세요.');
      return;
    }
    const res = await search(kw);
    if (!res.ok) {
      toast.error(res.error ?? '검색에 실패했습니다.');
      return;
    }
  };

  const handleConfirmDelete = async () => {
    const res = await remove();
    setConfirmOpen(false);
    if (!res.ok) {
      toast.error(res.error ?? '삭제에 실패했습니다.');
      return;
    }
    toast.success(`${res.trashed ?? 0}건을 Gmail 휴지통으로 옮겼습니다. 30일 내 Gmail에서 복구할 수 있습니다.`);
  };

  const allChecked = hits.length > 0 && selected.size === hits.length;

  return (
    <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-danger/10 flex items-center justify-center">
            <Trash2 size={18} className="text-danger" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">키워드로 메일 삭제</h2>
            <p className="text-[12px] text-foreground-secondary">키워드로 메일함 전체를 검색해, 확인 후 선택한 메일을 휴지통으로 옮깁니다.</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 flex flex-col gap-4">
        {/* 경고 안내 */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[12px] leading-5 text-amber-800">
            삭제는 <strong>Gmail 휴지통으로 이동</strong>이며 영구 삭제가 아닙니다. 휴지통에서 30일 내 복구할 수 있습니다.
            반드시 <strong>목록을 확인하고 선택</strong>한 뒤 삭제하세요. 발신자로 좁히려면 <code className="px-1 rounded bg-white/60">from:</code>, 제목은 <code className="px-1 rounded bg-white/60">subject:</code> 문법을 쓸 수 있습니다.
          </p>
        </div>

        {/* 검색 입력 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-secondary" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="예: 광고, from:noreply@example.com, subject:영수증"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border text-[13px] text-foreground focus:outline-none focus:border-[#2E6FF2]"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2E6FF2] text-white text-[13px] font-medium hover:bg-[#2560dc] disabled:opacity-50 transition-colors shrink-0"
          >
            {searching ? <Spinner size="sm" /> : <Search size={14} />}
            검색
          </button>
        </div>

        {/* 결과 */}
        {searched && (
          hits.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Inbox size={28} className="text-foreground-secondary/50" />
              <p className="text-[13px] text-foreground-secondary">일치하는 메일이 없습니다.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* 요약 + 전체선택 */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-4 h-4 accent-[#2E6FF2]" />
                  <span className="text-[12px] text-foreground-secondary">
                    <strong className="text-foreground">{hits.length}건</strong> 표시
                    {meta.truncated && ` (전체 약 ${meta.total.toLocaleString()}건 중 최근 ${meta.previewLimit}건)`}
                    {' · '}<strong className="text-[#2E6FF2]">{selected.size}건 선택</strong>
                  </span>
                </label>
              </div>

              {meta.truncated && (
                <p className="text-[11px] text-amber-700">
                  결과가 {meta.previewLimit}건을 초과합니다. 먼저 이만큼 삭제한 뒤 다시 검색하거나, 키워드를 더 구체적으로 좁혀주세요.
                </p>
              )}

              {/* 목록 */}
              <div className="rounded-xl border border-border max-h-[420px] overflow-y-auto">
                {hits.map((hit) => (
                  <MailRow key={hit.id} hit={hit} checked={selected.has(hit.id)} onToggle={toggle} />
                ))}
              </div>

              {/* 삭제 버튼 */}
              <div className="flex justify-end">
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={deleting || selected.size === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-danger text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {deleting ? <Spinner size="sm" /> : <Trash2 size={14} />}
                  선택한 {selected.size}건 휴지통으로
                </button>
              </div>
            </div>
          )
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`${selected.size}건을 휴지통으로 옮길까요?`}
        description="선택한 메일이 Gmail 휴지통으로 이동합니다. 30일 내 Gmail에서 복구할 수 있습니다."
        confirmLabel="휴지통으로 이동"
        cancelLabel="취소"
        variant="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
