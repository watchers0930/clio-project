'use client';

import { useEffect, useState } from 'react';
import { Mail, RefreshCw, Unlink, CheckCircle, AlertCircle } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { useToast } from '@/components/ui/toast';

interface GmailStatus {
  connected: boolean;
  email?: string;
  lastSyncedAt?: string;
  syncEnabled?: boolean;
  connectedAt?: string;
}

interface GmailSectionProps {
  successParam?: string;
  errorParam?: string;
  msgParam?: string;
}

export function GmailSection({ successParam, errorParam, msgParam }: GmailSectionProps) {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const toast = useToast();

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/gmail/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (successParam === 'connected') toast.success('Gmail이 성공적으로 연결되었습니다.');
    if (errorParam === 'cancelled') toast.error('Gmail 연결이 취소되었습니다.');
    if (errorParam === 'server') toast.error(msgParam ? `연결 오류: ${msgParam}` : 'Gmail 연결 중 오류가 발생했습니다.');
    if (errorParam === 'session_expired') toast.error('세션이 만료됐습니다. 다시 시도해 주세요.');
    if (errorParam === 'no_token') toast.error('Google 토큰을 받지 못했습니다. 다시 시도해 주세요.');
  }, [successParam, errorParam]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/gmail/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(`동기화 완료 — ${data.synced}개 이메일이 추가되었습니다.`);
        await loadStatus();
      } else {
        toast.error(data.error ?? '동기화 실패');
      }
    } catch {
      toast.error('동기화 중 오류가 발생했습니다.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Gmail 연결을 해제하면 동기화된 이메일 데이터가 모두 삭제됩니다. 계속하시겠습니까?')) return;
    setDisconnecting(true);
    try {
      await fetch('/api/gmail/disconnect', { method: 'DELETE' });
      toast.success('Gmail 연결이 해제되었습니다.');
      setStatus({ connected: false });
    } catch {
      toast.error('연결 해제 중 오류가 발생했습니다.');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1B1F2B] flex items-center justify-center">
            <Mail size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">Gmail 연동</h2>
            <p className="text-[12px] text-foreground-secondary">Gmail을 연결하면 이메일이 AI 검색에 포함됩니다.</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        {status?.connected ? (
          <div className="flex flex-col" style={{ gap: '16px' }}>
            {/* 연결 상태 */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
              <CheckCircle size={18} className="text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-green-800">연결됨</p>
                <p className="text-[12px] text-green-700 truncate">{status.email}</p>
              </div>
            </div>

            {/* 마지막 동기화 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-surface border border-border">
                <p className="text-[11px] text-foreground-secondary mb-1">마지막 동기화</p>
                <p className="text-[13px] font-medium text-foreground">
                  {status.lastSyncedAt
                    ? new Date(status.lastSyncedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '아직 동기화 안 됨'}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-surface border border-border">
                <p className="text-[11px] text-foreground-secondary mb-1">연결일</p>
                <p className="text-[13px] font-medium text-foreground">
                  {status.connectedAt
                    ? new Date(status.connectedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                    : '-'}
                </p>
              </div>
            </div>

            {/* 안내 */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <AlertCircle size={14} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-[12px] text-blue-700">최근 30일 이메일(최대 50개)을 가져와 AI 검색에 포함합니다. 이미 동기화된 이메일은 중복 추가되지 않습니다.</p>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2E6FF2] text-white text-[13px] font-medium hover:bg-[#2560dc] disabled:opacity-50 transition-colors"
              >
                {syncing ? <Spinner size="sm" /> : <RefreshCw size={14} />}
                {syncing ? '동기화 중...' : '지금 동기화'}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-foreground-secondary text-[13px] font-medium hover:bg-surface disabled:opacity-50 transition-colors"
              >
                {disconnecting ? <Spinner size="sm" /> : <Unlink size={14} />}
                연결 해제
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="p-5 rounded-xl bg-surface border border-border mb-5">
              <h3 className="text-[13px] font-semibold text-foreground mb-3">연결하면 이런 것이 가능합니다</h3>
              <ul className="space-y-2 text-[13px] text-foreground-secondary">
                <li className="flex items-center gap-2"><CheckCircle size={13} className="text-[#2E6FF2]" /> AI 검색에서 이메일 내용 검색</li>
                <li className="flex items-center gap-2"><CheckCircle size={13} className="text-[#2E6FF2]" /> 첨부파일 정보를 검색 컨텍스트에 포함</li>
                <li className="flex items-center gap-2"><CheckCircle size={13} className="text-[#2E6FF2]" /> 최근 30일 이메일 자동 동기화</li>
              </ul>
            </div>

            <a
              href="/api/auth/google"
              className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white border-2 border-border text-[14px] font-semibold text-foreground hover:bg-surface hover:border-[#2E6FF2] transition-all shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google 계정으로 연결하기
            </a>

            <p className="mt-4 text-[11px] text-foreground-secondary">
              연결 시 이메일 읽기 권한만 요청합니다. 이메일 전송·수정·삭제는 불가합니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
