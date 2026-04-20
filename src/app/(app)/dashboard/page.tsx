'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/auth-store';
import Link from 'next/link';
import {
  FolderOpen, FileText, Users, Search,
  Upload, Sparkles, FilePlus, LayoutTemplate,
  ArrowUpRight, Clock
} from 'lucide-react';
import { Spinner } from '@/components/ui';
import { FILE_TYPE_BADGE, FILE_STATUS_COLOR, ACTION_LABELS, CHART_COLORS } from '@/lib/constants/ui';
import { formatTimeAgo } from '@/lib/utils/format';
import { ExpiryDashboardWidget } from '@/components/expiry/ExpiryDashboardWidget';

interface UserInfo {
  name: string;
  department_id?: string;
}

interface DashboardData {
  total_files: number;
  total_documents: number;
  total_users: number;
  total_templates: number;
  recent_activity: Array<{
    id: string;
    user_id: string;
    action: string;
    details: Record<string, unknown>;
    created_at: string;
  }>;
  file_type_breakdown: Record<string, number>;
  department_breakdown: Record<string, number>;
}

interface RecentFile {
  id: string;
  name: string;
  type: string;
  department: string;
  uploadDate: string;
  status: string;
}

const quickActions = [
  { label: '파일 업로드', href: '/files', icon: Upload },
  { label: 'AI 검색', href: '/search', icon: Sparkles },
  { label: '문서 생성', href: '/documents', icon: FilePlus },
  { label: '템플릿 관리', href: '/templates', icon: LayoutTemplate },
];

// 공통 상수 사용: FILE_TYPE_BADGE, FILE_STATUS_COLOR, ACTION_LABELS, CHART_COLORS (from @/lib/constants/ui)

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return '좋은 아침이에요';
  if (h < 18) return '좋은 오후에요';
  return '좋은 저녁이에요';
}

// formatTimeAgo → @/lib/utils/format 에서 import
// CHART_COLORS → CHART_COLORS from @/lib/constants/ui

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => {
    try {
      const [statsRes, filesRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/files?limit=5'),
      ]);

      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        if (statsJson.success && statsJson.data) {
          setData(statsJson.data);
        }
      }

      if (filesRes.ok) {
        const filesJson = await filesRes.json();
        if (filesJson.files) {
          setRecentFiles(filesJson.files.slice(0, 5));
        }
      }
    } catch {
      /* 조용히 실패 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = [
    { label: '전체 파일', value: data?.total_files ?? 0, icon: FolderOpen },
    { label: '생성 문서', value: data?.total_documents ?? 0, icon: FileText },
    { label: '활성 사용자', value: data?.total_users ?? 0, icon: Users },
    { label: '검색 횟수', value: data?.recent_activity?.filter(a => a.action === 'search').length ?? 0, icon: Search },
  ];

  // 파일 유형 분포 계산
  const breakdown = data?.file_type_breakdown ?? {};
  const totalFileCount = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const typeEntries = Object.entries(breakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);
  const otherCount = totalFileCount - typeEntries.reduce((a, [, v]) => a + v, 0);
  if (otherCount > 0) typeEntries.push(['기타', otherCount]);

  // 활동 로그
  const activities = (data?.recent_activity ?? []).slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Greeting */}
      <div style={{ paddingBottom: 12, borderBottom: '1px solid #e5e5e7' }}>
        <h1 className="text-[24px] font-bold text-foreground">
          {getGreeting()}, <span className="text-primary">{user?.name || '관리자'}님</span>
        </h1>
        <p className="text-[14px] text-muted" style={{ marginTop: 8 }}>
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 20 }}>
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card rounded-2xl border border-border card-hover" style={{ padding: 30 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#f5f5f7] text-[#1d1d1f]">
                  <Icon size={20} strokeWidth={1.5} />
                </div>
              </div>
              {loading ? (
                <div className="flex items-center gap-2">
                  <Spinner size="sm" />
                </div>
              ) : (
                <>
                  <p className="text-[28px] font-bold text-foreground font-num leading-none">{s.value.toLocaleString()}</p>
                  <p className="text-[13px] text-muted mt-2">{s.label}</p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 12 }}>
        {quickActions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.label}
              href={a.href}
              className="flex items-center justify-center gap-3 rounded-xl bg-card border border-border text-[14px] font-medium text-foreground hover:border-primary hover:text-primary transition-all duration-200"
              style={{ padding: '16px 24px' }}
            >
              <Icon size={17} strokeWidth={1.5} />
              {a.label}
            </Link>
          );
        })}
      </div>

      {/* Recent Files */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between" style={{ padding: '22px 24px', borderBottom: '1px solid #e5e5e7' }}>
          <h2 className="text-[16px] font-semibold text-foreground">최근 파일</h2>
          <Link href="/files" className="text-[13px] font-medium text-primary hover:text-primary-dark flex items-center gap-1 transition-colors">
            전체 보기 <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-page-bg">
                <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase tracking-wider">파일명</th>
                <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase tracking-wider">유형</th>
                <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase tracking-wider">부서</th>
                <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase tracking-wider">날짜</th>
                <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase tracking-wider">상태</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted"><Spinner size="sm" /></td></tr>
              ) : recentFiles.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-[14px] text-muted">등록된 파일이 없습니다.</td></tr>
              ) : recentFiles.map((f) => (
                <tr key={f.id} className="hover:bg-page-bg/50 transition-colors border-b border-border last:border-b-0">
                  <td className="px-6 py-4 text-[14px] font-medium text-foreground">{f.name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-bold ${FILE_TYPE_BADGE[f.type] || 'bg-gray-100 text-gray-600'}`}>
                      {f.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[14px] text-muted">{f.department}</td>
                  <td className="px-6 py-4 text-[13px] text-muted font-num">{f.uploadDate}</td>
                  <td className={`px-6 py-4 text-[13px] font-semibold ${FILE_STATUS_COLOR[f.status] || ''}`}>{f.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr]" style={{ gap: 20 }}>
        {/* Activity */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div style={{ padding: '22px 24px', borderBottom: '1px solid #e5e5e7' }}>
            <h2 className="text-[16px] font-semibold text-foreground">최근 활동</h2>
          </div>
          <div style={{ padding: '8px 0' }}>
            {loading ? (
              <div className="flex justify-center py-6"><Spinner size="sm" /></div>
            ) : activities.length === 0 ? (
              <p className="text-[13px] text-muted text-center py-6">활동 기록이 없습니다.</p>
            ) : activities.map((a) => {
              const detail = a.details as Record<string, string>;
              const label = ACTION_LABELS[a.action] ?? a.action;
              const target = detail?.file_name ?? detail?.title ?? detail?.name ?? detail?.query ?? '';
              return (
                <div key={a.id} className="flex items-center" style={{ gap: 16, padding: '12px 24px' }}>
                  <div className="w-8 h-8 rounded-full bg-page-bg flex items-center justify-center flex-shrink-0">
                    <Clock size={14} strokeWidth={1.5} className="text-muted" />
                  </div>
                  <p className="flex-1 text-[13px] text-foreground truncate">
                    {target ? `"${target}" ${label}` : label}
                  </p>
                  <span className="text-[12px] text-muted font-num flex-shrink-0" style={{ marginLeft: 16 }}>
                    {formatTimeAgo(a.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* File Type Distribution */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e5e7' }}>
            <h2 className="text-[16px] font-semibold text-foreground">파일 유형 분포</h2>
          </div>
          <div className="flex items-center justify-center" style={{ gap: 24, padding: '24px' }}>
            <div className="relative flex-shrink-0" style={{ width: 150, height: 150 }}>
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e5e7" strokeWidth="20" />
                {totalFileCount > 0 && (() => {
                  let offset = 0;
                  return typeEntries.map(([label, count], i) => {
                    const pct = count / totalFileCount;
                    const dash = pct * 251.3;
                    const el = (
                      <circle
                        key={label}
                        cx="50" cy="50" r="40" fill="none"
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth="20"
                        strokeDasharray={`${dash} ${251.3 - dash}`}
                        strokeDashoffset={-offset}
                        strokeLinecap="round"
                      />
                    );
                    offset += dash;
                    return el;
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[18px] font-bold text-foreground font-num">{totalFileCount}</span>
                <span className="text-[10px] text-muted">전체</span>
              </div>
            </div>
            <div className="space-y-2.5">
              {typeEntries.map(([label, count], i) => {
                const pct = totalFileCount > 0 ? Math.round((count / totalFileCount) * 100) : 0;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-[12px] text-foreground w-12 font-medium uppercase">{label}</span>
                    <span className="text-[12px] text-muted font-num">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── 차트 섹션 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 20 }}>

        {/* 차트 1: 파일 업로드 추이 (8주 바 차트) */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border overflow-hidden">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e5e7' }}>
            <h2 className="text-[16px] font-semibold text-foreground">파일 업로드 추이</h2>
            <p className="text-[12px] text-muted mt-0.5">최근 8주</p>
          </div>
          <div style={{ padding: '24px' }}>
            {loading ? (
              <div className="flex justify-center py-8"><Spinner size="sm" /></div>
            ) : (() => {
              const trend = data?.upload_trend ?? [];
              const maxCount = Math.max(...trend.map(t => t.count), 1);
              const chartH = 120;
              const barW = 28;
              const gap = 8;
              const totalW = trend.length * (barW + gap) - gap;
              return (
                <div style={{ overflowX: 'auto' }}>
                  <svg width={totalW} height={chartH + 32} style={{ display: 'block', minWidth: '100%' }}>
                    {trend.map((t, i) => {
                      const barH = maxCount > 0 ? Math.max((t.count / maxCount) * chartH, t.count > 0 ? 4 : 0) : 0;
                      const x = i * (barW + gap);
                      const y = chartH - barH;
                      return (
                        <g key={t.week}>
                          <rect x={x} y={y} width={barW} height={barH}
                            rx={4} fill={t.count > 0 ? '#0071e3' : '#e5e5e7'} />
                          {t.count > 0 && (
                            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={10} fill="#1d1d1f" fontWeight="600">{t.count}</text>
                          )}
                          <text x={x + barW / 2} y={chartH + 18} textAnchor="middle" fontSize={10} fill="#a1a1a6">{t.label}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              );
            })()}
          </div>
        </div>

        {/* 차트 2: 부서별 파일 현황 (도넛) */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e5e7' }}>
            <h2 className="text-[16px] font-semibold text-foreground">부서별 파일 현황</h2>
            <p className="text-[12px] text-muted mt-0.5">전체 파일 부서 분포</p>
          </div>
          <div className="flex flex-col items-center" style={{ padding: '24px', gap: 16 }}>
            {loading ? (
              <div className="flex justify-center py-8"><Spinner size="sm" /></div>
            ) : (() => {
              const dept = data?.department_breakdown ?? {};
              const entries = Object.entries(dept).sort(([, a], [, b]) => b - a).slice(0, 4);
              const total = entries.reduce((a, [, v]) => a + v, 0) || 1;
              const colors = ['#0071e3', '#34c759', '#ff9f0a', '#ff3b30'];
              const r = 40; const circ = 2 * Math.PI * r;
              let offset = 0;
              return (
                <>
                  <div className="relative" style={{ width: 140, height: 140 }}>
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e5e7" strokeWidth="18" />
                      {entries.map(([label, count], i) => {
                        const dash = (count / total) * circ;
                        const el = (
                          <circle key={label} cx="50" cy="50" r={r} fill="none"
                            stroke={colors[i % colors.length]} strokeWidth="18"
                            strokeDasharray={`${dash} ${circ - dash}`}
                            strokeDashoffset={-offset} strokeLinecap="round" />
                        );
                        offset += dash;
                        return el;
                      })}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[20px] font-bold text-foreground font-num">{entries.reduce((a, [, v]) => a + v, 0)}</span>
                      <span className="text-[10px] text-muted">전체</span>
                    </div>
                  </div>
                  <div className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {entries.map(([label, count], i) => (
                      <div key={label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                          <span className="text-[12px] text-foreground">{label}</span>
                        </div>
                        <span className="text-[12px] font-semibold font-num text-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* 만료 임박 문서 위젯 */}
      <ExpiryDashboardWidget />

      {/* 차트 3: 부서별 문서 생성량 */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e5e7' }}>
          <h2 className="text-[16px] font-semibold text-foreground">부서별 문서 생성량</h2>
          <p className="text-[12px] text-muted mt-0.5">전체 생성 문서 기준</p>
        </div>
        <div style={{ padding: '24px' }}>
          {loading ? (
            <div className="flex justify-center py-6"><Spinner size="sm" /></div>
          ) : (() => {
            const breakdown = data?.doc_dept_breakdown ?? {};
            const entries = Object.entries(breakdown).sort(([, a], [, b]) => b - a).slice(0, 6);
            const maxVal = Math.max(...entries.map(([, v]) => v), 1);
            if (entries.length === 0) return <p className="text-sm text-muted text-center py-4">데이터가 없습니다.</p>;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {entries.map(([dept, count], i) => (
                  <div key={dept} className="flex items-center gap-3">
                    <span className="text-[12px] text-muted w-20 truncate text-right shrink-0">{dept}</span>
                    <div className="flex-1 bg-[#f5f5f7] rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${(count / maxVal) * 100}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                    </div>
                    <span className="text-[12px] font-semibold font-num text-foreground w-6 text-right shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
