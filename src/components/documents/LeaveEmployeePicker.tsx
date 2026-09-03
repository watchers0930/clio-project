'use client';

import { useEffect, useMemo, useState } from 'react';

export interface OrgMember {
  id: string;
  name: string;
  department_id: string | null;
  hire_date: string | null;
  phone: string | null;
}
interface OrgDept {
  id: string;
  name: string;
}

interface LeaveEmployeePickerProps {
  onSelect: (member: OrgMember, departmentName: string) => void;
}

/**
 * 부서 선택 → 그 부서 직원 선택 → 선택 직원 정보를 상위 폼으로 전달.
 * (휴가원 폼 상단에서 사용)
 */
export function LeaveEmployeePicker({ onSelect }: LeaveEmployeePickerProps) {
  const [departments, setDepartments] = useState<OrgDept[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [deptId, setDeptId] = useState('');
  const [memberId, setMemberId] = useState('');

  useEffect(() => {
    fetch('/api/org/members')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setDepartments(j.departments ?? []);
          setMembers(j.members ?? []);
        }
      })
      .catch(() => {});
  }, []);

  const deptMembers = useMemo(
    () => members.filter((m) => (deptId ? m.department_id === deptId : true)),
    [members, deptId],
  );

  const handleMember = (id: string) => {
    setMemberId(id);
    const m = members.find((x) => x.id === id);
    if (m) {
      const deptName = departments.find((d) => d.id === m.department_id)?.name ?? '';
      onSelect(m, deptName);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface-secondary p-3">
      <p className="text-xs font-medium text-foreground-secondary" style={{ marginBottom: 8 }}>
        직원 선택 (부서 → 이름 선택 시 자동 입력)
      </p>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={deptId}
          onChange={(e) => { setDeptId(e.target.value); setMemberId(''); }}
          className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">부서 선택</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          value={memberId}
          onChange={(e) => handleMember(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">직원 선택</option>
          {deptMembers.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
