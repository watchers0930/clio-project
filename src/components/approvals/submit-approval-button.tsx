'use client';

import { useState } from 'react';
import { Stamp, ArrowUp, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { useToast } from '@/components/ui/toast';

interface LineStep { step_order: number; name: string; rank_title: string; }

interface Props {
  documentId: string;
  status?: string | null;   // 문서 status: in_approval | approved | rejected | 그 외
  onSubmitted?: () => void;
}

export function SubmitApprovalButton({ documentId, status, onSubmitted }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [line, setLine] = useState<LineStep[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  // 이미 결재 흐름에 있는 문서는 상태 배지만 표시
  if (status === 'in_approval') {
    return <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-[12.5px] font-medium border border-amber-200"><Clock size={13} /> 결재 진행중</span>;
  }
  if (status === 'approved') {
    return <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-[12.5px] font-medium border border-emerald-200"><CheckCircle2 size={13} /> 결재 완료</span>;
  }

  const openPreview = async () => {
    setLoadingPreview(true);
    setPreviewOpen(true);
    try {
      const res = await fetch(`/api/approvals/preview?documentId=${documentId}`);
      const data = await res.json();
      if (res.ok && data.success) setLine(data.line ?? []);
      else { toast.error(data.error ?? '결재선을 불러오지 못했습니다.'); setPreviewOpen(false); }
    } catch {
      toast.error('결재선 조회 중 오류가 발생했습니다.');
      setPreviewOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error ?? '상신에 실패했습니다.'); return; }
      toast.success('결재를 올렸습니다. 결재자에게 알림이 전송됩니다.');
      setPreviewOpen(false);
      onSubmitted?.();
    } catch {
      toast.error('상신 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = line.length >= 2;

  return (
    <>
      <button
        onClick={openPreview}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2E6FF2] text-white text-[13px] font-medium hover:bg-[#2560dc] transition-colors"
      >
        {status === 'rejected' ? <ArrowUp size={14} /> : <Stamp size={14} />}
        {status === 'rejected' ? '재상신' : '결재 올리기'}
      </button>

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !submitting && setPreviewOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-semibold text-foreground mb-1">결재선 확인</h3>
            <p className="text-[12.5px] text-foreground-secondary mb-4">조직도에 따라 아래 순서로 결재가 올라갑니다.</p>

            {loadingPreview ? (
              <div className="flex items-center justify-center h-24"><Spinner size="md" /></div>
            ) : line.length === 0 ? (
              <p className="text-[13px] text-foreground-secondary py-6 text-center">결재선을 만들 수 없습니다. 관리자에게 조직도(직속 상위자) 설정을 요청하세요.</p>
            ) : (
              <div className="flex flex-col gap-1.5 mb-4">
                {line.map((s, i) => (
                  <div key={s.step_order} className="flex items-center gap-2.5 text-[13px]">
                    <span className="text-[10.5px] font-bold text-white bg-[#2E6FF2] px-2 py-0.5 rounded min-w-[44px] text-center">{s.rank_title}</span>
                    <span className="font-medium text-foreground">{s.name}</span>
                    {i === 0 && <span className="text-[11.5px] text-foreground-secondary">· 상신(본인)</span>}
                    {i < line.length - 1 && <span className="text-foreground-secondary ml-auto">↓</span>}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setPreviewOpen(false)} disabled={submitting} className="px-4 py-2 rounded-lg border border-border text-[13px] text-foreground-secondary hover:bg-surface disabled:opacity-50">취소</button>
              <button
                onClick={submit}
                disabled={submitting || !canSubmit}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2E6FF2] text-white text-[13px] font-medium hover:bg-[#2560dc] disabled:opacity-50"
              >
                {submitting ? <Spinner size="sm" /> : <Stamp size={14} />} 결재 올리기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
