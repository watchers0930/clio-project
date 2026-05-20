import Link from 'next/link';
import { ArrowUpRight, Clock, TrendingUp, BarChart3, PieChart, Building2 } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { FILE_TYPE_BADGE, ACTION_LABELS, CHART_COLORS } from '@/lib/constants/ui';
import { formatTimeAgo } from '@/lib/utils/format';
import { ExpiryDashboardWidget } from '@/components/expiry/ExpiryDashboardWidget';

interface RecentFile {
  id: string;
  name: string;
  type: string;
  department: string;
  uploadDate: string;
  status: string;
}

interface DashboardData {
  role?: string;
  department_name?: string;
  scope_label?: string;
  scope_hint?: string;
  accessible_department_count?: number;
  recent_activity: Array<{
    id: string;
    action: string;
    details: Record<string, unknown>;
    created_at: string;
  }>;
  file_type_breakdown: Record<string, number>;
  department_breakdown: Record<string, number>;
  upload_trend?: Array<{ week: string; label: string; count: number }>;
  doc_dept_breakdown?: Record<string, number>;
  derived_document_count?: number;
}

export function DashboardMidSection({ recentFiles, loading }: { recentFiles: RecentFile[]; data: DashboardData | null; loading: boolean }) {
  return (
    <RecentFilesTable recentFiles={recentFiles} loading={loading} />
  );
}

export function DashboardBottomSection({
  data,
  loading,
}: {
  data: DashboardData | null;
  loading: boolean;
}) {
  const breakdown = data?.file_type_breakdown ?? {};
  const totalFileCount = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const typeEntries = Object.entries(breakdown).sort(([, a], [, b]) => b - a).slice(0, 4);
  const otherCount = totalFileCount - typeEntries.reduce((a, [, v]) => a + v, 0);
  if (otherCount > 0) typeEntries.push(['기타', otherCount]);
  const activities = (data?.recent_activity ?? []).slice(0, 5);

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:gap-6 lg:grid-cols-[3fr_2fr]">
        {/* 최근 활동 */}
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
          <div className="border-b border-border/60 px-5 py-5 sm:px-7 sm:py-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-secondary">
                <Clock size={15} className="text-foreground-secondary" />
              </div>
              <h2 className="text-[15px] font-bold text-foreground">최근 활동</h2>
            </div>
          </div>
          <div className="divide-y divide-border/40">
            {loading ? (
              <div className="flex justify-center py-8"><Spinner size="sm" /></div>
            ) : activities.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-foreground-tertiary">활동 기록이 없습니다.</p>
            ) : activities.map((activity) => {
              const detail = activity.details as Record<string, string>;
              const label = ACTION_LABELS[activity.action] ?? activity.action;
              const target = detail?.file_name ?? detail?.title ?? detail?.name ?? detail?.query ?? '';
              return (
                <div key={activity.id} className="flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-surface-secondary/50 sm:px-7">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
                    <Clock size={13} strokeWidth={1.8} className="text-foreground-tertiary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{target ? `"${target}" ${label}` : label}</p>
                    <span className="mt-0.5 block text-[11px] text-foreground-tertiary font-num sm:hidden">{formatTimeAgo(activity.created_at)}</span>
                  </div>
                  <span className="ml-3 hidden shrink-0 text-[11px] text-foreground-tertiary font-num sm:block">{formatTimeAgo(activity.created_at)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 파일 유형 분포 */}
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
          <div className="border-b border-border/60 px-5 py-5 sm:px-7 sm:py-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-tint">
                <PieChart size={15} className="text-primary" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-foreground">파일 유형 분포</h2>
                <p className="mt-0.5 text-[11px] text-foreground-tertiary">접근 가능 파일 기준</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-6 px-5 py-6 sm:flex-row sm:gap-8 sm:px-7 sm:py-8">
            <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" className="stroke-surface-secondary" strokeWidth="18" />
                {totalFileCount > 0 && (() => {
                  let offset = 0;
                  return typeEntries.map(([label, count], index) => {
                    const pct = count / totalFileCount;
                    const dash = pct * 251.3;
                    const element = <circle key={label} cx="50" cy="50" r="40" fill="none" stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth="18" strokeDasharray={`${dash} ${251.3 - dash}`} strokeDashoffset={-offset} strokeLinecap="round" />;
                    offset += dash;
                    return element;
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[20px] font-bold text-foreground font-num">{totalFileCount}</span>
                <span className="text-[10px] text-foreground-tertiary">전체</span>
              </div>
            </div>
            <div className="space-y-3">
              {typeEntries.map(([label, count], index) => {
                const pct = totalFileCount > 0 ? Math.round((count / totalFileCount) * 100) : 0;
                return (
                  <div key={label} className="flex items-center gap-2.5">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                    <span className="w-12 text-[12px] font-semibold uppercase text-foreground">{label}</span>
                    <span className="text-[12px] text-foreground-tertiary font-num">{pct}%</span>
                    <span className="text-[11px] text-foreground-quaternary font-num">({count})</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:gap-6 lg:grid-cols-3">
        <UploadTrendCard trend={data?.upload_trend ?? []} loading={loading} />
        <DepartmentFilesCard departmentBreakdown={data?.department_breakdown ?? {}} loading={loading} />
      </div>

      <ExpiryDashboardWidget />
      <DepartmentDocumentsCard docDeptBreakdown={data?.doc_dept_breakdown ?? {}} loading={loading} />
    </>
  );
}

/* ── Recent Files Table ── */
function RecentFilesTable({ recentFiles, loading }: { recentFiles: RecentFile[]; loading: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="flex flex-col items-start justify-between gap-3 border-b border-border/60 px-5 py-5 sm:flex-row sm:items-center sm:px-7 sm:py-5">
        <div>
          <h2 className="text-[15px] font-bold text-foreground">최근 파일</h2>
          <p className="mt-0.5 text-[12px] text-foreground-tertiary">검색, 생성, 분석으로 이어갈 수 있는 문서</p>
        </div>
        <Link href="/files" className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-[12px] font-semibold text-primary shadow-sm transition-all hover:bg-primary-tint hover:shadow">
          전체 보기 <ArrowUpRight size={13} />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left px-5 py-3.5 text-[11px] font-bold text-foreground-tertiary uppercase tracking-wider sm:px-7">파일명</th>
              <th className="text-left px-5 py-3.5 text-[11px] font-bold text-foreground-tertiary uppercase tracking-wider sm:px-7">유형</th>
              <th className="hidden text-left px-5 py-3.5 text-[11px] font-bold text-foreground-tertiary uppercase tracking-wider md:table-cell sm:px-7">부서</th>
              <th className="hidden text-left px-5 py-3.5 text-[11px] font-bold text-foreground-tertiary uppercase tracking-wider md:table-cell sm:px-7">날짜</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {loading ? (
              <tr><td colSpan={4} className="px-7 py-8 text-center"><Spinner size="sm" /></td></tr>
            ) : recentFiles.length === 0 ? (
              <tr><td colSpan={4} className="px-7 py-8 text-center text-[13px] text-foreground-tertiary">등록된 파일이 없습니다.</td></tr>
            ) : recentFiles.map((file) => (
              <tr key={file.id} className="transition-colors hover:bg-surface-secondary/40">
                <td className="px-5 py-4 text-[13px] font-medium text-foreground sm:px-7">
                  <div className="max-w-[35ch] truncate">{file.name}</div>
                  <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-foreground-tertiary md:hidden">
                    <span>{file.department}</span>
                    <span>{file.uploadDate}</span>
                  </div>
                </td>
                <td className="px-5 py-4 sm:px-7"><span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold ${FILE_TYPE_BADGE[file.type] || 'bg-gray-100 text-gray-600'}`}>{file.type}</span></td>
                <td className="hidden px-5 py-4 text-[13px] text-foreground-secondary md:table-cell sm:px-7">{file.department}</td>
                <td className="hidden px-5 py-4 text-[13px] text-foreground-tertiary font-num md:table-cell sm:px-7">{file.uploadDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Upload Trend Card ── */
function UploadTrendCard({ trend, loading }: { trend: Array<{ week: string; label: string; count: number }>; loading: boolean }) {
  return (
    <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="border-b border-border/60 px-5 py-5 sm:px-7 sm:py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-tint">
            <TrendingUp size={15} className="text-primary" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-foreground">파일 업로드 추이</h2>
            <p className="mt-0.5 text-[11px] text-foreground-tertiary">최근 8주</p>
          </div>
        </div>
      </div>
      <div className="px-5 py-6 sm:px-7 sm:py-7">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner size="sm" /></div>
        ) : (() => {
          const maxCount = Math.max(...trend.map((item) => item.count), 1);
          const chartH = 120;
          const barW = 32;
          const gap = 10;
          const totalW = trend.length * (barW + gap) - gap;
          return (
            <div className="overflow-x-auto">
              <svg width={totalW} height={chartH + 32} className="block min-w-full">
                {trend.map((item, index) => {
                  const barH = maxCount > 0 ? Math.max((item.count / maxCount) * chartH, item.count > 0 ? 6 : 0) : 0;
                  const x = index * (barW + gap);
                  const y = chartH - barH;
                  return (
                    <g key={item.week}>
                      {/* Bar background */}
                      <rect x={x} y={0} width={barW} height={chartH} rx={6} className="fill-surface-secondary/60" />
                      {/* Bar value */}
                      <rect x={x} y={y} width={barW} height={barH} rx={6} className={item.count > 0 ? 'fill-primary' : 'fill-border'} />
                      {item.count > 0 && <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={10} className="fill-foreground" fontWeight="700">{item.count}</text>}
                      <text x={x + barW / 2} y={chartH + 18} textAnchor="middle" fontSize={10} className="fill-foreground-quaternary">{item.label}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ── Department Files Card ── */
function DepartmentFilesCard({ departmentBreakdown, loading }: { departmentBreakdown: Record<string, number>; loading: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="border-b border-border/60 px-5 py-5 sm:px-7 sm:py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-secondary">
            <Building2 size={15} className="text-foreground-secondary" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-foreground">부서별 파일</h2>
            <p className="mt-0.5 text-[11px] text-foreground-tertiary">전체 파일 부서 분포</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-6 px-5 py-6 sm:px-7 sm:py-7">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner size="sm" /></div>
        ) : (() => {
          const entries = Object.entries(departmentBreakdown).sort(([, a], [, b]) => b - a).slice(0, 4);
          const total = entries.reduce((a, [, v]) => a + v, 0) || 1;
          const colors = CHART_COLORS;
          const r = 40;
          const circ = 2 * Math.PI * r;
          let offset = 0;
          return (
            <>
              <div className="relative" style={{ width: 130, height: 130 }}>
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r={r} fill="none" className="stroke-surface-secondary" strokeWidth="16" />
                  {entries.map(([label, count], index) => {
                    const dash = (count / total) * circ;
                    const element = <circle key={label} cx="50" cy="50" r={r} fill="none" stroke={colors[index % colors.length]} strokeWidth="16" strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} strokeLinecap="round" />;
                    offset += dash;
                    return element;
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[18px] font-bold text-foreground font-num">{entries.reduce((a, [, v]) => a + v, 0)}</span>
                  <span className="text-[10px] text-foreground-tertiary">전체</span>
                </div>
              </div>
              <div className="flex w-full flex-col gap-3">
                {entries.map(([label, count], index) => {
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                      <span className="flex-1 text-[12px] font-medium text-foreground">{label}</span>
                      <span className="text-[11px] text-foreground-tertiary font-num">{pct}%</span>
                      <span className="w-8 text-right text-[12px] font-bold text-foreground font-num">{count}</span>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

/* ── Department Documents Card ── */
function DepartmentDocumentsCard({ docDeptBreakdown, loading }: { docDeptBreakdown: Record<string, number>; loading: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="border-b border-border/60 px-5 py-5 sm:px-7 sm:py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-secondary">
            <BarChart3 size={15} className="text-foreground-secondary" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-foreground">부서별 문서 생성량</h2>
            <p className="mt-0.5 text-[11px] text-foreground-tertiary">접근 가능 문서 기준</p>
          </div>
        </div>
      </div>
      <div className="px-5 py-6 sm:px-7 sm:py-7">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner size="sm" /></div>
        ) : (() => {
          const entries = Object.entries(docDeptBreakdown).sort(([, a], [, b]) => b - a).slice(0, 6);
          const maxVal = Math.max(...entries.map(([, v]) => v), 1);
          if (entries.length === 0) return <p className="py-4 text-center text-[13px] text-foreground-tertiary">데이터가 없습니다.</p>;
          return (
            <div className="flex flex-col gap-4">
              {entries.map(([dept, count], index) => (
                <div key={dept} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 truncate text-right text-[12px] font-medium text-foreground-secondary">{dept}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-secondary">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(count / maxVal) * 100}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[12px] font-bold text-foreground font-num">{count}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
