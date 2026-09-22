'use client';

import { useCallback, useEffect, useState } from 'react';
import { PenLine, Check, X, Zap, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Spinner, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/components/ui/toast';

interface DocApprovalState {
  hasApproval: boolean;
  requestId?: string;
  status?: string;        // pending | approved | rejected
  isMyTurn?: boolean;
  myRankTitle?: string | null;
  iCanDelegate?: boolean;
}

export function ApprovalActionBar({ documentId, onDecided }: { documentId: string; onDecided?: () => void }) {
  const [state, setState] = useState<DocApprovalState | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'delegate' | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/approvals/by-document/${documentId}`);
      const data = await res.json();
      if (res.ok && data.success) setState(data);
    } catch { /* */ }
  }, [documentId]);

  useEffect(() => { load(); }, [load]);

  const decide = async (action: 'approve' | 'reject' | 'delegate', comment?: string) => {
    if (!state?.requestId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/approvals/${state.requestId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: comment ?? '' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error ?? '처리에 실패했습니다.'); return; }
      toast.success(action === 'reject' ? '반려했습니다.' : action === 'delegate' ? '전결로 완료했습니다.' : '서명(승인)했습니다.');
      await load();
      onDecided?.();
    } catch {
      toast.error('처리 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (!state?.hasApproval) return null;

  if (state.status === 'approved') {
    return <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-[12.5px] font-medium border border-emerald-200"><CheckCircle2 size={14} /> 결재 완료</span>;
  }
  if (state.status === 'rejected') {
    return <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-[12.5px] font-medium border border-red-200"><XCircle size={14} /> 반려됨</span>;
  }
  if (!state.isMyTurn) {
    return <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-[12.5px] font-medium border border-amber-200"><Clock size={14} /> 결재 진행중 (다른 결재자 차례)</span>;
  }

  // 내 결재 차례
  return (
    <>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200">
        <PenLine size={14} className="text-[#2E6FF2]" />
        <span className="text-[12.5px] text-[#2560dc] font-medium">내 결재 차례{state.myRankTitle ? ` · ${state.myRankTitle}` : ''}</span>
        <button
          onClick={() => setConfirmAction('approve')}
          disabled={busy}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#2E6FF2] text-white text-[12.5px] font-medium hover:bg-[#2560dc] disabled:opacity-50"
        >
          {busy ? <Spinner size="sm" /> : <Check size={13} />} 서명(승인)
        </button>
        {state.iCanDelegate && (
          <button
            onClick={() => setConfirmAction('delegate')}
            disabled={busy}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-[#7c5cdb] text-[#7c5cdb] text-[12.5px] font-medium hover:bg-purple-50 disabled:opacity-50"
          >
            <Zap size={13} /> 전결
          </button>
        )}
        <button
          onClick={() => { setRejectReason(''); setRejectOpen(true); }}
          disabled={busy}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-foreground-secondary text-[12.5px] font-medium hover:bg-red-50 hover:text-danger hover:border-red-200 disabled:opacity-50"
        >
          <X size={13} /> 반려
        </button>
      </div>

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction === 'delegate' ? '전결로 처리할까요?' : '서명(승인)할까요?'}
        description={confirmAction === 'delegate'
          ? '이 단계에서 결재를 종결합니다. 상위 결재는 생략되고 문서가 완료됩니다. 결재란에 본인 서명과 "전결"이 표기됩니다.'
          : '결재란 내 칸에 본인 서명이 찍히고 다음 결재자에게 넘어갑니다.'}
        confirmLabel={confirmAction === 'delegate' ? '전결' : '서명(승인)'}
        cancelLabel="취소"
        loading={busy}
        onConfirm={async () => { const a = confirmAction; setConfirmAction(null); if (a) await decide(a); }}
        onCancel={() => setConfirmAction(null)}
      />

      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRejectOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-foreground mb-1">반려 사유</h3>
            <p className="text-[12.5px] text-foreground-secondary mb-3">신청자에게 전달되고 문서가 회수됩니다.</p>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="반려 사유를 입력하세요" className="w-full px-3 py-2 rounded-lg border border-border text-[13px] focus:border-[#2E6FF2] focus:outline-none resize-none" />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setRejectOpen(false)} className="px-4 py-2 rounded-lg border border-border text-[13px] text-foreground-secondary hover:bg-surface">취소</button>
              <button onClick={async () => { const r = rejectReason.trim(); setRejectOpen(false); await decide('reject', r); }} className="px-4 py-2 rounded-lg bg-danger text-white text-[13px] font-medium hover:opacity-90">반려</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
