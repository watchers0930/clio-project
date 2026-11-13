import { ArrowRightLeft, Banknote, Briefcase, CalendarDays, KeyRound, MessageSquare, ShieldAlert, StickyNote, Users } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useState } from 'react';

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
  { key: 'account-credentials', label: '계정관리', description: '사이트 아이디·비밀번호를 암호화하여 안전하게 보관합니다', icon: KeyRound },
  { key: 'work-ledger', label: '작업내역', description: '프로젝트 계약·수익·수금 일정을 관리합니다', icon: Briefcase },
  { key: 'bulk-transfer', label: '대량이체', description: '거래처 지급 건을 모아 하나은행 대량이체 파일을 생성합니다', icon: Banknote },
];

export function MenusSection() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.fetchMe);
  const [saving, setSaving] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<string[]>((user?.sidebar_menus ?? []) as string[]);

  // 대량이체는 대표(rank_level<=1)·관리자(role='admin')만 설정 가능(사이드바 노출 조건과 동일).
  const rankLevel = (user as { rank_level?: number | null } | null)?.rank_level;
  const canViewAdminMenu = user?.role === 'admin' || (typeof rankLevel === 'number' && rankLevel <= 1);
  const visibleOptions = MENU_OPTIONS.filter((opt) => canViewAdminMenu || opt.key !== 'bulk-transfer');

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
        {visibleOptions.map((opt) => {
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
