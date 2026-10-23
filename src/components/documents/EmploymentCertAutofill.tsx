'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useSelfProfile } from '@/components/documents/use-self-profile';

export interface SelfProfile {
  name: string;
  resident_no: string;
  address: string;
  department: string;
  position: string;
  hire_date: string;
}

interface EmploymentCertAutofillProps {
  onLoaded: (profile: SelfProfile) => void;
  /**
   * create: 조회 즉시 상위 폼에 자동 반영(기존 생성 동작).
   * edit:   자동 반영하지 않고 현재 계정 프로필을 보여주기만 하며,
   *         "현재 프로필 반영" 버튼을 눌러야 저장값에 적용한다(저장 당시 인적사항 보존).
   */
  mode?: 'create' | 'edit';
}

/**
 * 재직증명서: 로그인 본인 프로필을 조회한다.
 * - create: 자동으로 상위 폼에 채우고 읽기전용으로 보여준다(사용자는 제출용도만 입력).
 * - edit:   저장값은 폼에서 유지하고, 명시적 버튼으로만 현재 프로필을 반영한다.
 */
export function EmploymentCertAutofill({ onLoaded, mode = 'create' }: EmploymentCertAutofillProps) {
  // 프로필 조회는 공용 캐시 훅에 위임한다(생성 자동채움 훅과 요청 공유 → 중복 호출 제거).
  const { profile: raw } = useSelfProfile();
  const profile = useMemo<SelfProfile | null>(
    () =>
      raw
        ? {
            name: raw.name ?? '',
            resident_no: raw.resident_no ?? '',
            address: raw.address ?? '',
            department: raw.department ?? '',
            position: raw.position ?? '',
            hire_date: raw.hire_date ?? '',
          }
        : null,
    [raw],
  );
  // create 모드: 프로필이 처음 도착할 때 1회만 상위 폼에 자동 반영.
  // edit 모드: 마운트·재마운트만으로 저장값을 덮지 않는다(명시적 버튼으로만 적용).
  const appliedRef = useRef(false);
  useEffect(() => {
    if (mode !== 'create' || !profile || appliedRef.current) return;
    appliedRef.current = true;
    onLoaded(profile);
  }, [mode, profile, onLoaded]);

  if (!profile) {
    return (
      <div className="rounded-xl border border-border bg-surface-secondary p-3 text-xs text-foreground-secondary">
        내 정보를 불러오는 중…
      </div>
    );
  }

  const rows: [string, string][] = [
    ['성명', profile.name],
    ['주민등록번호', profile.resident_no],
    ['근무부서', profile.department],
    ['직위', profile.position],
    ['재직 시작일', profile.hire_date],
    ['주소', profile.address],
  ];

  return (
    <div className="rounded-xl border border-border bg-surface-secondary p-3">
      <div className="flex items-start justify-between gap-2" style={{ marginBottom: 8 }}>
        <p className="text-xs font-medium text-foreground-secondary">
          {mode === 'edit'
            ? '현재 계정 프로필 (저장된 인적사항은 유지됩니다)'
            : '로그인 계정 정보로 자동 입력됩니다 (수정하려면 설정 > 사용자에서 변경)'}
        </p>
        {mode === 'edit' && (
          <button
            type="button"
            onClick={() => onLoaded(profile)}
            className="shrink-0 rounded-lg border border-primary px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary-tint"
          >
            현재 프로필 반영
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-2 text-[13px]">
            <span className="shrink-0 text-foreground-tertiary">{label}</span>
            <span className="min-w-0 truncate font-medium text-foreground">{value || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
