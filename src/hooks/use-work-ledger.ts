'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  DepartmentOption,
  ManagerOption,
  WorkProject,
  WorkProjectInput,
} from '@/lib/work-ledger/types';

export function useWorkLedger() {
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, deptRes, userRes] = await Promise.all([
        fetch('/api/work-projects'),
        fetch('/api/departments'),
        fetch('/api/users'),
      ]);
      const projJson = (await projRes.json()) as { data?: WorkProject[] };
      const deptJson = (await deptRes.json()) as { data?: Array<{ id: string; name: string }> };
      const userJson = (await userRes.json()) as { data?: Array<{ id: string; name: string }> };
      setProjects(projJson.data ?? []);
      setDepartments((deptJson.data ?? []).map((d) => ({ id: d.id, name: d.name })));

      // 담당자 후보: 지정된 3명만, 이름 중복 제거 후 지정 순서로 정렬
      const ALLOWED_MANAGERS = ['김동의', '정순규', '신은수'];
      const seen = new Set<string>();
      const managers = (userJson.data ?? [])
        .filter((u) => {
          if (!ALLOWED_MANAGERS.includes(u.name) || seen.has(u.name)) return false;
          seen.add(u.name);
          return true;
        })
        .map((u) => ({ id: u.id, name: u.name }))
        .sort((a, b) => ALLOWED_MANAGERS.indexOf(a.name) - ALLOWED_MANAGERS.indexOf(b.name));
      setManagers(managers);
    } catch {
      // 오류 시 기존 목록 유지
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createProject = useCallback(async (input: WorkProjectInput): Promise<WorkProject> => {
    const res = await fetch('/api/work-projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const json = (await res.json()) as { data?: WorkProject; error?: string };
    if (!res.ok || !json.data) throw new Error(json.error ?? '저장에 실패했습니다.');
    setProjects((prev) => [json.data as WorkProject, ...prev]);
    return json.data;
  }, []);

  const updateProject = useCallback(async (id: string, input: WorkProjectInput): Promise<WorkProject> => {
    const res = await fetch(`/api/work-projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const json = (await res.json()) as { data?: WorkProject; error?: string };
    if (!res.ok || !json.data) throw new Error(json.error ?? '수정에 실패했습니다.');
    setProjects((prev) => prev.map((p) => (p.id === id ? (json.data as WorkProject) : p)));
    return json.data;
  }, []);

  const deleteProject = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/work-projects/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error ?? '삭제에 실패했습니다.');
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return {
    projects,
    departments,
    managers,
    loading,
    reload: load,
    createProject,
    updateProject,
    deleteProject,
  };
}
