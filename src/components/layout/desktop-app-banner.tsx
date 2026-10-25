'use client';

import { useSyncExternalStore } from 'react';
import { Monitor, Download } from 'lucide-react';
import { getElectronAttendance } from '@/hooks/use-attendance-heartbeat';

// 설치 파일 다운로드 URL(.dmg/.exe)은 빌드·호스팅 후 env로 주입한다.
// OS별로 분리: macOS=dmg, Windows=exe. 해당 OS URL 미설정이면 배너를 노출하지 않는다(안전).
const MAC_URL = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL ?? '';
const WIN_URL = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL_WIN ?? '';

// 방문자 OS 판정('win' | 'mac' | ''). Electron 앱 내부거나 데스크탑앱 미지원 OS면 빈 문자열.
// getSnapshot 규칙상 동일 환경에서 항상 같은 string을 돌려줘야 하므로 navigator만 참조한다.
// iPad/iPhone(iPadOS UA는 'Macintosh' 미포함)·모바일은 자연히 '' 로 떨어져 배너가 숨겨진다.
function getOS(): 'win' | 'mac' | '' {
  if (getElectronAttendance()) return '';
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'win';
  if (/Macintosh/i.test(ua)) return 'mac';
  return '';
}

/**
 * 데스크탑앱 설치 유도 배너.
 * - 웹(브라우저)에서만 노출하고, Electron 앱 내부에서는 숨긴다(이미 설치됨).
 * - 방문자 OS를 감지해 Windows=exe / macOS=dmg 설치 파일로 연결한다.
 * - 해당 OS 다운로드 URL 미설정 시 숨긴다(안전).
 * - 사이드바 접힘(collapsed, 데스크탑) 시 숨긴다.
 * ⚠️ 브라우저 보안상 "자동 설치"는 불가능하다 — 다운로드 후 사용자가 직접 설치한다.
 *   설치 후에는 부팅 시 자동 실행(setAutoLaunch)·출퇴근 자동 기록(heartbeat)이 동작한다.
 */
export function DesktopAppBanner({ collapsed, mobile }: { collapsed?: boolean; mobile?: boolean }) {
  // 서버 렌더에서는 숨김, 클라이언트에서 웹 환경(Electron 아님)일 때 OS를 판정한다.
  // useSyncExternalStore로 SSR hydration mismatch 없이 판정한다.
  const os = useSyncExternalStore(
    () => () => {},
    () => getOS(),
    () => '' as const,
  );

  const url = os === 'win' ? WIN_URL : os === 'mac' ? MAC_URL : '';
  if (!url || (collapsed && !mobile)) return null;

  const osLabel = os === 'win' ? 'Windows' : 'Mac';

  return (
    <a
      href={url}
      download
      target="_blank"
      rel="noopener noreferrer"
      className="mx-3 mb-3 flex items-center gap-2.5 rounded-xl bg-primary/15 px-3 py-2.5 text-white transition-colors hover:bg-primary/25"
    >
      <Monitor size={16} className="flex-shrink-0 text-primary-light" />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold">데스크탑앱 설치 ({osLabel})</p>
        <p className="text-[10px] text-white/70">설치하면 출퇴근이 자동 기록돼요</p>
      </div>
      <Download size={15} className="flex-shrink-0 text-white/70" />
    </a>
  );
}
