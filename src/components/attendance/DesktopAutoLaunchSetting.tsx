'use client';

// 데스크탑 자동실행 ON/OFF (설계서 §4.1) — Electron에서만 노출, 웹에서는 렌더하지 않음.

import { useCallback, useEffect, useId, useState } from 'react';
import { Power } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { getElectronAttendance } from '@/hooks/use-attendance-heartbeat';

function normalize(v: { openAtLogin: boolean; supported?: boolean } | boolean): {
  openAtLogin: boolean;
  supported: boolean;
} {
  if (typeof v === 'boolean') return { openAtLogin: v, supported: true };
  return { openAtLogin: v.openAtLogin, supported: v.supported ?? true };
}

export function DesktopAutoLaunchSetting() {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = getElectronAttendance();
  const hasControl = Boolean(api?.getAutoLaunch && api?.setAutoLaunch);
  const labelId = useId();
  const errorId = useId();

  const refresh = useCallback(async () => {
    if (!api?.getAutoLaunch) {
      setLoading(false);
      return;
    }
    try {
      const v = normalize(await api.getAutoLaunch());
      setEnabled(v.openAtLogin);
      setSupported(v.supported);
    } catch {
      setError('자동실행 설정을 읽지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 설치 앱이 아니거나 브릿지가 없으면 숨김
  if (!hasControl) return null;

  const toggle = async () => {
    if (!api?.setAutoLaunch || saving) return;
    setSaving(true);
    setError(null);
    const next = !enabled;
    try {
      const v = normalize(await api.setAutoLaunch(next));
      // OS가 실제로 조회한 값을 반영(설정 실패 시 이전 값 유지될 수 있음)
      setEnabled(v.openAtLogin);
      setSupported(v.supported);
      if (v.openAtLogin !== next) setError('OS에 자동실행 설정을 적용하지 못했습니다.');
    } catch {
      setError('자동실행 설정을 변경하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-foreground-secondary">
            <Power size={18} />
          </span>
          <div>
            <p id={labelId} className="text-sm font-medium text-foreground">OS 로그인 시 자동실행</p>
            <p className="text-xs text-foreground-secondary">
              컴퓨터 로그인 후 앱이 자동 실행되어 출근이 기록됩니다.
            </p>
            {!supported && <p className="mt-1 text-xs text-warning">이 환경에서는 자동실행을 지원하지 않습니다.</p>}
            {error && <p id={errorId} className="mt-1 text-xs text-danger">{error}</p>}
          </div>
        </div>

        {loading ? (
          <Spinner size="sm" />
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-labelledby={labelId}
            aria-describedby={error ? errorId : undefined}
            disabled={saving || !supported}
            onClick={toggle}
            className={
              'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 cursor-pointer ' +
              (enabled ? 'bg-primary' : 'bg-border')
            }
          >
            <span
              className={
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ' +
                (enabled ? 'translate-x-[22px]' : 'translate-x-0.5')
              }
            />
          </button>
        )}
      </CardContent>
    </Card>
  );
}
