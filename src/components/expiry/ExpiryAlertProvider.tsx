'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ExpiryAlertModal } from './ExpiryAlertModal';
import type { ExpiryItem, ExpirySummaryResponse } from '@/types/expiry';

const STORAGE_KEY = 'expiry_modal_suppressed_date';

interface ExpiryAlertContextValue {
  items: ExpiryItem[];
  isLoading: boolean;
  refetch: () => void;
}

const ExpiryAlertContext = createContext<ExpiryAlertContextValue>({
  items: [],
  isLoading: false,
  refetch: () => {},
});

export function useExpiryAlert() {
  return useContext(ExpiryAlertContext);
}

export function ExpiryAlertProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ExpiryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fetchAndCheck = useCallback(async () => {
    // 1. 오늘 이미 "다시 보지 않기" 했는지 확인
    const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
    try {
      const suppressed = localStorage.getItem(STORAGE_KEY);
      if (suppressed === today) return;
    } catch {
      // localStorage 접근 불가 (시크릿 모드 등) → 계속 진행
    }

    // 2. API 호출
    setIsLoading(true);
    try {
      const res = await fetch('/api/dashboard/expiry-summary?days=30&limit=10');
      if (!res.ok) return;
      const data: ExpirySummaryResponse = await res.json();
      if (data.items?.length > 0) {
        setItems(data.items);
        setShowModal(true);
      }
    } catch {
      // 알림 실패가 앱 전체를 막으면 안 되므로 조용히 처리
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndCheck();
  }, [fetchAndCheck]);

  const handleDismissToday = () => {
    const today = new Date().toISOString().split('T')[0];
    try {
      localStorage.setItem(STORAGE_KEY, today);
    } catch {
      // localStorage 접근 불가 시 무시
    }
    setShowModal(false);
  };

  return (
    <ExpiryAlertContext.Provider value={{ items, isLoading, refetch: fetchAndCheck }}>
      {children}
      {showModal && (
        <ExpiryAlertModal
          items={items}
          onDismissToday={handleDismissToday}
          onClose={() => setShowModal(false)}
        />
      )}
    </ExpiryAlertContext.Provider>
  );
}
