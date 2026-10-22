'use client';

// CEO/관리자 전용 — 전사 직원 주간업무 조회 화면.
// 서버(GET /api/weekly-reports/overview)에서 role='admin' 또는 rank_level<=1 재검증.
// 403이면 접근 불가 안내를 보여준다. (GET이라 CSRF 토큰 불필요)

import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { apiGet } from '@/hooks/csrf-client';
import { WeeklyReportDetailModal } from './WeeklyReportDetailModal';
import { statusBadgeVariant, statusLabel, formatDate } from './helpers';
import type {
  WeeklyReport,
  WeeklyReportFilters,
  OverviewResponse,
  OrgDepartment,
  OrgMember,
  OrgMembersResponse,
} from './types';

const selectClass =
  'h-10 min-w-[160px] rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none';
const dateClass =
  'h-10 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none';

const EMPTY_FILTERS: WeeklyReportFilters = { employeeId: '', departmentId: '', dateFrom: '', dateTo: '' };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground-secondary">{label}</span>
      {children}
    </div>
  );
}

export function WeeklyReportsClient() {
  const [filters, setFilters] = useState<WeeklyReportFilters>(EMPTY_FILTERS);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<WeeklyReport | null>(null);

  // 직원·부서 목록 1회 로드
  useEffect(() => {
    void apiGet<OrgMembersResponse>('/api/org/members').then((res) => {
      if (res.ok && res.data?.success) {
        setDepartments(res.data.departments ?? []);
        setMembers(res.data.members ?? []);
      }
    });
  }, []);

  const load = useCallback(async (f: WeeklyReportFilters) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (f.employeeId) params.set('employeeId', f.employeeId);
    if (f.departmentId) params.set('departmentId', f.departmentId);
    if (f.dateFrom) params.set('dateFrom', f.dateFrom);
    if (f.dateTo) params.set('dateTo', f.dateTo);
    const qs = params.toString();

    const res = await apiGet<OverviewResponse>(`/api/weekly-reports/overview${qs ? `?${qs}` : ''}`);
    if (res.status === 403) {
      setForbidden(true);
      setReports([]);
    } else if (res.ok && res.data?.success) {
      setForbidden(false);
      setReports(res.data.reports ?? []);
    } else {
      setError(res.data?.error ?? res.error ?? '주간업무 조회에 실패했습니다.');
      setReports([]);
    }
    setLoading(false);
  }, []);

  // 필터 변경 시 자동 조회(약간의 디바운스로 date 입력 중 과다 호출 방지)
  useEffect(() => {
    const t = setTimeout(() => void load(filters), 250);
    return () => clearTimeout(t);
  }, [filters, load]);

  const patch = (p: Partial<WeeklyReportFilters>) => setFilters((prev) => ({ ...prev, ...p }));

  if (forbidden) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={<ShieldAlert className="h-10 w-10 text-foreground-quaternary" />}
          title="접근 권한이 없습니다"
          description="대표이사 또는 관리자만 접근 가능합니다."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">직원 주간업무</h1>
        <p className="mt-1 text-sm text-foreground-secondary">전사 직원의 주간업무 문서를 조회합니다.</p>
      </div>

      {/* 필터 */}
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <Field label="직원">
          <select
            value={filters.employeeId}
            onChange={(e) => patch({ employeeId: e.target.value })}
            className={selectClass}
          >
            <option value="">전체</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="부서">
          <select
            value={filters.departmentId}
            onChange={(e) => patch({ departmentId: e.target.value })}
            className={selectClass}
          >
            <option value="">전체</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="시작일">
          <input
            type="date"
            value={filters.dateFrom}
            max={filters.dateTo || undefined}
            onChange={(e) => patch({ dateFrom: e.target.value })}
            className={dateClass}
          />
        </Field>
        <Field label="종료일">
          <input
            type="date"
            value={filters.dateTo}
            min={filters.dateFrom || undefined}
            onChange={(e) => patch({ dateTo: e.target.value })}
            className={dateClass}
          />
        </Field>
        {(filters.employeeId || filters.departmentId || filters.dateFrom || filters.dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            초기화
          </Button>
        )}
      </Card>

      {/* 목록 */}
      {loading ? (
        <Card className="flex justify-center py-16">
          <Spinner />
        </Card>
      ) : error ? (
        <Card>
          <p className="px-5 py-10 text-center text-sm text-danger">{error}</p>
        </Card>
      ) : reports.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="h-10 w-10 text-foreground-quaternary" />}
            title="주간업무가 없습니다"
            description="조건에 맞는 주간업무 문서가 없습니다."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-secondary text-left text-xs text-foreground-secondary">
                  <th className="px-4 py-3 font-medium">작성자</th>
                  <th className="px-4 py-3 font-medium">직급</th>
                  <th className="px-4 py-3 font-medium">부서</th>
                  <th className="px-4 py-3 font-medium">작성일</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-secondary/50">
                    <td className="px-4 py-3 font-medium text-foreground">{r.authorName}</td>
                    <td className="px-4 py-3 text-foreground-secondary">{r.authorRank || '-'}</td>
                    <td className="px-4 py-3 text-foreground-secondary">{r.authorDept}</td>
                    <td className="px-4 py-3 text-foreground-secondary">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadgeVariant(r.status)}>{statusLabel(r.status)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="secondary" size="sm" onClick={() => setSelected(r)}>
                        상세보기
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <WeeklyReportDetailModal report={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
