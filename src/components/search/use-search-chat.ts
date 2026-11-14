'use client';

import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, SearchResult } from './types';

/**
 * 검색 화면의 AI 질의응답(채팅 상태 + 전송)을 캡슐화.
 * page.tsx의 상태·핸들러 부담을 줄이기 위한 훅(단일 책임: AI 채팅).
 */
export function useSearchChat(results: SearchResult[]) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [pinnedFileIds, setPinnedFileIds] = useState<string[] | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // AI 채팅 전송
  const sendChat = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: msg };
    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    setChatInput('');
    setChatLoading(true);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: chatMessages,
          fileIds: pinnedFileIds ?? (results.length > 0 ? results.map((r) => r.id) : undefined),
        }),
      });
      const data = await res.json();
      setChatMessages([...nextHistory, {
        role: 'assistant',
        content: data.answer ?? data.error ?? '오류가 발생했습니다.',
      }]);
    } catch {
      setChatMessages([...nextHistory, { role: 'assistant', content: '네트워크 오류가 발생했습니다.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [chatInput, chatMessages, chatLoading, results]);

  return {
    chatMessages,
    setChatMessages,
    chatInput,
    setChatInput,
    chatLoading,
    pinnedFileIds,
    setPinnedFileIds,
    chatEndRef,
    sendChat,
  };
}
