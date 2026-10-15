'use client';

// 출퇴근 보정 모달 — 시각·사유 입력 후 PATCH 제출 (설계서 §4.2, §5)
// 시각은 KST 벽시계(HH:mm)로 입력받아 workDate 기준 ISO(UTC)로 변환한다.
// → 서버의 "보정 시각 KST 날짜가 workDate와 일치" 검증을 항상 통과한다(KST=UTC+9, DST 없음).

import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { fmtWorkDate } from './format';
import type { AttendanceCorrectionInput, AttendanceDayView } from './types';

interface Props {
  open: boolean;
  day: AttendanceDayView | null;
  onClose: () => void;
  onSubmit: (workDate: string, input: AttendanceCorrectionInput) => Promise<void>;
}

const REASON_MAX = 500;

function isoToKstTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

function kstTimeToIso(workDate: string, time: string): string | null {
  if (!time) return null;
  const [y, m, d] = workDate.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null;
  return new Date(Date.UTC(y, m - 1, d, hh - 9, mm)).toISOString();
}

export function AttendanceCorrectionModal({ open, day, onClose, onSubmit }: Props) {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 모달이 열릴 때마다 증가하는 세대값. 제출 중 닫았다가 다시 열면(또는 다른 날짜로 재진입)
  // 이전 요청 완료가 새 폼을 닫거나 새 폼에 옛 오류를 남기지 않도록 완료 처리를 한정한다(F09).
  const openGen = useRef(0);

  useEffect(() => {
    if (open && day) {
      setCheckIn(isoToKstTime(day.effectiveCheckIn));
      setCheckOut(isoToKstTime(day.effectiveCheckOut));
      setReason('');
      setError(null);
      setSubmitting(false);
      openGen.current += 1;
    }
  }, [open, day]);

  if (!day) return null;

  const run = async (mode: 'correct' | 'restore') => {
    setError(null);
    if (!reason.trim()) {
      setError('보정 사유를 입력해주세요.');
      return;
    }
    if (mode === 'correct' && checkIn && checkOut && checkOut < checkIn) {
      setError('퇴근 시각은 출근 시각 이후여야 합니다.');
      return;
    }
    const input: AttendanceCorrectionInput =
      mode === 'restore'
        ? { mode: 'restore', reason: reason.trim(), version: day.version }
        : {
            mode: 'correct',
            checkInAt: kstTimeToIso(day.workDate, checkIn),
            checkOutAt: kstTimeToIso(day.workDate, checkOut),
            reason: reason.trim(),
            version: day.version,
          };
    const gen = openGen.current;
    setSubmitting(true);
    try {
      await onSubmit(day.workDate, input);
      if (gen === openGen.current) onClose();
    } catch (e) {
      if (gen === openGen.current) setError(e instanceof Error ? e.message : '보정에 실패했습니다.');
    } finally {
      if (gen === openGen.current) setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="출퇴근 보정" description={fmtWorkDate(day.workDate)} size="md">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">출근 시각</span>
            <input
              type="time"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="h-11 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">퇴근 시각</span>
            <input
              type="time"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="h-11 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">
            보정 사유 <span className="text-danger">*</span>
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
            rows={3}
            placeholder="예: 절전으로 퇴근 신호 누락"
            className="resize-none rounded-md border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="self-end text-[11px] text-foreground-tertiary">
            {reason.length}/{REASON_MAX}
          </span>
        </label>

        {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RotateCcw size={14} />}
            disabled={submitting || !day.isCorrected}
            onClick={() => run('restore')}
            title={day.isCorrected ? '보정값을 지우고 자동 기록으로 복원' : '보정된 기록이 없습니다'}
          >
            자동값 복원
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
              취소
            </Button>
            <Button size="sm" loading={submitting} onClick={() => run('correct')}>
              저장
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
