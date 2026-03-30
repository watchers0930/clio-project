'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FolderOpen, FileText, Users, Search,
  Upload, Sparkles, FilePlus, LayoutTemplate,
  ArrowUpRight, Clock, Loader2
} from 'lucide-react';

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

const typeColors: Record<string, string> = {
  PDF: 'bg-[#f5f5f7] text-[#1d1d1f]',
  DOCX: 'bg-[#f5f5f7] text-[#1d1d1f]',
  XLSX: 'bg-[#f5f5f7] text-[#1d1d1f]',
  PPTX: 'bg-[#f5f5f7] text-[#1d1d1f]',
  MD: 'bg-[#f5f5f7] text-[#1d1d1f]',
};

const statusColors: Record<string, string> = {
  '완료': 'text-[#30d158]',
  '처리중': 'text-[#ff9f0a]',
  '오류': 'text-[#ff3b30]',
};

const ACTION_LABELS: Record<string, string> = {
  'file.upload': '파일을 업로드했습니다.',
  'file.delete': '파일을 삭제했습니다.',
  'document.create': '문서를 생성했습니다.',
  'document.delete': '문서를 삭제했습니다.',
  'template.create': '템플릿을 생성했습니다.',
  'search': '검색을 수행했습니다.',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return '좋은 아침이에요';
  if (h < 18) return '좋은 오후에요';
  return '좋은 저녁이에요';
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

const PIE_COLORS = ['#1d1d1f', '#6e6e73', '#0071e3', '#a1a1a6', '#d2d2d7'];

export default function DashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
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
    try {
      const stored = localStorage.getItem('clio_user');
      if (stored) setUser(JSON.parse(stored));
    } catch { /* ignore */ }
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
                  <Loader2 size={16} className="animate-spin text-muted" />
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
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted"><Loader2 size={20} className="animate-spin mx-auto" /></td></tr>
              ) : recentFiles.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-[14px] text-muted">등록된 파일이 없습니다.</td></tr>
              ) : recentFiles.map((f) => (
                <tr key={f.id} className="hover:bg-page-bg/50 transition-colors border-b border-border last:border-b-0">
                  <td className="px-6 py-4 text-[14px] font-medium text-foreground">{f.name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-bold ${typeColors[f.type] || 'bg-gray-100 text-gray-600'}`}>
                      {f.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[14px] text-muted">{f.department}</td>
                  <td className="px-6 py-4 text-[13px] text-muted font-num">{f.uploadDate}</td>
                  <td className={`px-6 py-4 text-[13px] font-semibold ${statusColors[f.status] || ''}`}>{f.status}</td>
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
              <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-muted" /></div>
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
                        stroke={PIE_COLORS[i % PIE_COLORS.length]}
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
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-[12px] text-foreground w-12 font-medium uppercase">{label}</span>
                    <span className="text-[12px] text-muted font-num">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
