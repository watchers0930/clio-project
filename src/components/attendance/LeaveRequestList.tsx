'use client';

// 휴가 신청 목록 — 종류/기간/일수/상태/문서·결재 링크 + 초안 액션 (설계서 §4.3, §5.5)

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Send, Link2, Stamp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { fmtDays } from './format';
import {
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  type LeaveRequestView,
  type LeaveStatus,
} from './types';

interface Props {
  requests: LeaveRequestView[];
  loading: boolean;
  error: string | null;
  onSubmit: (id: string) => Promise<void>;
}

const STATUS_VARIANT: Record<LeaveStatus, BadgeVariant> = {
  draft: 'default',
  pending: 'info',
  approved: 'success',
  rejected: 'danger',
};

function periodText(r: LeaveRequestView): string {
  if (r.leaveType === 'half_day') {
    return `${r.startDate} ${r.halfDaySlot === 'am' ? '오전' : '오후'}`;
  }
  if (r.startDate === r.endDate) return r.startDate;
  return `${r.startDate} ~ ${r.endDate}`;
}

// '휴가원 작성' → 문서 생성 모달 진입 URL.
// 실제 휴가원 템플릿은 이름으로 해석하고(create=true), 신청 내용을 프리필한다.
// leave_type·기간·반차·사유는 서버가 생성 문서를 이 초안에 자동 연결할 때의 매칭 키다.
function leaveDocUrl(r: LeaveRequestView): string {
  const params = new URLSearchParams({
    create: 'true',
    templateName: '휴가원',
    leaveRequestId: r.id,
    leave_type: r.leaveType,
    leave_start_date: r.startDate,
    leave_end_date: r.endDate,
  });
  if (r.halfDaySlot) params.set('half_day_slot', r.halfDaySlot);
  if (r.reason) params.set('leave_reason', r.reason);
  return `/documents?${params.toString()}`;
}

export function LeaveRequestList({ requests, loading, error, onSubmit }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const submit = async (id: string) => {
    setBusyId(id);
    try {
      await onSubmit(id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground">휴가 신청 현황</h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : error ? (
        <p className="px-5 py-10 text-center text-sm text-danger">{error}</p>
      ) : requests.length === 0 ? (
        <EmptyState iconType="inbox" title="신청 내역이 없습니다" description="휴가 신청 버튼으로 새 신청을 만들어보세요." />
      ) : (
        <ul className="divide-y divide-border">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
              <Badge variant="info">{LEAVE_TYPE_LABEL[r.leaveType]}</Badge>
              <div className="flex-1 min-w-[140px]">
                <p className="text-sm font-medium text-foreground tabular-nums">{periodText(r)}</p>
                <p className="text-xs text-foreground-secondary">
                  차감 {fmtDays(r.deductDays)}
                  {r.requestedDays !== r.deductDays && ` · 신청 ${fmtDays(r.requestedDays)}`}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[r.status]}>{LEAVE_STATUS_LABEL[r.status]}</Badge>

              <div className="flex items-center gap-1.5">
                {r.documentId && (
                  <IconLink
                    icon={<FileText size={13} />}
                    label="문서"
                    onClick={() => router.push(`/documents/${r.documentId}`)}
                  />
                )}
                {r.approvalRequestId && (
                  <IconLink icon={<Stamp size={13} />} label="결재함" onClick={() => router.push('/approvals')} />
                )}

                {r.status === 'draft' && !r.documentId && (
                  <IconLink
                    icon={<Link2 size={13} />}
                    label="휴가원 작성"
                    onClick={() => router.push(leaveDocUrl(r))}
                  />
                )}
                {(r.status === 'draft' || r.status === 'rejected') && r.documentId && (
                  <button
                    onClick={() => submit(r.id)}
                    disabled={busyId === r.id}
                    className="inline-flex items-center gap-1 rounded-sm bg-primary px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50 cursor-pointer"
                  >
                    {busyId === r.id ? <Spinner size="sm" variant="white" /> : <Send size={13} />}
                    {r.status === 'rejected' ? '재상신' : '상신'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function IconLink({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-sm px-2 py-1.5 text-xs text-foreground-secondary transition-colors hover:bg-surface-secondary hover:text-foreground cursor-pointer"
    >
      {icon}
      {label}
    </button>
  );
}
