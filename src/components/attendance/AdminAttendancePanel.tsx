'use client';

// admin 전용 전직원 근태 조회 — 직원·기간 필터 + 페이지네이션 (설계서 §5: GET /api/attendance/admin)
// 서버에서 role='admin' 재검증. 403이면 접근 불가 안내.

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useAdminAttendance } from '@/hooks/use-attendance-admin';
import { apiGet } from '@/hooks/csrf-client';
import { fmtTime, fmtWorkDate } from './format';
import type { AdminAttendanceRow } from './types';

interface EmployeeOption {
  id: string;
  name: string;
}

export function AdminAttendancePanel() {
  const { query, setQuery, result, loading, error, forbidden } = useAdminAttendance();
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  useEffect(() => {
    void apiGet<Array<{ id: string; name: string }>>('/api/users').then((res) => {
      if (res.ok && Array.isArray(res.data)) {
        setEmployees(res.data.map((u) => ({ id: u.id, name: u.name })));
      }
    });
  }, []);

  if (forbidden) {
    return (
      <Card>
        <EmptyState
          icon={<ShieldAlert className="h-10 w-10 text-foreground-quaternary" />}
          title="접근 권한이 없습니다"
          description="전직원 근태 조회는 관리자만 사용할 수 있습니다."
        />
      </Card>
    );
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  const patch = (p: Partial<typeof query>) => setQuery((q) => ({ ...q, page: 1, ...p }));

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <Field label="직원">
          <select
            value={query.userId ?? ''}
            onChange={(e) => patch({ userId: e.target.value || undefined })}
            className="h-10 min-w-[160px] rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">전체</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="시작일">
          <DateInput value={query.from} onChange={(from) => patch({ from })} />
        </Field>
        <Field label="종료일">
          <DateInput value={query.to} onChange={(to) => patch({ to })} />
        </Field>
      </Card>

      {loading ? (
        <Card className="flex justify-center py-16">
          <Spinner />
        </Card>
      ) : error ? (
        <Card>
          <p className="px-5 py-10 text-center text-sm text-danger">{error}</p>
        </Card>
      ) : !result || result.rows.length === 0 ? (
        <Card>
          <EmptyState iconType="calendar" title="기록이 없습니다" description="조건에 맞는 근태 기록이 없습니다." />
        </Card>
      ) : (
        <>
          {result.rows.map((row) => (
            <EmployeeCard key={row.userId} row={row} />
          ))}
          <div className="flex items-center justify-center gap-3">
            <PageButton
              disabled={query.page <= 1}
              onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))}
            >
              <ChevronLeft size={16} />
            </PageButton>
            <span className="text-sm text-foreground-secondary">
              {result.page} / {totalPages}
            </span>
            <PageButton
              disabled={query.page >= totalPages}
              onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}
            >
              <ChevronRight size={16} />
            </PageButton>
          </div>
        </>
      )}
    </div>
  );
}

function EmployeeCard({ row }: { row: AdminAttendanceRow }) {
  const recorded = row.days.filter((d) => d.source !== 'none');
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{row.userName}</span>
          {row.department && <span className="text-xs text-foreground-secondary">{row.department}</span>}
        </div>
        <span className="text-xs text-foreground-secondary">기록 {recorded.length}일</span>
      </div>
      {recorded.length === 0 ? (
        <p className="px-5 py-6 text-center text-xs text-foreground-secondary">기간 내 기록 없음</p>
      ) : (
        <ul className="divide-y divide-border">
          {recorded.map((d) => (
            <li key={d.workDate} className="flex items-center gap-4 px-5 py-2.5 text-sm">
              <span className="w-28 flex-shrink-0 text-foreground-secondary">{fmtWorkDate(d.workDate)}</span>
              <span className="flex-1 tabular-nums text-foreground">
                {fmtTime(d.effectiveCheckIn)} ~ {fmtTime(d.effectiveCheckOut)}
              </span>
              {d.isCorrected && <Badge variant="warning">보정</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground-secondary">{label}</span>
      {children}
    </label>
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none"
    />
  );
}

function PageButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground-secondary transition-colors hover:bg-surface-secondary disabled:opacity-40 cursor-pointer"
    >
      {children}
    </button>
  );
}
