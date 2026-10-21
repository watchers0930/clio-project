'use client';

// 근태관리 화면 조립 (설계서 §1.2) — 탭 전환 + 훅/모달 연결. 계산 로직은 훅·서버에 위임.

import { useMemo, useState } from 'react';
import { CalendarCheck, Plane, Users } from 'lucide-react';
import { Tabs } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useAuthStore } from '@/store/auth-store';
import { useAttendance } from '@/hooks/use-attendance';
import { useLeaveRequests } from '@/hooks/use-leave-requests';
import { useLeaveBalance } from '@/hooks/use-leave-balance';
import { getElectronAttendance } from '@/hooks/use-attendance-heartbeat';
import { AttendanceSummaryCard } from './AttendanceSummaryCard';
import { AttendanceControls } from './AttendanceControls';
import { AttendanceMonthlyList } from './AttendanceMonthlyList';
import { AttendanceCorrectionModal } from './AttendanceCorrectionModal';
import { LeaveBalanceCard } from './LeaveBalanceCard';
import { LeaveRequestList } from './LeaveRequestList';
import { LeaveRequestForm } from './LeaveRequestForm';
import { AdminAttendancePanel } from './AdminAttendancePanel';
import { DesktopAutoLaunchSetting } from './DesktopAutoLaunchSetting';
import { todayKst } from './format';
import type { AttendanceDayView } from './types';

type TabId = 'me' | 'leave' | 'admin';

// 기록이 없는 날짜의 빈 뷰(version:0). 보정 모달에서 수동 생성 제출에 사용(F03).
function makeEmptyDay(workDate: string): AttendanceDayView {
  return {
    workDate,
    effectiveCheckIn: null,
    effectiveCheckOut: null,
    source: 'none',
    firstHeartbeatAt: null,
    lastHeartbeatAt: null,
    heartbeatCount: 0,
    isCorrected: false,
    correctionReason: null,
    isSingleSignal: false,
    isToday: workDate === todayKst(),
    version: 0,
  };
}

export function AttendanceView() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin';
  const isElectron = useMemo(() => getElectronAttendance() !== null, []);

  const [tab, setTab] = useState<TabId>('me');

  const attendance = useAttendance();
  const leave = useLeaveRequests();
  const balance = useLeaveBalance();
  const toast = useToast();

  const [correctDay, setCorrectDay] = useState<AttendanceDayView | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const today =
    attendance.days.find((d) => d.isToday) ??
    attendance.days.find((d) => d.workDate === todayKst()) ??
    null;

  // 무신호 날짜 수동 기록(F03): 이미 있는 날이면 그 행을, 없으면 version:0 빈 날을 보정 모달로 넘긴다.
  const handleAddRecord = (workDate: string) => {
    const existing = attendance.days.find((d) => d.workDate === workDate);
    setCorrectDay(existing ?? makeEmptyDay(workDate));
  };

  // 구간을 바꾸면 조회 대상이 달라지므로 진행 중인 보정 모달 대상을 정리한다(F04).
  const handleRangeChange: typeof attendance.setRange = (next) => {
    setCorrectDay(null);
    attendance.setRange(next);
  };

  const tabs = [
    { id: 'me', label: '내 근태', icon: <CalendarCheck size={15} /> },
    { id: 'leave', label: '휴가', icon: <Plane size={15} /> },
    ...(isAdmin ? [{ id: 'admin', label: '전직원', icon: <Users size={15} /> }] : []),
  ];

  const handleCorrect: typeof attendance.correct = async (workDate, input) => {
    const res = await attendance.correct(workDate, input);
    toast.success('보정이 저장되었습니다.');
    void balance.reload();
    return res;
  };

  const handleCreateLeave: typeof leave.create = async (input) => {
    const res = await leave.create(input);
    toast.success('휴가 초안이 생성되었습니다.');
    void balance.reload();
    return res;
  };

  const handleSubmitLeave = async (id: string) => {
    try {
      await leave.submit(id);
      toast.success('결재에 상신되었습니다.');
      void balance.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '상신에 실패했습니다.');
    }
  };

  const handleDeleteLeave = async (id: string) => {
    try {
      await leave.remove(id);
      toast.success('휴가 신청을 삭제했습니다.');
      void balance.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">근태관리</h1>
        <p className="text-sm text-foreground-secondary">출퇴근 · 휴가 · 연차를 확인하고 관리합니다.</p>
      </div>

      <Tabs tabs={tabs} activeTab={tab} onChange={(id) => setTab(id as TabId)} />

      {tab === 'me' && (
        <div className="flex flex-col gap-4">
          <DesktopAutoLaunchSetting />
          <AttendanceSummaryCard today={today} isElectron={isElectron} />
          <AttendanceControls
            range={attendance.range}
            onRangeChange={handleRangeChange}
            onAddRecord={handleAddRecord}
          />
          <AttendanceMonthlyList
            days={attendance.days}
            loading={attendance.loading}
            error={attendance.error}
            range={attendance.range}
            onCorrect={setCorrectDay}
          />
        </div>
      )}

      {tab === 'leave' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          <div className="flex flex-col gap-4">
            <LeaveBalanceCard balance={balance.balance} loading={balance.loading} error={balance.error} />
            <Button onClick={() => setFormOpen(true)}>휴가 신청</Button>
          </div>
          <LeaveRequestList
            requests={leave.requests}
            loading={leave.loading}
            error={leave.error}
            onSubmit={handleSubmitLeave}
            onDelete={handleDeleteLeave}
          />
        </div>
      )}

      {tab === 'admin' && isAdmin && <AdminAttendancePanel />}

      <AttendanceCorrectionModal
        open={correctDay !== null}
        day={correctDay}
        onClose={() => setCorrectDay(null)}
        onSubmit={async (workDate, input) => {
          await handleCorrect(workDate, input);
        }}
      />
      <LeaveRequestForm open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleCreateLeave} />
    </div>
  );
}
