'use client';

import { useState } from 'react';
import { Zap, Search, ShieldCheck, Trash2, AlertTriangle, Inbox, Clock } from 'lucide-react';
import { Spinner, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useGmailAutoDelete, type AutoDeleteRule } from '@/hooks/useGmailAutoDelete';

/** Gmail Date 헤더 → 짧은 한국어 날짜. 파싱 실패 시 원문 폴백. */
function formatDate(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' });
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const toast = useToast();
  const {
    rules, loading, previewHits, previewMeta, previewed, previewing, saving,
    preview, clearPreview, addRule, removeRule,
  } = useGmailAutoDelete();

  const runPreview = async () => {
    const kw = pattern.trim();
    if (kw.length < 2) {
      toast.error('규칙은 2자 이상 입력해 주세요.');
      return;
    }
    const res = await preview(kw);
    if (!res.ok) toast.error(res.error ?? '미리보기에 실패했습니다.');
  };

  const handleAdd = async () => {
    const res = await addRule(pattern.trim());
    if (!res.ok) {
      toast.error(res.error ?? '규칙 등록에 실패했습니다.');
      return;
    }
    toast.success('자동삭제 규칙을 등록했습니다. 매일 새벽 자동으로 휴지통 이동합니다.');
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
            <p className="text-[12px] text-foreground-secondary">등록한 발신자·키워드에 맞는 메일을 매일 새벽 자동으로 휴지통으로 옮깁니다.</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 flex flex-col gap-4">
        {/* 안전 안내 */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
          <ShieldCheck size={14} className="text-blue-600 mt-0.5 shrink-0" />
          <p className="text-[12px] leading-5 text-blue-800">
            <strong>안전장치</strong> — 별표·중요 표시한 메일은 자동삭제에서 <strong>항상 제외</strong>됩니다.
            삭제는 <strong>휴지통 이동</strong>이라 30일 내 복구할 수 있고, 규칙당 하루 최대 500건까지 처리합니다.
            <strong> 확실한 광고만</strong> 등록하세요. 발신자로 좁히려면 <code className="px-1 rounded bg-white/60">from:</code> 문법을 권장합니다.
          </p>
        </div>

        {/* 입력 + 미리보기 */}
        <div className="flex gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0 px-3 rounded-lg border border-border bg-white focus-within:border-[#2E6FF2]">
            <Search size={15} className="text-foreground-secondary shrink-0" />
            <input
              type="text"
              value={pattern}
              onChange={(e) => { setPattern(e.target.value); if (previewed) clearPreview(); }}
              onKeyDown={(e) => { if (e.key === 'Enter') runPreview(); }}
              placeholder="예: from:noreply@example.com"
              className="flex-1 min-w-0 py-2.5 bg-transparent text-[13px] text-foreground focus:outline-none"
            />
          </div>
          <button
            onClick={runPreview}
            disabled={previewing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#2E6FF2] text-[#2E6FF2] text-[13px] font-medium hover:bg-blue-50 disabled:opacity-50 transition-colors shrink-0"
          >
            {previewing ? <Spinner size="sm" /> : <Search size={14} />}
            미리보기
          </button>
        </div>

        {/* 미리보기 결과 — 등록 전 반드시 확인 */}
        {previewed && (
          previewHits.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <Inbox size={26} className="text-foreground-secondary/50" />
              <p className="text-[13px] text-foreground-secondary">지금은 일치하는 메일이 없습니다. 그래도 규칙으로 등록하면 앞으로 오는 메일에 적용됩니다.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[12px] text-foreground-secondary">
                <strong className="text-foreground">{previewHits.length}건</strong> 미리보기
                {previewMeta.truncated && ` (전체 약 ${previewMeta.total.toLocaleString()}건 중 최근 ${previewMeta.previewLimit}건)`}
                <span className="text-amber-700">· 이 메일들이 매일 자동으로 휴지통으로 이동합니다</span>
              </div>
              <div className="rounded-xl border border-border max-h-[320px] overflow-y-auto">
                {previewHits.map((hit) => (
                  <div key={hit.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{hit.subject || '(제목 없음)'}</p>
                      <p className="text-[11px] text-foreground-secondary truncate">{hit.from}</p>
                    </div>
                    <span className="text-[11px] text-foreground-secondary shrink-0">{formatDate(hit.date)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[12px] leading-5 text-amber-800">
                  목록에 <strong>지우면 안 되는 메일</strong>이 섞여 있다면 규칙을 <code className="px-1 rounded bg-white/60">from:</code>으로 더 좁히세요. 원치 않는 메일은 별표를 달면 자동삭제에서 제외됩니다.
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2E6FF2] text-white text-[13px] font-medium hover:bg-[#2560dc] disabled:opacity-50 transition-colors"
                >
                  {saving ? <Spinner size="sm" /> : <Zap size={14} />}
                  이 규칙으로 자동삭제 등록
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
        title="이 규칙을 자동삭제로 등록할까요?"
        description="매일 새벽, 이 규칙에 맞는 메일이 자동으로 Gmail 휴지통으로 이동합니다. 별표·중요 메일은 제외되며 30일 내 복구할 수 있습니다."
        confirmLabel="자동삭제 등록"
        cancelLabel="취소"
        loading={saving}
        onConfirm={async () => { await handleAdd(); setConfirmOpen(false); }}
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
