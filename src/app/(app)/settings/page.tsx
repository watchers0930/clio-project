'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, Users, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

/* ── types ── */
interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  manager_id: string | null;
  is_active: boolean;
  memberCount: number;
}

interface UserItem {
  id: string;
  email: string;
  name: string;
  department_id: string | null;
  departmentName: string;
  role: string;
  is_active: boolean;
}

const ROLES = [
  { value: 'admin', label: '관리자', color: 'text-red-500' },
  { value: 'manager', label: '매니저', color: 'text-blue-500' },
  { value: 'user', label: '사용자', color: 'text-gray-500' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<'departments' | 'users'>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 부서 모달
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const loadDepartments = useCallback(async () => {
    try {
      const res = await fetch('/api/departments');
      const json = await res.json();
      if (res.ok && json.data) {
        setDepartments(json.data);
      } else {
        console.error('[settings] departments load:', json.error);
      }
    } catch (err) {
      console.error('[settings] departments load error:', err);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([loadDepartments(), loadUsers()]).finally(() => setLoading(false));
  }, [loadDepartments, loadUsers]);

  /* ── 부서 CRUD ── */
  const openDeptModal = (dept?: Department) => {
    setEditDept(dept ?? null);
    setDeptName(dept?.name ?? '');
    setDeptCode(dept?.code ?? '');
    setDeptDesc(dept?.description ?? '');
    setShowDeptModal(true);
  };

  const saveDept = async () => {
    if (!deptName.trim() || !deptCode.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/departments', {
        method: editDept ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDept
          ? { id: editDept.id, name: deptName, code: deptCode, description: deptDesc }
          : { name: deptName, code: deptCode, description: deptDesc }
        ),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error ?? '부서 저장에 실패했습니다.');
        return;
      }
      await loadDepartments();
      setShowDeptModal(false);
    } catch {
      alert('부서 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const deleteDept = async (id: string) => {
    if (!confirm('이 부서를 비활성화하시겠습니까?')) return;
    await fetch(`/api/departments?id=${id}`, { method: 'DELETE' });
    await loadDepartments();
  };

  /* ── 사용자 수정 ── */
  const updateUserRole = async (userId: string, role: string) => {
    await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, role }),
    });
    await loadUsers();
  };

  const updateUserDept = async (userId: string, departmentId: string | null) => {
    await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, departmentId }),
    });
    await loadUsers();
  };

  const toggleUserActive = async (userId: string, isActive: boolean) => {
    await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, isActive }),
    });
    await loadUsers();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ borderBottom: '1px solid #e5e5e7', paddingBottom: 12 }}>
        <h1 className="text-[24px] font-bold text-foreground">설정</h1>
        <p className="text-[14px] text-muted mt-1">부서와 사용자를 관리합니다.</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-[#f5f5f7] rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('departments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'departments' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73] hover:text-[#1d1d1f]'}`}
        >
          <Building2 size={16} /> 부서 관리
        </button>
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'users' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73] hover:text-[#1d1d1f]'}`}
        >
          <Users size={16} /> 사용자 관리
        </button>
      </div>

      {/* 부서 관리 */}
      {tab === 'departments' && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-[16px] font-semibold">부서 목록</h2>
            <button
              onClick={() => openDeptModal()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors"
            >
              <Plus size={16} /> 부서 추가
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-page-bg">
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">부서명</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">코드</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">설명</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">인원</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">상태</th>
                <th className="text-right px-6 py-3 text-[12px] font-semibold text-muted uppercase">관리</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-b-0 hover:bg-page-bg/50">
                  <td className="px-6 py-4 text-sm font-medium">{d.name}</td>
                  <td className="px-6 py-4 text-sm text-muted font-num">{d.code}</td>
                  <td className="px-6 py-4 text-sm text-muted">{d.description || '-'}</td>
                  <td className="px-6 py-4 text-sm font-num">{d.memberCount}명</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${d.is_active !== false ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                      {d.is_active !== false ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openDeptModal(d)} className="p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]"><Pencil size={14} /></button>
                    <button onClick={() => deleteDept(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-[#6e6e73] hover:text-red-500 ml-1"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 사용자 관리 */}
      {tab === 'users' && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-[16px] font-semibold">사용자 목록</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-page-bg">
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">이름</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">이메일</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">부서</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">역할</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">상태</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-b-0 hover:bg-page-bg/50">
                  <td className="px-6 py-4 text-sm font-medium">{u.name}</td>
                  <td className="px-6 py-4 text-sm text-muted">{u.email}</td>
                  <td className="px-6 py-4">
                    <select
                      value={u.department_id ?? ''}
                      onChange={(e) => updateUserDept(u.id, e.target.value || null)}
                      className="text-sm border border-border rounded-lg px-2 py-1 bg-transparent"
                    >
                      <option value="">미배정</option>
                      {departments.filter((d) => d.is_active !== false).map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={u.role}
                      onChange={(e) => updateUserRole(u.id, e.target.value)}
                      className="text-sm border border-border rounded-lg px-2 py-1 bg-transparent"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleUserActive(u.id, !u.is_active)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${u.is_active ? 'bg-green-50 text-green-600 hover:bg-red-50 hover:text-red-500' : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600'}`}
                    >
                      {u.is_active ? '활성' : '비활성'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 부서 추가/수정 모달 */}
      <Modal
        open={showDeptModal}
        onClose={() => setShowDeptModal(false)}
        title={editDept ? '부서 수정' : '부서 추가'}
        description={editDept ? '부서 정보를 수정합니다.' : '새로운 부서를 추가합니다.'}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-clio-text mb-1.5">부서명 *</label>
            <input value={deptName} onChange={(e) => setDeptName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-clio-border bg-clio-bg text-sm placeholder:text-clio-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent" placeholder="경영기획팀" />
          </div>
          <div>
            <label className="block text-sm font-medium text-clio-text mb-1.5">코드 *</label>
            <input value={deptCode} onChange={(e) => setDeptCode(e.target.value.toUpperCase())} className="w-full px-3 py-2.5 rounded-xl border border-clio-border bg-clio-bg text-sm placeholder:text-clio-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent uppercase" placeholder="BIZ" />
          </div>
          <div>
            <label className="block text-sm font-medium text-clio-text mb-1.5">설명</label>
            <input value={deptDesc} onChange={(e) => setDeptDesc(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-clio-border bg-clio-bg text-sm placeholder:text-clio-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent" placeholder="부서 설명을 입력하세요" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-clio-border">
          <button onClick={() => setShowDeptModal(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-clio-text-secondary hover:bg-clio-bg transition-colors">취소</button>
          <button onClick={saveDept} disabled={saving || !deptName.trim() || !deptCode.trim()} className="px-4 py-2 rounded-xl bg-navy text-white text-sm font-medium hover:bg-accent disabled:opacity-40 transition-colors">
            {saving ? '저장 중...' : (editDept ? '수정' : '추가')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
