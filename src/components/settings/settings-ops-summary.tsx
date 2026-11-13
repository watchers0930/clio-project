import Link from 'next/link';
import { buildReportDraftHref } from '@/lib/documents/navigation';
import { ArrowRight, Building2, FileText, Share2, ShieldCheck, Users } from 'lucide-react';
import type { Department, UserItem } from '@/components/settings/types';

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
