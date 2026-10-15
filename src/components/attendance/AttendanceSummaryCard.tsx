'use client';

// 오늘 출근/퇴근 기준·마지막 heartbeat·연결 상태 요약 (설계서 §5.5 상단)

import { useEffect, useState } from 'react';
import { LogIn, LogOut, Activity, Wifi, WifiOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fmtTime, fmtDateTime } from './format';
import type { AttendanceDayView } from './types';

interface Props {
  today: AttendanceDayView | null;
  isElectron: boolean;
}

// 생존 tick은 3분 간격. 2회(6분) 이상 신호가 없으면 연결 끊김으로 본다(설계 §4.1).
const LIVE_WINDOW_MS = 6 * 60_000;

export function AttendanceSummaryCard({ today, isElectron }: Props) {
  // 경과 시간 기준 연결 판정을 위해 주기적으로 '지금'을 갱신한다(네트워크 호출 없음).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isElectron) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [isElectron]);

  // heartbeatCount가 아니라 '마지막 신호 경과 시간'으로 판정한다.
  // → 하루 1회만 신호가 와도 6분 지나면 '신호 대기 중', 신호가 끊기면 즉시 반영.
  const lastAt = today?.lastHeartbeatAt ? Date.parse(today.lastHeartbeatAt) : NaN;
  const connected = isElectron && !Number.isNaN(lastAt) && now - lastAt < LIVE_WINDOW_MS;

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">오늘 근태</h3>
          {isElectron ? (
            <Badge variant={connected ? 'success' : 'default'} className="gap-1">
              {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {connected ? '자동 기록 연결됨' : '신호 대기 중'}
            </Badge>
          ) : (
            <Badge variant="info">웹 · 자동 기록은 데스크탑 앱</Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Metric icon={<LogIn size={16} />} label="출근 기준" value={fmtTime(today?.effectiveCheckIn)} />
          <Metric
            icon={<LogOut size={16} />}
            label={today?.isToday ? '퇴근 기준 (갱신 중)' : '퇴근 기준'}
            value={fmtTime(today?.effectiveCheckOut)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-xs text-foreground-secondary">
          <span className="inline-flex items-center gap-1.5">
            <Activity size={13} />
            마지막 신호 {fmtDateTime(today?.lastHeartbeatAt)}
          </span>
          {today?.isCorrected && <Badge variant="warning">보정됨</Badge>}
          {today?.isSingleSignal && <Badge variant="default">단일 신호</Badge>}
          {today && today.source === 'none' && <span>오늘 기록 없음</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-surface-secondary px-4 py-3">
      <span className="inline-flex items-center gap-1.5 text-xs text-foreground-secondary">
        {icon}
        {label}
      </span>
      <span className="text-xl font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
}
