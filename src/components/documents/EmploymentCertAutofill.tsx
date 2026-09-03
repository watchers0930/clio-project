'use client';

import { useEffect, useRef, useState } from 'react';

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
}

/**
 * 재직증명서: 로그인 본인 프로필을 조회해 상위 폼에 자동 채우고,
 * 자동입력된 값을 읽기전용으로 보여준다. (사용자는 제출용도만 입력)
 */
export function EmploymentCertAutofill({ onLoaded }: EmploymentCertAutofillProps) {
  const [profile, setProfile] = useState<SelfProfile | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    fetch('/api/users/profile')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setProfile(j.data);
          onLoaded(j.data);
        }
      })
      .catch(() => {});
  }, [onLoaded]);

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
      <p className="text-xs font-medium text-foreground-secondary" style={{ marginBottom: 8 }}>
        로그인 계정 정보로 자동 입력됩니다 (수정하려면 설정 &gt; 사용자에서 변경)
      </p>
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
