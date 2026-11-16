'use client';

import { useState } from 'react';
import { csrfFetch } from '@/hooks/csrf-client';
import { requestJsonOk } from '@/lib/http/read-json-ok';

// 본인 비밀번호 변경 요청 — 실패하면 사유를 error 로 돌려줘 입력창이 닫히지 않게 한다
export function usePasswordChange() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    if (submitting) return false;
    setSubmitting(true);
    setError(null);
    try {
      await requestJsonOk(
        () => csrfFetch('/api/auth/password', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword }),
        }),
        '비밀번호를 변경하지 못했습니다.',
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : '비밀번호를 변경하지 못했습니다.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return { submit, submitting, error, setError };
}
