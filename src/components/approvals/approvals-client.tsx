'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Stamp, Inbox, Send, Check, X, Zap, FileText } from 'lucide-react';
import { Spinner, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/components/ui/toast';

interface InboxItem {
  requestId: string;
  documentId: string;
  documentTitle: string;
  requesterName: string;
  stepOrder: number;
  rankTitle: string | null;
  createdAt: string;
}
interface OutboxItem {
  requestId: string;
  documentId: string;
  documentTitle: string;
  status: string;
  currentStep: number;
  createdAt: string;
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  pending: { text: '결재 진행중', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { text: '결재 완료', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { text: '반려됨', cls: 'bg-red-50 text-red-600 border-red-200' },
};

function fmt(d: string): string {
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ApprovalsClient() {
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [canDelegate, setCanDelegate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<InboxItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<{ item: InboxItem; action: 'approve' | 'delegate' } | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/approvals/inbox');
      const data = await res.json();
      if (res.ok && data.success) {
        setInbox(data.inbox ?? []);
        setOutbox(data.outbox ?? []);
        setCanDelegate(Boolean(data.iCanDelegate));
      }
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (item: InboxItem, action: 'approve' | 'reject' | 'delegate', comment?: string) => {
    setBusyId(item.requestId);
    try {
      const res = await fetch(`/api/approvals/${item.requestId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: comment ?? '' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error ?? '처리에 실패했습니다.'); return; }
      const msg = action === 'reject' ? '반려했습니다.' : action === 'delegate' ? '전결로 결재를 완료했습니다.' : (data.result === 'completed' ? '최종 승인했습니다.' : '승인했습니다.');
      toast.success(msg);
      await load();
    } catch {
      toast.error('처리 중 오류가 발생했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-5 py-8 flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#2E6FF2]/10 flex items-center justify-center">
          <Stamp size={20} className="text-[#2E6FF2]" />
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-foreground">결재함</h1>
          <p className="text-[13px] text-foreground-secondary">받은 결재를 처리하고, 내가 올린 결재 진행 상황을 확인합니다.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Spinner size="md" /></div>
      ) : (
        <>
          {/* 받은 결재 */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Inbox size={16} className="text-foreground-secondary" />
              <h2 className="text-[15px] font-semibold text-foreground">받은 결재 {inbox.length > 0 && <span className="text-[#2E6FF2]">{inbox.length}</span>}</h2>
            </div>
            {inbox.length === 0 ? (
              <p className="text-[13px] text-foreground-secondary py-6 text-center border border-border rounded-xl">결재할 문서가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {inbox.map((it) => (
                  <div key={it.requestId} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-border bg-white">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-foreground-secondary shrink-0" />
                        <Link href={`/documents/${it.documentId}`} className="text-[14px] font-medium text-foreground hover:text-[#2E6FF2] truncate">{it.documentTitle}</Link>
                      </div>
                      <p className="text-[12px] text-foreground-secondary mt-1">
                        {it.requesterName} 상신 · 내 결재 <strong className="text-foreground">{it.rankTitle ?? ''}</strong> · {fmt(it.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setConfirmTarget({ item: it, action: 'approve' })}
                        disabled={busyId === it.requestId}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2E6FF2] text-white text-[12.5px] font-medium hover:bg-[#2560dc] disabled:opacity-50"
                      >
                        {busyId === it.requestId ? <Spinner size="sm" /> : <Check size={13} />} 승인
                      </button>
                      {canDelegate && (
                        <button
                          onClick={() => setConfirmTarget({ item: it, action: 'delegate' })}
                          disabled={busyId === it.requestId}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#7c5cdb] text-[#7c5cdb] text-[12.5px] font-medium hover:bg-purple-50 disabled:opacity-50"
                        >
                          <Zap size={13} /> 전결
                        </button>
                      )}
                      <button
                        onClick={() => { setRejectTarget(it); setRejectReason(''); }}
                        disabled={busyId === it.requestId}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-foreground-secondary text-[12.5px] font-medium hover:bg-red-50 hover:text-danger hover:border-red-200 disabled:opacity-50"
                      >
                        <X size={13} /> 반려
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 상신함 */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Send size={16} className="text-foreground-secondary" />
              <h2 className="text-[15px] font-semibold text-foreground">내가 올린 결재</h2>
            </div>
            {outbox.length === 0 ? (
              <p className="text-[13px] text-foreground-secondary py-6 text-center border border-border rounded-xl">올린 결재가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {outbox.map((it) => {
                  const s = STATUS_LABEL[it.status] ?? STATUS_LABEL.pending;
                  return (
                    <div key={it.requestId} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-white">
                      <FileText size={14} className="text-foreground-secondary shrink-0" />
                      <Link href={`/documents/${it.documentId}`} className="flex-1 min-w-0 text-[14px] font-medium text-foreground hover:text-[#2E6FF2] truncate">{it.documentTitle}</Link>
                      <span className={`text-[11.5px] font-medium px-2.5 py-1 rounded-full border ${s.cls}`}>
                        {s.text}{it.status === 'pending' ? ` (${it.currentStep}단계)` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* 승인/전결 확인 */}
      <ConfirmDialog
        open={confirmTarget !== null}
        title={confirmTarget?.action === 'delegate' ? '전결로 처리할까요?' : '승인할까요?'}
        description={confirmTarget?.action === 'delegate'
          ? '이 단계에서 결재를 종결합니다. 상위 결재는 생략되고 문서가 완료됩니다. 결재란에 본인 서명과 "전결"이 표기됩니다.'
          : '본인 서명이 결재란에 삽입되고 다음 결재자에게 넘어갑니다.'}
        confirmLabel={confirmTarget?.action === 'delegate' ? '전결' : '승인'}
        cancelLabel="취소"
        loading={busyId !== null}
        onConfirm={async () => { if (confirmTarget) { const t = confirmTarget; setConfirmTarget(null); await decide(t.item, t.action); } }}
        onCancel={() => setConfirmTarget(null)}
      />

      {/* 반려 사유 */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRejectTarget(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-foreground mb-1">반려 사유</h3>
            <p className="text-[12.5px] text-foreground-secondary mb-3">신청자에게 전달됩니다. 문서는 신청자에게 회수됩니다.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="반려 사유를 입력하세요"
              className="w-full px-3 py-2 rounded-lg border border-border text-[13px] focus:border-[#2E6FF2] focus:outline-none resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setRejectTarget(null)} className="px-4 py-2 rounded-lg border border-border text-[13px] text-foreground-secondary hover:bg-surface">취소</button>
              <button
                onClick={async () => { const t = rejectTarget; const r = rejectReason.trim(); setRejectTarget(null); await decide(t, 'reject', r); }}
                className="px-4 py-2 rounded-lg bg-danger text-white text-[13px] font-medium hover:opacity-90"
              >반려</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
