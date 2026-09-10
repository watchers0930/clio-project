'use client';

import { useState, useCallback } from 'react';
import type { SearchResult } from './types';

interface GmailTarget {
  messageId: string;
  name: string;
}

/**
 * 검색 화면의 Gmail 결과 액션(본문 보기 모달 / 첨부파일 모달 / Gmail 웹 열기)을 캡슐화.
 * page.tsx의 상태·핸들러 부담을 줄이기 위한 훅(단일 책임: Gmail 결과 상호작용).
 */
export function useGmailActions() {
  const [emailTarget, setEmailTarget] = useState<GmailTarget | null>(null);
  const [attachmentTarget, setAttachmentTarget] = useState<GmailTarget | null>(null);

  const openEmail = useCallback((result: SearchResult) => {
    if (!result.externalId) return;
    setEmailTarget({ messageId: result.externalId, name: result.name });
  }, []);

  const openAttachments = useCallback((result: SearchResult) => {
    if (!result.externalId) return;
    setAttachmentTarget({ messageId: result.externalId, name: result.name });
  }, []);

  const closeEmail = useCallback(() => setEmailTarget(null), []);
  const closeAttachments = useCallback(() => setAttachmentTarget(null), []);

  return {
    emailTarget,
    attachmentTarget,
    openEmail,
    openAttachments,
    closeEmail,
    closeAttachments,
  };
}
