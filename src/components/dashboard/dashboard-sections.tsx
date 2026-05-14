import Link from 'next/link';
import { ArrowUpRight, Clock } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { FILE_TYPE_BADGE, FILE_STATUS_COLOR, ACTION_LABELS, CHART_COLORS } from '@/lib/constants/ui';
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
  flow_kpis?: {
    upload_count_30d: number;
    search_usage_rate_30d: number;
    document_generation_completion_rate_30d: number;
    shared_document_count: number;
    comment_reflect_completion_rate_30d: number;
  };
  document_flow_funnel_30d?: {
    created: number;
    shared: number;
    commented: number;
    reflected: number;
  };
  flow_diagnostics?: {
    active_user_count: number;
    search_user_count: number;
    created_document_count: number;
    completed_document_count: number;
    total_comment_count: number;
    reflected_comment_count: number;
  };
}

export function DashboardMidSection({ recentFiles, loading }: { recentFiles: RecentFile[]; data: DashboardData | null; loading: boolean }) {
  return (
    <RecentFilesTable recentFiles={recentFiles} loading={loading} />
  );
}

export function DashboardBottomSection({
  data,
  loading,
  flowWindowDays,
  onFlowWindowChange,
}: {
  data: DashboardData | null;
  loading: boolean;
  flowWindowDays: 7 | 30;
  onFlowWindowChange: (value: 7 | 30) => void;
}) {
  const breakdown = data?.file_type_breakdown ?? {};
  const totalFileCount = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const typeEntries = Object.entries(breakdown).sort(([, a], [, b]) => b - a).slice(0, 4);
  const otherCount = totalFileCount - typeEntries.reduce((a, [, v]) => a + v, 0);
  if (otherCount > 0) typeEntries.push(['기타', otherCount]);
  const activities = (data?.recent_activity ?? []).slice(0, 5);

  return (
    <>
      <FlowKpiSection
        data={data}
        loading={loading}
        flowWindowDays={flowWindowDays}
        onFlowWindowChange={onFlowWindowChange}
      />

      <div className="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="overflow-hidden rounded-[26px] border border-border bg-card">
          <div className="border-b border-[#e5e5e7] px-4 py-4 sm:px-8 sm:py-6">
            <h2 className="text-[16px] font-semibold text-foreground">최근 활동</h2>
          </div>
          <div className="py-2">
            {loading ? (
              <div className="flex justify-center py-6"><Spinner size="sm" /></div>
            ) : activities.length === 0 ? (
              <p className="text-[13px] text-muted text-center py-6">활동 기록이 없습니다.</p>
            ) : activities.map((activity) => {
              const detail = activity.details as Record<string, string>;
              const label = ACTION_LABELS[activity.action] ?? activity.action;
              const target = detail?.file_name ?? detail?.title ?? detail?.name ?? detail?.query ?? '';
              return (
                <div key={activity.id} className="flex items-start gap-3 px-4 py-4 sm:items-center sm:gap-4 sm:px-8 sm:py-5">
                  <div className="w-8 h-8 rounded-full bg-page-bg flex items-center justify-center flex-shrink-0">
                    <Clock size={14} strokeWidth={1.5} className="text-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-foreground sm:truncate">{target ? `"${target}" ${label}` : label}</p>
                    <span className="mt-1 block text-[11px] text-muted font-num sm:hidden">{formatTimeAgo(activity.created_at)}</span>
                  </div>
                  <span className="ml-4 hidden flex-shrink-0 text-[12px] text-muted font-num sm:block">{formatTimeAgo(activity.created_at)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-border bg-card">
          <div className="border-b border-[#e5e5e7] px-4 py-4 sm:px-8 sm:py-6">
            <h2 className="text-[16px] font-semibold text-foreground">파일 유형 분포</h2>
            <p className="mt-1 text-[12px] text-muted">현재 계정에서 접근 가능한 파일 기준 분포입니다.</p>
          </div>
          <div className="flex flex-col items-center justify-center gap-5 px-4 py-5 sm:flex-row sm:gap-8 sm:px-8 sm:py-8">
            <div className="relative flex-shrink-0" style={{ width: 150, height: 150 }}>
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e5e7" strokeWidth="20" />
                {totalFileCount > 0 && (() => {
                  let offset = 0;
                  return typeEntries.map(([label, count], index) => {
                    const pct = count / totalFileCount;
                    const dash = pct * 251.3;
                    const element = <circle key={label} cx="50" cy="50" r="40" fill="none" stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth="20" strokeDasharray={`${dash} ${251.3 - dash}`} strokeDashoffset={-offset} strokeLinecap="round" />;
                    offset += dash;
                    return element;
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[18px] font-bold text-foreground font-num">{totalFileCount}</span>
                <span className="text-[10px] text-muted">전체</span>
              </div>
            </div>
            <div className="space-y-2.5">
              {typeEntries.map(([label, count], index) => {
                const pct = totalFileCount > 0 ? Math.round((count / totalFileCount) * 100) : 0;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                    <span className="text-[12px] text-foreground w-12 font-medium uppercase">{label}</span>
                    <span className="text-[12px] text-muted font-num">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-3">
        <UploadTrendCard trend={data?.upload_trend ?? []} loading={loading} />
        <DepartmentFilesCard departmentBreakdown={data?.department_breakdown ?? {}} loading={loading} />
      </div>

      <ExpiryDashboardWidget />
      <DepartmentDocumentsCard docDeptBreakdown={data?.doc_dept_breakdown ?? {}} loading={loading} />
    </>
  );
}

function FlowKpiSection({
  data,
  loading,
  flowWindowDays,
  onFlowWindowChange,
}: {
  data: DashboardData | null;
  loading: boolean;
  flowWindowDays: 7 | 30;
  onFlowWindowChange: (value: 7 | 30) => void;
}) {
  const kpis = data?.flow_kpis;
  const funnel = data?.document_flow_funnel_30d;
  const diagnostics = data?.flow_diagnostics;

  return (
    <div className="grid grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-[2fr_3fr]">
      <div className="overflow-hidden rounded-[26px] border border-border bg-card">
        <div className="border-b border-[#e5e5e7] px-4 py-4 sm:px-8 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-foreground">핵심 KPI</h2>
              <p className="mt-1 text-[12px] text-muted">최근 {flowWindowDays}일 기준 문서 운영 지표</p>
            </div>
            <div className="inline-flex rounded-full border border-[#E2E5EA] bg-[#fbfbfc] p-1">
              {[7, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => onFlowWindowChange(days as 7 | 30)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    flowWindowDays === days ? 'bg-[#1d1d1f] text-white' : 'text-[#6e6e73] hover:bg-white'
                  }`}
                >
                  최근 {days}일
                </button>
              ))}
            </div>
          </div>
        </div>
        {loading || !kpis ? (
          <div className="flex justify-center py-8"><Spinner size="sm" /></div>
        ) : (
          <div className="space-y-4 px-4 py-5 sm:px-8 sm:py-8">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <KpiCard label="업로드 수" value={`${kpis.upload_count_30d}`} helper={`최근 ${flowWindowDays}일`} />
              <KpiCard label="검색 사용률" value={`${kpis.search_usage_rate_30d}%`} helper="활성 사용자 기준" />
              <KpiCard label="문서 완료율" value={`${kpis.document_generation_completion_rate_30d}%`} helper="생성 문서 대비" />
              <KpiCard label="공유 문서 수" value={`${kpis.shared_document_count}`} helper="현재 공유 상태" />
              <KpiCard label="코멘트 반영률" value={`${kpis.comment_reflect_completion_rate_30d}%`} helper={`최근 ${flowWindowDays}일`} />
            </div>
            {diagnostics ? (
              <div className="rounded-2xl border border-[#E2E5EA] bg-[#fbfbfc] px-4 py-4">
                <p className="text-[12px] font-semibold text-[#1d1d1f]">진단용 원본 수치</p>
                <p className="mt-1 text-[11px] leading-5 text-[#6e6e73]">
                  KPI 해석이 맞는지 보려면 분모와 분자를 함께 확인하세요.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <DiagnosticItem label="활성 사용자" value={diagnostics.active_user_count} />
                  <DiagnosticItem label="검색 사용자" value={diagnostics.search_user_count} />
                  <DiagnosticItem label="생성 문서" value={diagnostics.created_document_count} />
                  <DiagnosticItem label="완료 문서" value={diagnostics.completed_document_count} />
                  <DiagnosticItem label="전체 코멘트" value={diagnostics.total_comment_count} />
                  <DiagnosticItem label="반영 코멘트" value={diagnostics.reflected_comment_count} />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-[26px] border border-border bg-card">
        <div className="border-b border-[#e5e5e7] px-4 py-4 sm:px-8 sm:py-6">
          <h2 className="text-[16px] font-semibold text-foreground">문서 운영 퍼널</h2>
          <p className="mt-1 text-[12px] text-muted">생성 - 공유 - 코멘트 - 반영</p>
        </div>
        {loading || !funnel ? (
          <div className="flex justify-center py-8"><Spinner size="sm" /></div>
        ) : (
          <div className="grid grid-cols-2 gap-3 px-4 py-5 sm:grid-cols-4 sm:px-8 sm:py-8">
            <FunnelCard label="생성" value={funnel.created} accent="bg-[#F3F8FF] text-[#2E6FF2]" />
            <FunnelCard label="공유" value={funnel.shared} accent="bg-[#EEF7F1] text-[#258A4E]" />
            <FunnelCard label="코멘트" value={funnel.commented} accent="bg-[#FAF5FF] text-[#7C3AED]" />
            <FunnelCard label="반영" value={funnel.reflected} accent="bg-[#FFF8ED] text-[#B06D00]" />
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-[#E2E5EA] bg-[#fbfbfc] px-4 py-4">
      <p className="text-[12px] text-[#6e6e73]">{label}</p>
      <p className="mt-2 text-[22px] font-bold text-[#1d1d1f] font-num">{value}</p>
      <p className="mt-1 text-[11px] text-[#7C8494]">{helper}</p>
    </div>
  );
}

function FunnelCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl border border-[#E2E5EA] bg-white px-4 py-4">
      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${accent}`}>{label}</span>
      <p className="mt-3 text-[24px] font-bold text-[#1d1d1f] font-num">{value}</p>
    </div>
  );
}

function DiagnosticItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#E2E5EA] bg-white px-3 py-3">
      <p className="text-[11px] text-[#6e6e73]">{label}</p>
      <p className="mt-1 text-[18px] font-bold text-[#1d1d1f] font-num">{value}</p>
    </div>
  );
}

function RecentFilesTable({ recentFiles, loading }: { recentFiles: RecentFile[]; loading: boolean }) {
  return (
    <div className="overflow-hidden rounded-[26px] border border-border bg-card">
      <div className="flex flex-col items-start justify-between gap-3 border-b border-[#e5e5e7] px-4 py-4 sm:flex-row sm:items-center sm:px-8 sm:py-6">
        <div>
          <h2 className="text-[16px] font-semibold text-foreground">최근 파일</h2>
          <p className="mt-1 text-[12px] text-muted">업로드 후 바로 검색, 생성, 분석으로 이어질 수 있는 문서 목록입니다.</p>
        </div>
        <Link href="/files" className="text-[13px] font-medium text-primary hover:text-primary-dark flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-page-bg/80">전체 보기 <ArrowUpRight size={14} /></Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-page-bg">
              <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase tracking-wider">파일명</th>
              <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase tracking-wider">유형</th>
              <th className="hidden text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase tracking-wider md:table-cell">부서</th>
              <th className="hidden text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase tracking-wider md:table-cell">날짜</th>
              <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase tracking-wider">상태</th>
              <th className="hidden text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase tracking-wider md:table-cell">다음 작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-muted"><Spinner size="sm" /></td></tr>
            ) : recentFiles.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-[14px] text-muted">등록된 파일이 없습니다.</td></tr>
            ) : recentFiles.map((file) => (
              <tr key={file.id} className="hover:bg-page-bg/50 transition-colors border-b border-border last:border-b-0">
                <td className="px-4 py-4 text-[13px] font-medium text-foreground sm:px-6 sm:text-[14px]">
                  <div>{file.name}</div>
                  <div className="mt-2 flex flex-wrap gap-2.5 text-[11px] text-muted md:hidden">
                    <span>{file.department}</span>
                    <span>{file.uploadDate}</span>
                  </div>
                </td>
                <td className="px-6 py-4"><span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold ${FILE_TYPE_BADGE[file.type] || 'bg-gray-100 text-gray-600'}`}>{file.type}</span></td>
                <td className="hidden px-6 py-4 text-[14px] text-muted md:table-cell">{file.department}</td>
                <td className="hidden px-6 py-4 text-[13px] text-muted font-num md:table-cell">{file.uploadDate}</td>
                <td className={`w-[88px] whitespace-nowrap px-4 py-4 text-[12px] font-semibold sm:w-auto sm:px-6 sm:text-[13px] ${FILE_STATUS_COLOR[file.status] || ''}`}>{file.status}</td>
                <td className="hidden px-6 py-4 md:table-cell">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link href="/files" className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-page-bg hover:text-primary-dark transition-colors">문서허브</Link>
                    <span className="text-border">•</span>
                    <Link href="/search" className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-page-bg hover:text-primary-dark transition-colors">AI 검색</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UploadTrendCard({ trend, loading }: { trend: Array<{ week: string; label: string; count: number }>; loading: boolean }) {
  return (
    <div className="lg:col-span-2 overflow-hidden rounded-[26px] border border-border bg-card">
      <div className="border-b border-[#e5e5e7] px-4 py-4 sm:px-8 sm:py-6">
        <h2 className="text-[16px] font-semibold text-foreground">파일 업로드 추이</h2>
        <p className="text-[12px] text-muted mt-0.5">최근 8주</p>
      </div>
      <div className="px-4 py-5 sm:px-8 sm:py-8">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner size="sm" /></div>
        ) : (() => {
          const maxCount = Math.max(...trend.map((item) => item.count), 1);
          const chartH = 120;
          const barW = 28;
          const gap = 8;
          const totalW = trend.length * (barW + gap) - gap;
          return (
            <div style={{ overflowX: 'auto' }}>
              <svg width={totalW} height={chartH + 32} style={{ display: 'block', minWidth: '100%' }}>
                {trend.map((item, index) => {
                  const barH = maxCount > 0 ? Math.max((item.count / maxCount) * chartH, item.count > 0 ? 4 : 0) : 0;
                  const x = index * (barW + gap);
                  const y = chartH - barH;
                  return (
                    <g key={item.week}>
                      <rect x={x} y={y} width={barW} height={barH} rx={4} fill={item.count > 0 ? '#0071e3' : '#e5e5e7'} />
                      {item.count > 0 && <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={10} fill="#1d1d1f" fontWeight="600">{item.count}</text>}
                      <text x={x + barW / 2} y={chartH + 18} textAnchor="middle" fontSize={10} fill="#a1a1a6">{item.label}</text>
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

function DepartmentFilesCard({ departmentBreakdown, loading }: { departmentBreakdown: Record<string, number>; loading: boolean }) {
  return (
    <div className="overflow-hidden rounded-[26px] border border-border bg-card">
      <div className="border-b border-[#e5e5e7] px-4 py-4 sm:px-8 sm:py-6">
        <h2 className="text-[16px] font-semibold text-foreground">부서별 파일 현황</h2>
        <p className="text-[12px] text-muted mt-0.5">전체 파일 부서 분포</p>
      </div>
      <div className="flex flex-col items-center gap-5 px-4 py-5 sm:gap-6 sm:px-8 sm:py-8">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner size="sm" /></div>
        ) : (() => {
          const entries = Object.entries(departmentBreakdown).sort(([, a], [, b]) => b - a).slice(0, 4);
          const total = entries.reduce((a, [, v]) => a + v, 0) || 1;
          const colors = ['#0071e3', '#34c759', '#ff9f0a', '#ff3b30'];
          const r = 40;
          const circ = 2 * Math.PI * r;
          let offset = 0;
          return (
            <>
              <div className="relative" style={{ width: 140, height: 140 }}>
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e5e7" strokeWidth="18" />
                  {entries.map(([label, count], index) => {
                    const dash = (count / total) * circ;
                    const element = <circle key={label} cx="50" cy="50" r={r} fill="none" stroke={colors[index % colors.length]} strokeWidth="18" strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} strokeLinecap="round" />;
                    offset += dash;
                    return element;
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[20px] font-bold text-foreground font-num">{entries.reduce((a, [, v]) => a + v, 0)}</span>
                  <span className="text-[10px] text-muted">전체</span>
                </div>
              </div>
              <div className="flex w-full flex-col gap-3">
                {entries.map(([label, count], index) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
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
  );
}

function DepartmentDocumentsCard({ docDeptBreakdown, loading }: { docDeptBreakdown: Record<string, number>; loading: boolean }) {
  return (
    <div className="overflow-hidden rounded-[26px] border border-border bg-card">
      <div className="border-b border-[#e5e5e7] px-4 py-4 sm:px-8 sm:py-6">
        <h2 className="text-[16px] font-semibold text-foreground">부서별 문서 생성량</h2>
        <p className="text-[12px] text-muted mt-0.5">내가 접근 가능한 문서 기준</p>
      </div>
      <div className="px-4 py-5 sm:px-8 sm:py-8">
        {loading ? (
          <div className="flex justify-center py-6"><Spinner size="sm" /></div>
        ) : (() => {
          const entries = Object.entries(docDeptBreakdown).sort(([, a], [, b]) => b - a).slice(0, 6);
          const maxVal = Math.max(...entries.map(([, v]) => v), 1);
          if (entries.length === 0) return <p className="text-sm text-muted text-center py-4">데이터가 없습니다.</p>;
          return (
            <div className="flex flex-col gap-4">
              {entries.map(([dept, count], index) => (
                <div key={dept} className="flex items-center gap-3">
                  <span className="text-[12px] text-muted w-20 truncate text-right shrink-0">{dept}</span>
                  <div className="flex-1 bg-[#f5f5f7] rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(count / maxVal) * 100}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                  </div>
                  <span className="text-[12px] font-semibold font-num text-foreground w-6 text-right shrink-0">{count}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
