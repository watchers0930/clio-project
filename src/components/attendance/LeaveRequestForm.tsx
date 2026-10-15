'use client';

// 휴가 신청 폼 — 종류/기간/반차/사유 입력 → 초안 생성(POST) (설계서 §4.3, §5)
// 서버가 근무일·차감량·정책버전·스냅샷을 계산하므로, 폼은 입력만 보내고 결과를 표시한다.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { todayKst } from './format';
import {
  LEAVE_TYPE_LABEL,
  type HalfDaySlot,
  type LeaveCreateInput,
  type LeaveRequestView,
  type LeaveType,
} from './types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: LeaveCreateInput) => Promise<LeaveRequestView>;
}

const TYPES: LeaveType[] = ['annual', 'monthly', 'half_day', 'menstrual'];
const SINGLE_DAY: LeaveType[] = ['half_day', 'menstrual'];
const REASON_MAX = 1000;

function newKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `leave-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

export function LeaveRequestForm({ open, onClose, onSubmit }: Props) {
  const [leaveType, setLeaveType] = useState<LeaveType>('annual');
  const [startDate, setStartDate] = useState(todayKst());
  const [endDate, setEndDate] = useState(todayKst());
  const [halfDaySlot, setHalfDaySlot] = useState<HalfDaySlot>('am');
  const [reason, setReason] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 폼이 열릴 때마다 증가하는 세대값. 제출 중 닫았다가 다시 열면 이전 요청 완료가
  // 새 폼을 닫거나 옛 오류를 새 폼에 남기지 않도록 완료 처리를 한정한다(F09).
  const openGen = useRef(0);

  const isSingleDay = SINGLE_DAY.includes(leaveType);

  useEffect(() => {
    if (open) {
      setLeaveType('annual');
      setStartDate(todayKst());
      setEndDate(todayKst());
      setHalfDaySlot('am');
      setReason('');
      setIdempotencyKey(newKey()); // 폼 1회 열림 = 1 멱등키 (재시도 시 동일 키 유지)
      setError(null);
      setSubmitting(false);
      openGen.current += 1;
    }
  }, [open]);

  // 단일 근무일 종류는 종료일을 시작일로 고정
  useEffect(() => {
    if (isSingleDay) setEndDate(startDate);
  }, [isSingleDay, startDate]);

  const input = useMemo<LeaveCreateInput>(
    () => ({
      leaveType,
      startDate,
      endDate: isSingleDay ? startDate : endDate,
      ...(leaveType === 'half_day' ? { halfDaySlot } : {}),
      ...(reason.trim() ? { reason: reason.trim() } : {}),
      idempotencyKey,
    }),
    [leaveType, startDate, endDate, isSingleDay, halfDaySlot, reason, idempotencyKey],
  );

  const run = async () => {
    setError(null);
    if (!startDate || (!isSingleDay && !endDate)) {
      setError('날짜를 입력해주세요.');
      return;
    }
    if (!isSingleDay && endDate < startDate) {
      setError('종료일은 시작일 이후여야 합니다.');
      return;
    }
    const gen = openGen.current;
    setSubmitting(true);
    try {
      await onSubmit(input);
      if (gen === openGen.current) onClose();
    } catch (e) {
      if (gen === openGen.current) setError(e instanceof Error ? e.message : '신청에 실패했습니다.');
    } finally {
      if (gen === openGen.current) setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="휴가 신청" size="md">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-medium text-foreground">휴가 종류</span>
          <div className="grid grid-cols-4 gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setLeaveType(t)}
                className={
                  'h-10 rounded-md border text-sm font-medium transition-colors cursor-pointer ' +
                  (leaveType === t
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-foreground-secondary hover:bg-surface-secondary')
                }
              >
                {LEAVE_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2.5 text-sm">
            <span className="font-medium text-foreground">{isSingleDay ? '날짜' : '시작일'}</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-11 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {!isSingleDay && (
            <div className="flex flex-col gap-2.5 text-sm">
              <span className="font-medium text-foreground">종료일</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-11 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
        </div>

        {leaveType === 'half_day' && (
          <div className="flex flex-col gap-2.5">
            <span className="text-sm font-medium text-foreground">반차 구분</span>
            <div className="grid grid-cols-2 gap-2">
              {(['am', 'pm'] as HalfDaySlot[]).map((slot) => (
                <button
                  key={slot}
                  onClick={() => setHalfDaySlot(slot)}
                  className={
                    'h-10 rounded-md border text-sm font-medium transition-colors cursor-pointer ' +
                    (halfDaySlot === slot
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-foreground-secondary hover:bg-surface-secondary')
                  }
                >
                  {slot === 'am' ? '오전 반차' : '오후 반차'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5 text-sm">
          <span className="font-medium text-foreground">사유</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
            rows={3}
            placeholder="휴가 사유 (선택)"
            className="resize-none rounded-md border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <p className="rounded-md bg-surface-secondary px-3 py-2 text-[11px] leading-relaxed text-foreground-tertiary">
          근무일·차감 일수·잔여는 신청 시 서버에서 계산됩니다. 초안 생성 후 휴가원 문서를 연결하면 결재 상신할 수
          있습니다.
        </p>

        {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button size="sm" loading={submitting} onClick={run}>
            초안 생성
          </Button>
        </div>
      </div>
    </Modal>
  );
}
