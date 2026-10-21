'use client';

import { useEffect, useState } from 'react';
import { buildUserAutofill, type UserProfile } from '@/lib/templates/user-autofill';

/**
 * 새 문서 작성 폼에서 로그인 사용자 본인 정보를 비어 있는 필드에만 프리필한다.
 * - 프로필은 모달 생애주기 중 1회 조회(/api/users/profile).
 * - 사용자가 이미 입력했거나 다른 경로(휴가원 직원 선택 등)로 채운 값은 덮지 않는다.
 */
export function useDocumentUserAutofill(params: {
  templateName?: string | null;
  templateFields: ReadonlyArray<{ key: string }>;
  onSetDocumentInputs: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
}) {
  const { templateName, templateFields, onSetDocumentInputs } = params;
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/users/profile');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.success && data.data) setProfile(data.data as UserProfile);
      } catch {
        // 프로필 조회 실패 시 프리필만 생략한다(문서 작성 자체는 영향 없음).
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 필드 목록은 매 렌더 새 배열일 수 있어 key 시그니처로 변경을 감지한다.
  const fieldKeysSig = templateFields.map((f) => f.key).join(',');

  useEffect(() => {
    if (!profile || !templateName) return;
    const autofill = buildUserAutofill(profile, templateFields, templateName);
    const keys = Object.keys(autofill);
    if (keys.length === 0) return;
    onSetDocumentInputs((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of keys) {
        if (!next[key]?.trim()) {
          next[key] = autofill[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // templateFields는 fieldKeysSig로 변경 감지 (참조 동일성 대신 내용 기준)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, templateName, fieldKeysSig, onSetDocumentInputs]);
}
