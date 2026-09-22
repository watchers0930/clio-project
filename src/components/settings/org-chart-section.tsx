'use client';

import { useEffect, useMemo, useState } from 'react';
import { Network, Save } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { useToast } from '@/components/ui/toast';

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  department_id: string | null;
  manager_user_id: string | null;
  rank_level: number | null;
  rank_title: string | null;
}

// 직위 프리셋 — 선택 시 rank_level·rank_title을 함께 설정한다.
const RANK_PRESETS = [
  { level: 1, title: '대표' },
  { level: 2, title: '이사' },
  { level: 3, title: '팀장' },
  { level: 4, title: '사원' },
];

function rankLabel(u: OrgUser): string {
  if (u.rank_title) return u.rank_title;
  if (u.rank_level != null) return `L${u.rank_level}`;
  return '미지정';
}

/** rank_level 오름차순 + 이름으로 정렬해 트리 미리보기용 순서를 만든다. */
function sortedForTree(users: OrgUser[]): OrgUser[] {
  return [...users].sort((a, b) => {
    const la = a.rank_level ?? 99, lb = b.rank_level ?? 99;
    if (la !== lb) return la - lb;
    return a.name.localeCompare(b.name, 'ko');
  });
}

export function OrgChartSection() {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const toast = useToast();

  const load = async () => {
    try {
      const res = await fetch('/api/org-chart');
      const data = await res.json();
      if (res.ok && data.success) setUsers(data.users ?? []);
      else toast.error(data.error ?? '조직도를 불러오지 못했습니다.');
    } catch {
      toast.error('조직도 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const nameById = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  // 로컬 편집 반영
  const patchLocal = (id: string, patch: Partial<OrgUser>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  };

  const onPreset = (id: string, value: string) => {
    if (value === '') { patchLocal(id, { rank_level: null, rank_title: null }); return; }
    const p = RANK_PRESETS.find((r) => String(r.level) === value);
    if (p) patchLocal(id, { rank_level: p.level, rank_title: p.title });
  };

  const save = async (u: OrgUser) => {
    setSavingId(u.id);
    try {
      const res = await fetch('/api/org-chart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: u.id,
          managerUserId: u.manager_user_id,
          rankLevel: u.rank_level,
          rankTitle: u.rank_title,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error ?? '저장 실패'); return; }
      toast.success(`${u.name} 조직 정보를 저장했습니다.`);
    } catch {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-40"><Spinner size="md" /></div>;
  }

  const tree = sortedForTree(users);

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-card rounded-2xl border border-border p-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg bg-[#2E6FF2]/10 flex items-center justify-center">
            <Network size={18} className="text-[#2E6FF2]" />
          </div>
          <div>
            <h2 className="text-[16px] font-semibold">조직도 · 결재선</h2>
            <p className="text-[12px] text-foreground-secondary">각 구성원의 직위와 직속 상위자를 설정합니다. 전자결재는 이 조직도를 따라 상위로 올라갑니다.</p>
          </div>
        </div>

        {/* 편집 테이블 */}
        <div className="mt-6 flex flex-col gap-2">
          <div className="hidden sm:grid grid-cols-[1.4fr_1fr_1.2fr_auto] gap-3 px-3 pb-2 text-[11px] font-semibold text-foreground-secondary uppercase tracking-wide">
            <span>구성원</span><span>직위</span><span>직속 상위자</span><span></span>
          </div>
          {users.map((u) => (
            <div key={u.id} className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1.2fr_auto] gap-3 items-center px-3 py-3 rounded-xl border border-border bg-white">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground truncate">{u.name}</p>
                <p className="text-[11px] text-foreground-secondary truncate">{u.email}</p>
              </div>
              <select
                value={u.rank_level != null && RANK_PRESETS.some((r) => r.level === u.rank_level) ? String(u.rank_level) : (u.rank_level != null ? 'custom' : '')}
                onChange={(e) => onPreset(u.id, e.target.value === 'custom' ? String(u.rank_level ?? '') : e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-white text-[13px] focus:border-[#2E6FF2] focus:outline-none"
              >
                <option value="">미지정</option>
                {RANK_PRESETS.map((r) => <option key={r.level} value={String(r.level)}>{r.title}</option>)}
                {u.rank_level != null && !RANK_PRESETS.some((r) => r.level === u.rank_level) && (
                  <option value="custom">{rankLabel(u)}</option>
                )}
              </select>
              <select
                value={u.manager_user_id ?? ''}
                onChange={(e) => patchLocal(u.id, { manager_user_id: e.target.value || null })}
                className="px-3 py-2 rounded-lg border border-border bg-white text-[13px] focus:border-[#2E6FF2] focus:outline-none"
              >
                <option value="">없음 (최상위)</option>
                {users.filter((o) => o.id !== u.id).map((o) => (
                  <option key={o.id} value={o.id}>{o.name}{o.rank_title ? ` (${o.rank_title})` : ''}</option>
                ))}
              </select>
              <button
                onClick={() => save(u)}
                disabled={savingId === u.id}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#2E6FF2] text-white text-[12.5px] font-medium hover:bg-[#2560dc] disabled:opacity-50 transition-colors"
              >
                {savingId === u.id ? <Spinner size="sm" /> : <Save size={13} />}
                저장
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 트리 미리보기 */}
      <div className="bg-card rounded-2xl border border-border p-8">
        <h3 className="text-[14px] font-semibold mb-1">조직 트리 미리보기</h3>
        <p className="text-[12px] text-foreground-secondary mb-4">직위 레벨 순으로 정렬한 결재 상위 흐름입니다.</p>
        <div className="flex flex-col gap-1.5">
          {tree.map((u) => (
            <div key={u.id} className="flex items-center gap-2.5 text-[13px]" style={{ paddingLeft: `${Math.min((u.rank_level ?? 5) - 1, 6) * 20}px` }}>
              <span className="text-[10.5px] font-bold text-white bg-[#2E6FF2] px-2 py-0.5 rounded min-w-[44px] text-center">{rankLabel(u)}</span>
              <span className="font-medium text-foreground">{u.name}</span>
              <span className="text-[11.5px] text-foreground-secondary">
                {u.manager_user_id ? `↑ ${nameById.get(u.manager_user_id) ?? '?'}` : '· 최상위'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
