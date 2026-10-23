'use client';

import { useCallback, useEffect } from 'react';
import { buildUserAutofill, type UserProfile } from '@/lib/templates/user-autofill';
import type { TemplateFieldDefinition } from '@/lib/templates/template-schema';
import { useSelfProfile } from '@/components/documents/use-self-profile';

/**
 * 입력폼 자동채움 정책.
 *
 * - create: 기존 생성 동작 보존.
 *     · 로그인 사용자 본인 정보를 "비어 있는" 필드에만 프리필한다.
 *     · 주간업무 보고기간을 이번 주(월~금)로 자동 설정한다(비어 있을 때만).
 * - edit:  마운트만으로는 저장값을 절대 바꾸지 않는다. 프로필 재적용은 applyUserProfile()
 *          (명시적 사용자 동작)으로만 수행한다.
 *
 * 단일 책임: 자동채움 정책만 담당한다. 필드 UI·저장·파싱은 다른 단위가 담당한다.
 */
function thisWeekPeriod(): string {
  const d = new Date();
  const dow = d.getDay(); // 0=일 ~ 6=토
  const mon = new Date(d);
  mon.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  const fmt = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return `${fmt(mon)} ~ ${fmt(fri)}`;
}

export function useDocumentInputAutofill(params: {
  mode: 'create' | 'edit';
  templateName?: string | null;
  templateFields: ReadonlyArray<TemplateFieldDefinition>;
  isWeeklyReport: boolean;
  reportPeriod?: string;
  onSetDocumentInputs: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
}) {
  const { mode, templateName, templateFields, isWeeklyReport, reportPeriod, onSetDocumentInputs } = params;
  // 프로필은 공용 캐시 훅으로 조회(재직증명서 UI와 요청 공유 → /api/users/profile 중복 호출 제거).
  // edit 모드에서도 "현재 프로필 반영"에 대비해 받아두되, 마운트만으로 값을 덮지는 않는다.
  const { profile: rawProfile } = useSelfProfile();
  const profile = (rawProfile as UserProfile | null) ?? null;

  const fieldKeysSig = templateFields.map((f) => f.key).join(',');

  // create: 비어 있는 필드에만 프리필 (기존 동작)
  useEffect(() => {
    if (mode !== 'create' || !profile || !templateName) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- templateFields는 fieldKeysSig로 내용 변경 감지
  }, [mode, profile, templateName, fieldKeysSig, onSetDocumentInputs]);

  // create: 주간업무 보고기간 이번 주 자동 설정 (비어 있을 때만)
  useEffect(() => {
    if (mode !== 'create' || !isWeeklyReport || reportPeriod?.trim()) return;
    const period = thisWeekPeriod();
    onSetDocumentInputs((prev) => (prev.report_period?.trim() ? prev : { ...prev, report_period: period }));
  }, [mode, isWeeklyReport, reportPeriod, onSetDocumentInputs]);

  // 명시적 프로필 재적용(주로 edit): 비어있든 아니든 프로필 값으로 덮어쓴다.
  const applyUserProfile = useCallback(() => {
    if (!profile || !templateName) return;
    const autofill = buildUserAutofill(profile, templateFields, templateName);
    const keys = Object.keys(autofill);
    if (keys.length === 0) return;
    onSetDocumentInputs((prev) => {
      const next = { ...prev };
      for (const key of keys) {
        if (autofill[key]?.trim()) next[key] = autofill[key];
      }
      return next;
    });
  }, [profile, templateName, templateFields, onSetDocumentInputs]);

  return { profileLoaded: !!profile, applyUserProfile };
}
