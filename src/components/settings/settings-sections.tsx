import Image from 'next/image';
import Link from 'next/link';
import { buildReportDraftHref } from '@/lib/documents/navigation';
import { ArrowRight, Building2, FileText, PenLine, Plus, Share2, ShieldCheck, Trash2, Upload, Users, Pencil, Save, X, ArrowRightLeft, MessageSquare, CalendarDays, StickyNote, ShieldAlert } from 'lucide-react';
import { Spinner } from '@/components/ui';
import type { Department, UserItem } from '@/components/settings/types';
import { ROLES } from '@/components/settings/types';
import { useAuthStore } from '@/store/auth-store';
import { useState } from 'react';

interface SettingsOpsSummaryProps {
  departments: Department[];
  users: UserItem[];
}

export function SettingsOpsSummary({ departments, users }: SettingsOpsSummaryProps) {
  const activeDepartments = departments.filter((department) => department.is_active !== false);
  const activeUsers = users.filter((user) => user.is_active !== false);
  const unassignedUsers = activeUsers.filter((user) => !user.department_id);
  const managerCount = activeUsers.filter((user) => user.role === 'manager').length;
  const adminCount = activeUsers.filter((user) => user.role === 'admin').length;
  const departmentsWithoutMembers = activeDepartments.filter((department) => department.memberCount === 0);
  const departmentsWithoutManager = activeDepartments.filter((department) => !department.manager_id);

  const summaryCards = [
    {
      label: '운영 중 부서',
      value: `${activeDepartments.length}`,
      caption: departmentsWithoutMembers.length > 0 ? `미사용 부서 ${departmentsWithoutMembers.length}` : '전부 인원 배치됨',
      icon: Building2,
    },
    {
      label: '활성 사용자',
      value: `${activeUsers.length}`,
      caption: unassignedUsers.length > 0 ? `미배정 사용자 ${unassignedUsers.length}` : '전부 부서 연결됨',
      icon: Users,
    },
    {
      label: '운영 책임자',
      value: `${adminCount + managerCount}`,
      caption: `관리자 ${adminCount} · 매니저 ${managerCount}`,
      icon: ShieldCheck,
    },
    {
      label: '정책 관리 축',
      value: '3',
      caption: '접근 · 공유 · 역할 기준',
      icon: Share2,
    },
  ];

  const policyCards = [
    {
      title: '접근 기준',
      description: '문서는 작성자, 내부 공유된 사용자·부서, 관리자만 접근합니다.',
      points: ['기본값은 작성자 소유', '검색과 AI 기능도 같은 기준 적용', '관리자만 전사 문서 직접 관리'],
      href: '/shared-documents',
      label: '공유 문서 보기',
      icon: ShieldCheck,
    },
    {
      title: '공유 기준',
      description: '공유는 링크 배포가 아니라 검토 요청과 코멘트 수집의 시작점입니다.',
      points: ['링크 · 사용자 · 부서 3축 운영', '검토 요청은 메시지와 연결', '공유 후 코멘트/검토로 이어짐'],
      href: '/reviews',
      label: '검토 큐 보기',
      icon: Share2,
    },
    {
      title: '관리 액션',
      description: '관리자는 운영 정책을 관리하고, 매니저는 부서 운영을 담당합니다.',
      points: ['admin: 전사 운영', 'manager: 부서 사용자·문서 운영', 'user: 공유 기반 검토 참여'],
      href: '/files',
      label: '문서 운영 보기',
      icon: FileText,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-border bg-white p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between sm:mb-4">
                <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-primary">{card.label}</span>
                <div className="rounded-xl bg-primary-tint p-2 text-primary">
                  <Icon size={16} />
                </div>
              </div>
              <p className="text-[28px] font-semibold text-foreground">{card.value}</p>
              <p className="mt-2 text-sm text-foreground-secondary">{card.caption}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl border border-border bg-white p-4 sm:p-6">
          <div className="flex flex-col gap-2 border-b border-border pb-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-primary">운영 원칙</p>
            <h2 className="text-[20px] font-semibold text-foreground">설정은 CRUD 화면이 아니라 문서 운영 정책판입니다.</h2>
            <p className="text-sm text-muted">조직 구조, 공유 정책, 역할별 액션을 한 화면에서 점검하고 바로 문서 운영 흐름으로 이동할 수 있어야 합니다.</p>
          </div>
          <div className="mt-5 grid gap-3 sm:gap-4 md:grid-cols-3">
            {policyCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="rounded-2xl bg-surface-secondary p-4">
                  <div className="mb-3 flex items-center gap-2 text-foreground">
                    <Icon size={16} className="text-primary" />
                    <h3 className="text-sm font-semibold">{card.title}</h3>
                  </div>
                  <p className="text-sm text-foreground-secondary">{card.description}</p>
                  <div className="mt-4 flex flex-col gap-2">
                    {card.points.map((point) => (
                <div key={point} className="rounded-xl border border-white/70 bg-white px-4 py-3 text-[13px] text-foreground-secondary">
                        {point}
                      </div>
                    ))}
                  </div>
                  <Link href={card.href} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark">
                    {card.label}
                    <ArrowRight size={14} />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-4 sm:p-6">
          <div className="border-b border-border pb-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-primary">운영 체크</p>
            <h2 className="mt-2 text-[18px] font-semibold text-foreground">지금 바로 손봐야 할 항목</h2>
          </div>
          <div className="mt-5 flex flex-col gap-3">
            <div className="rounded-2xl bg-surface-secondary p-4">
              <p className="text-sm font-semibold text-foreground">부서 운영</p>
              <p className="mt-1 text-sm text-foreground-secondary">
                {departmentsWithoutManager.length > 0
                  ? `부서장 미지정 부서 ${departmentsWithoutManager.length}개가 남아 있습니다.`
                  : '활성 부서는 모두 부서장 연결 상태입니다.'}
              </p>
            </div>
            <div className="rounded-2xl bg-surface-secondary p-4">
              <p className="text-sm font-semibold text-foreground">사용자 배치</p>
              <p className="mt-1 text-sm text-foreground-secondary">
                {unassignedUsers.length > 0
                  ? `부서 미배정 사용자 ${unassignedUsers.length}명을 사용자 관리 탭에서 정리해야 합니다.`
                  : '모든 활성 사용자가 부서에 연결되어 있습니다.'}
              </p>
            </div>
            <div className="rounded-2xl bg-surface-secondary p-4">
              <p className="text-sm font-semibold text-foreground">공유 정책</p>
              <p className="mt-1 text-sm text-foreground-secondary">공유 문서와 코멘트/검토 화면을 기준으로 링크 공유보다 내부 공유와 검토 요청 흐름을 우선 점검합니다.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link href="/shared-documents" className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-white hover:bg-primary transition-colors">공유 문서</Link>
            <Link href="/reviews" className="rounded-xl bg-surface-secondary px-4 py-2.5 text-sm font-medium text-foreground hover:bg-primary-tint hover:text-primary transition-colors">코멘트/검토</Link>
            <Link href={buildReportDraftHref()} className="rounded-xl bg-surface-secondary px-4 py-2.5 text-sm font-medium text-foreground hover:bg-primary-tint hover:text-primary transition-colors">보고서 흐름</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DepartmentsSectionProps {
  departments: Department[];
  onOpenDeptModal: (dept?: Department) => void;
  onDeleteDept: (id: string) => void;
}

export function DepartmentsSection({ departments, onOpenDeptModal, onDeleteDept }: DepartmentsSectionProps) {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex flex-col gap-3 px-4 py-4 border-b border-border sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <h2 className="text-[16px] font-semibold">부서 목록</h2>
        <button
          onClick={() => onOpenDeptModal()}
          className="flex w-full items-center justify-center gap-2 px-4 py-2 rounded-xl bg-foreground text-white text-sm font-medium hover:bg-primary transition-colors sm:w-auto"
        >
          <Plus size={16} /> 부서 추가
        </button>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[720px]">
        <thead>
          <tr className="bg-page-bg">
            <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase">부서명</th>
            <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase">코드</th>
            <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase">설명</th>
            <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase">인원</th>
            <th className="text-right px-6 py-4 text-[12px] font-semibold text-muted uppercase">관리</th>
          </tr>
        </thead>
        <tbody>
          {departments.map((department) => (
            <tr key={department.id} className="border-b border-border last:border-b-0 hover:bg-page-bg/50">
              <td className="px-6 py-5 text-sm font-medium">{department.name}</td>
              <td className="px-6 py-5 text-sm text-muted font-num">{department.code}</td>
              <td className="px-6 py-5 text-sm text-muted">{department.description || '-'}</td>
              <td className="px-6 py-5 text-sm font-num">{department.memberCount}명</td>
              <td className="px-6 py-4 text-right">
                <button onClick={() => onOpenDeptModal(department)} className="p-2 rounded-lg hover:bg-surface-secondary text-foreground-secondary"><Pencil size={14} /></button>
                <button onClick={() => onDeleteDept(department.id)} className="ml-1 p-2 rounded-lg hover:bg-red-50 text-foreground-secondary hover:text-red-500"><Trash2 size={14} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

interface UsersSectionProps {
  users: UserItem[];
  departments: Department[];
  pendingChanges: Record<string, { department_id?: string | null; role?: string }>;
  savingUserId: string | null;
  onOpenUserModal: (user?: UserItem) => void;
  onDeleteUser: (id: string, name: string) => void;
  onSetPendingDept: (userId: string, departmentId: string | null) => void;
  onSetPendingRole: (userId: string, role: string) => void;
  onSaveUserChanges: (userId: string) => void;
}

export function UsersSection({
  users,
  departments,
  pendingChanges,
  savingUserId,
  onOpenUserModal,
  onDeleteUser,
  onSetPendingDept,
  onSetPendingRole,
  onSaveUserChanges,
}: UsersSectionProps) {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex flex-col gap-3 px-4 py-4 border-b border-border sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <h2 className="text-[16px] font-semibold">사용자 목록</h2>
        <button
          onClick={() => onOpenUserModal()}
          className="flex w-full items-center justify-center gap-2 px-4 py-2 rounded-xl bg-foreground text-white text-sm font-medium hover:bg-primary transition-colors sm:w-auto"
        >
          <Plus size={16} /> 사용자 추가
        </button>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[860px]">
        <thead>
          <tr className="bg-page-bg">
            <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase">이름</th>
            <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase">이메일</th>
            <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase">부서</th>
            <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase">역할</th>
            <th className="text-right px-6 py-4 text-[12px] font-semibold text-muted uppercase">관리</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const pending = pendingChanges[user.id];
            const hasPending = !!pending;
            const displayDept = pending?.department_id !== undefined ? (pending.department_id ?? '') : (user.department_id ?? '');
            const displayRole = pending?.role !== undefined ? pending.role : user.role;

            return (
              <tr key={user.id} className={`border-b border-border last:border-b-0 transition-colors ${hasPending ? 'bg-blue-50/60' : 'hover:bg-page-bg/50'}`}>
                <td className="px-6 py-5 text-sm font-medium">{user.name}</td>
                <td className="px-6 py-5 text-sm text-muted">{user.email}</td>
                <td className="px-6 py-4">
                  <select
                    value={displayDept}
                    onChange={(event) => onSetPendingDept(user.id, event.target.value || null)}
                    className={`rounded-lg border bg-transparent px-3 py-2 text-sm ${hasPending && pending?.department_id !== undefined ? 'border-blue-400' : 'border-border'}`}
                  >
                    <option value="">미배정</option>
                    {departments.filter((department) => department.is_active !== false).map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={displayRole}
                    onChange={(event) => onSetPendingRole(user.id, event.target.value)}
                    className={`rounded-lg border bg-transparent px-3 py-2 text-sm ${hasPending && pending?.role !== undefined ? 'border-blue-400' : 'border-border'}`}
                  >
                    {ROLES.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 text-right flex items-center justify-end gap-1.5">
                  {hasPending && (
                    <button
                      onClick={() => onSaveUserChanges(user.id)}
                      disabled={savingUserId === user.id}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-white hover:bg-primary transition-colors disabled:opacity-50"
                    >
                      {savingUserId === user.id ? <Spinner size="sm" /> : <Save size={12} />}
                      저장
                    </button>
                  )}
                  <button onClick={() => onOpenUserModal(user)} className="p-2 rounded-lg hover:bg-surface-secondary text-foreground-secondary"><Pencil size={14} /></button>
                  <button onClick={() => onDeleteUser(user.id, user.name)} className="p-2 rounded-lg hover:bg-red-50 text-foreground-secondary hover:text-red-500"><Trash2 size={14} /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

interface SignatureSectionProps {
  sigLoading: boolean;
  sigUploading: boolean;
  sigUrl: string | null;
  logoLoading: boolean;
  logoUploading: boolean;
  logoUrl: string | null;
  sigFileRef: React.RefObject<HTMLInputElement | null>;
  logoFileRef: React.RefObject<HTMLInputElement | null>;
  onDeleteSignature: () => void;
  onUploadSignature: (file: File) => void;
  onDeleteCompanyLogo: () => void;
  onUploadCompanyLogo: (file: File) => void;
}

export function SignatureSection({
  sigLoading,
  sigUploading,
  sigUrl,
  logoLoading,
  logoUploading,
  logoUrl,
  sigFileRef,
  logoFileRef,
  onDeleteSignature,
  onUploadSignature,
  onDeleteCompanyLogo,
  onUploadCompanyLogo,
}: SignatureSectionProps) {
  return (
    <div className="grid gap-5 max-w-lg">
    <div className="bg-card rounded-2xl border border-border p-8">
      <h2 className="text-[16px] font-semibold mb-1">전자 서명 관리</h2>
      <p className="text-sm text-muted mb-6">문서 다운로드 시 서명란에 자동으로 삽입됩니다. PNG, JPEG, WebP (최대 2MB)</p>

      {sigLoading ? (
        <div className="flex items-center justify-center h-32">
          <Spinner size="lg" />
        </div>
      ) : sigUrl ? (
        <div className="flex flex-col gap-4">
          <div className="relative border border-border rounded-xl overflow-hidden bg-surface-secondary flex items-center justify-center" style={{ height: 140 }}>
            <Image src={sigUrl} alt="내 서명" width={320} height={120} unoptimized style={{ maxHeight: 120, maxWidth: '100%', width: 'auto', objectFit: 'contain' }} />
          </div>
          <div className="flex gap-3.5">
            <button
              onClick={() => sigFileRef.current?.click()}
              disabled={sigUploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-white text-sm font-medium hover:bg-primary transition-colors disabled:opacity-40"
            >
              {sigUploading ? <Spinner size="sm" /> : <Upload size={14} />}
              서명 교체
            </button>
            <button
              onClick={onDeleteSignature}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <X size={14} /> 삭제
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => sigFileRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary hover:bg-blue-50/30 transition-colors"
          style={{ height: 160 }}
        >
          {sigUploading ? (
            <Spinner size="lg" />
          ) : (
            <>
              <PenLine size={28} className="text-muted" />
              <p className="text-sm text-muted font-medium">클릭하여 서명 이미지 등록</p>
              <p className="text-xs text-muted">PNG · JPEG · WebP, 최대 2MB</p>
            </>
          )}
        </div>
      )}

      <input
        ref={sigFileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUploadSignature(file);
          event.target.value = '';
        }}
      />
    </div>

    <div className="bg-card rounded-2xl border border-border p-8">
      <h2 className="text-[16px] font-semibold mb-1">회사 로고 워터마크</h2>
      <p className="text-sm text-muted mb-6">재직증명서 중앙 워터마크로 사용됩니다. PNG, JPEG, WebP (최대 2MB)</p>

      {logoLoading ? (
        <div className="flex items-center justify-center h-32">
          <Spinner size="lg" />
        </div>
      ) : logoUrl ? (
        <div className="flex flex-col gap-4">
          <div className="relative border border-border rounded-xl overflow-hidden bg-surface-secondary flex items-center justify-center" style={{ height: 140 }}>
            <Image src={logoUrl} alt="회사 로고" width={320} height={120} unoptimized style={{ maxHeight: 120, maxWidth: '100%', width: 'auto', objectFit: 'contain' }} />
          </div>
          <div className="flex gap-3.5">
            <button
              onClick={() => logoFileRef.current?.click()}
              disabled={logoUploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-white text-sm font-medium hover:bg-primary transition-colors disabled:opacity-40"
            >
              {logoUploading ? <Spinner size="sm" /> : <Upload size={14} />}
              로고 교체
            </button>
            <button
              onClick={onDeleteCompanyLogo}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <X size={14} /> 삭제
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => logoFileRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary hover:bg-blue-50/30 transition-colors"
          style={{ height: 160 }}
        >
          {logoUploading ? (
            <Spinner size="lg" />
          ) : (
            <>
              <Building2 size={28} className="text-muted" />
              <p className="text-sm text-muted font-medium">클릭하여 회사 로고 등록</p>
              <p className="text-xs text-muted">PNG · JPEG · WebP, 최대 2MB</p>
            </>
          )}
        </div>
      )}

      <input
        ref={logoFileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUploadCompanyLogo(file);
          event.target.value = '';
        }}
      />
    </div>
    </div>
  );
}

/* ── 메뉴 커스터마이즈 ── */

interface MenuOption {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

const MENU_OPTIONS: MenuOption[] = [
  { key: 'shared-documents', label: '공유 문서', description: '공유받은 문서와 배포 중인 문서를 확인합니다', icon: ArrowRightLeft },
  { key: 'messages', label: '메시지', description: '부서 채널과 DM으로 대화합니다', icon: MessageSquare },
  { key: 'meetings', label: '회의', description: '회의 일정 등록과 회의록을 관리합니다', icon: Users },
  { key: 'schedule', label: '일정/할일', description: '월간 캘린더와 할일 목록을 관리합니다', icon: CalendarDays },
  { key: 'memos', label: '메모', description: '아이디어와 메모를 저장하고 연결합니다', icon: StickyNote },
  { key: 'contract-risk', label: '계약 리스크', description: '계약서를 AI로 분석하고 리스크를 검토합니다', icon: ShieldAlert },
];

export function MenusSection() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.fetchMe);
  const [saving, setSaving] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<string[]>((user?.sidebar_menus ?? []) as string[]);

  const toggle = async (key: string) => {
    const next = enabled.includes(key)
      ? enabled.filter((k) => k !== key)
      : [...enabled, key];

    setSaving(key);
    setEnabled(next);

    try {
      await fetch('/api/users/sidebar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menus: next }),
      });
      await setUser();
    } catch {
      setEnabled(enabled);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[15px] font-bold text-foreground">사이드바 메뉴 설정</h3>
        <p className="mt-1 text-[13px] text-foreground-secondary">
          필요한 기능만 켜두면 사이드바에 나타납니다. 파일 등록·AI 검색·새 문서 생성은 항상 표시됩니다.
        </p>
      </div>

      <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
        {MENU_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isOn = enabled.includes(opt.key);
          const isSaving = saving === opt.key;

          return (
            <div key={opt.key} className="flex items-center gap-4 bg-white px-5 py-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-secondary">
                <Icon size={17} strokeWidth={1.5} className="text-foreground-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground">{opt.label}</p>
                <p className="text-[11px] text-foreground-tertiary">{opt.description}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(opt.key)}
                disabled={isSaving}
                className={[
                  'relative flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200',
                  isOn ? 'bg-primary' : 'bg-border',
                  isSaving ? 'opacity-60' : '',
                ].join(' ')}
                aria-label={`${opt.label} ${isOn ? '끄기' : '켜기'}`}
              >
                <span className={[
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
                  isOn ? 'translate-x-5' : 'translate-x-0.5',
                ].join(' ')} />
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-[12px] text-foreground-tertiary">
        설정은 즉시 적용됩니다. 사이드바를 새로고침하면 변경 사항이 반영됩니다.
      </p>
    </div>
  );
}
