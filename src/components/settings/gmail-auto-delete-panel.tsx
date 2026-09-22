'use client';

import { useEffect, useMemo, useState } from 'react';
import { Zap, Search, ShieldCheck, AlertTriangle, Inbox, Clock } from 'lucide-react';
import { Spinner, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import {
  useGmailAutoDelete,
  extractSenderPattern,
  extractSenderEmail,
  type AutoDeleteRule,
} from '@/hooks/useGmailAutoDelete';
import type { GmailDeleteHit } from '@/hooks/useGmailDelete';

/** Gmail Date 헤더 → 짧은 한국어 날짜. 파싱 실패 시 원문 폴백. */
function formatDate(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' });
}

function PreviewRow({ hit, checked, onToggle }: { hit: GmailDeleteHit; checked: boolean; onToggle: (id: string) => void }) {
  const sender = extractSenderEmail(hit.from);
  return (
    <label className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-surface cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(hit.id)}
        className="w-4 h-4 shrink-0 accent-[#2E6FF2]"
      />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate">{hit.subject || '(제목 없음)'}</p>
        <p className="text-[11px] text-foreground-secondary truncate">{sender ?? hit.from}</p>
      </div>
      <span className="text-[11px] text-foreground-secondary shrink-0">{formatDate(hit.date)}</span>
    </label>
  );
}

function RuleCard({ rule, onRemove }: { rule: AutoDeleteRule; onRemove: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate">{rule.pattern}</p>
        <p className="text-[11px] text-foreground-secondary">
          {rule.last_run_at
            ? `마지막 실행 ${formatDate(rule.last_run_at)} · 누적 ${rule.total_trashed.toLocaleString()}건 이동`
            : '아직 실행 전 · 다음 새벽 자동 실행'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onRemove(rule.id)}
        className="shrink-0 text-[12px] px-3 py-1.5 rounded-lg border border-border text-foreground-secondary hover:bg-red-50 hover:text-danger hover:border-red-200 transition-colors"
      >
        해제
      </button>
    </div>
  );
}

export function GmailAutoDeletePanel() {
  const [pattern, setPattern] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const toast = useToast();
  const {
    rules, loading, previewHits, previewMeta, previewed, previewing, saving,
    preview, clearPreview, addRules, removeRule,
  } = useGmailAutoDelete();

  // 미리보기 결과가 바뀌면 기본으로 전체 선택(사용자가 광고 아닌 것만 해제)
  useEffect(() => {
    setSelected(new Set(previewHits.map((h) => h.id)));
  }, [previewHits]);

  // 선택한 메일들의 고유 발신자 → 규칙 패턴 map (pattern → 표시용 email)
  const selectedSenders = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of previewHits) {
      if (!selected.has(h.id)) continue;
      const pat = extractSenderPattern(h.from);
      if (pat) map.set(pat, extractSenderEmail(h.from) ?? pat);
    }
    return map;
  }, [previewHits, selected]);

  const senderCount = selectedSenders.size;
  const allChecked = previewHits.length > 0 && selected.size === previewHits.length;

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected((prev) => (prev.size === previewHits.length ? new Set() : new Set(previewHits.map((h) => h.id))));

  const runPreview = async () => {
    const kw = pattern.trim();
    if (kw.length < 2) {
      toast.error('검색어는 2자 이상 입력해 주세요.');
      return;
    }
    const res = await preview(kw);
    if (!res.ok) toast.error(res.error ?? '검색에 실패했습니다.');
  };

  const handleRegister = async () => {
    const patterns = Array.from(selectedSenders.keys());
    const res = await addRules(patterns);
    setConfirmOpen(false);
    if (!res.ok) {
      toast.error(res.error ?? '등록에 실패했습니다.');
      return;
    }
    const parts = [] as string[];
    if (res.added > 0) parts.push(`발신자 ${res.added}명 자동삭제 등록`);
    if (res.dup > 0) parts.push(`이미 등록됨 ${res.dup}명`);
    toast.success(`${parts.join(' · ')}. 매일 새벽 자동으로 휴지통 이동합니다.`);
    setPattern('');
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const res = await removeRule(removeTarget);
    setRemoveTarget(null);
    if (!res.ok) toast.error(res.error ?? '해제에 실패했습니다.');
    else toast.success('자동삭제 규칙을 해제했습니다.');
  };

  return (
    <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#2E6FF2]/10 flex items-center justify-center">
            <Zap size={18} className="text-[#2E6FF2]" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">확실한 광고메일 자동삭제</h2>
            <p className="text-[12px] text-foreground-secondary">검색 결과에서 광고 메일을 골라 등록하면, 그 발신자의 메일을 매일 새벽 자동으로 휴지통으로 옮깁니다.</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 flex flex-col gap-4">
        {/* 안전 안내 */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
          <ShieldCheck size={14} className="text-blue-600 mt-0.5 shrink-0" />
          <p className="text-[12px] leading-5 text-blue-800">
            <strong>사용법</strong> — 키워드로 검색한 뒤, 결과 목록에서 <strong>확실한 광고만 체크</strong>하고 등록하세요.
            선택한 <strong>메일의 발신자</strong>가 앞으로 보내는 메일이 자동삭제 대상이 됩니다.
            별표·중요 표시 메일은 <strong>항상 제외</strong>, 삭제는 <strong>휴지통 이동</strong>(30일 복구), 규칙당 하루 500건까지 처리합니다.
          </p>
        </div>

        {/* 검색 입력 */}
        <div className="flex gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0 px-3 rounded-lg border border-border bg-white focus-within:border-[#2E6FF2]">
            <Search size={15} className="text-foreground-secondary shrink-0" />
            <input
              type="text"
              value={pattern}
              onChange={(e) => { setPattern(e.target.value); if (previewed) clearPreview(); }}
              onKeyDown={(e) => { if (e.key === 'Enter') runPreview(); }}
              placeholder="예: 광고, from:noreply@example.com"
              className="flex-1 min-w-0 py-2.5 bg-transparent text-[13px] text-foreground focus:outline-none"
            />
          </div>
          <button
            onClick={runPreview}
            disabled={previewing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#2E6FF2] text-[#2E6FF2] text-[13px] font-medium hover:bg-blue-50 disabled:opacity-50 transition-colors shrink-0"
          >
            {previewing ? <Spinner size="sm" /> : <Search size={14} />}
            검색
          </button>
        </div>

        {/* 검색 결과 — 광고만 골라 발신자 등록 */}
        {previewed && (
          previewHits.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <Inbox size={26} className="text-foreground-secondary/50" />
              <p className="text-[13px] text-foreground-secondary">일치하는 메일이 없습니다. 다른 키워드로 검색해 보세요.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* 전체선택 + 요약 */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-4 h-4 accent-[#2E6FF2]" />
                  <span className="text-[12px] text-foreground-secondary">
                    <strong className="text-foreground">{previewHits.length}건</strong> 검색됨
                    {previewMeta.truncated && ` (전체 약 ${previewMeta.total.toLocaleString()}건 중 최근 ${previewMeta.previewLimit}건)`}
                    {' · '}<strong className="text-[#2E6FF2]">{selected.size}건 선택</strong>
                  </span>
                </label>
              </div>

              {/* 목록 (체크박스) */}
              <div className="rounded-xl border border-border max-h-[340px] overflow-y-auto">
                {previewHits.map((hit) => (
                  <PreviewRow key={hit.id} hit={hit} checked={selected.has(hit.id)} onToggle={toggle} />
                ))}
              </div>

              {/* 선택한 발신자 요약 */}
              {senderCount > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-[12px] leading-5 text-amber-800">
                    등록할 발신자 <strong>{senderCount}명</strong>: {Array.from(selectedSenders.values()).slice(0, 5).join(', ')}
                    {senderCount > 5 && ` 외 ${senderCount - 5}명`}.
                    이 발신자들이 <strong>앞으로 보내는 모든 메일</strong>이 매일 자동으로 휴지통으로 이동합니다. 광고가 아닌 발신자는 체크를 해제하세요.
                  </p>
                </div>
              )}

              {/* 등록 버튼 */}
              <div className="flex justify-end">
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={saving || senderCount === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2E6FF2] text-white text-[13px] font-medium hover:bg-[#2560dc] disabled:opacity-50 transition-colors"
                >
                  {saving ? <Spinner size="sm" /> : <Zap size={14} />}
                  선택한 발신자 {senderCount}명 자동삭제 등록
                </button>
              </div>
            </div>
          )
        )}

        {/* 등록된 규칙 목록 */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-foreground-secondary" />
            <span className="text-[12px] font-medium text-foreground">등록된 자동삭제 규칙 {rules.length > 0 && `(${rules.length})`}</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-6"><Spinner size="sm" /></div>
          ) : rules.length === 0 ? (
            <p className="text-[12px] text-foreground-secondary py-4 text-center">아직 등록된 자동삭제 규칙이 없습니다.</p>
          ) : (
            <div className="rounded-xl border border-border">
              {rules.map((rule) => (
                <RuleCard key={rule.id} rule={rule} onRemove={(id) => setRemoveTarget(id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 등록 확인 */}
      <ConfirmDialog
        open={confirmOpen}
        title={`발신자 ${senderCount}명을 자동삭제로 등록할까요?`}
        description="선택한 발신자가 앞으로 보내는 메일이 매일 새벽 자동으로 Gmail 휴지통으로 이동합니다. 별표·중요 메일은 제외되며 30일 내 복구할 수 있습니다."
        confirmLabel="자동삭제 등록"
        cancelLabel="취소"
        loading={saving}
        onConfirm={handleRegister}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* 해제 확인 */}
      <ConfirmDialog
        open={removeTarget !== null}
        title="자동삭제 규칙을 해제할까요?"
        description="해제하면 이 규칙으로는 더 이상 자동삭제하지 않습니다. 이미 휴지통으로 옮겨진 메일은 그대로 유지됩니다."
        confirmLabel="해제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
