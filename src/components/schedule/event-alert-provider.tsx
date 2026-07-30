'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import { EventAlertModal } from './event-alert-modal';
import type { CalendarEvent } from '@/lib/supabase/types';

const STORAGE_KEY = 'event_alert_suppressed_date';

interface EventAlertContextValue {
  tomorrowEvents: CalendarEvent[];
}

const EventAlertContext = createContext<EventAlertContextValue>({ tomorrowEvents: [] });

export function useEventAlert() {
  return useContext(EventAlertContext);
}

export function EventAlertProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showModal, setShowModal] = useState(false);

  const fetchAndCheck = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const suppressed = localStorage.getItem(STORAGE_KEY);
      if (suppressed === today) return;
    } catch {
      // ignore
    }

    try {
      const tomorrow = addDays(new Date(), 1);
      const start = startOfDay(tomorrow).toISOString();
      const end = endOfDay(tomorrow).toISOString();
      const res = await fetch(`/api/events?start=${start}&end=${end}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        setEvents(data.data);
        setShowModal(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // 마운트 후 1초 뒤 체크 (레이아웃 렌더 완료 후)
    const timer = setTimeout(fetchAndCheck, 1000);
    return () => clearTimeout(timer);
  }, [fetchAndCheck]);

  const handleClose = () => setShowModal(false);

  const handleSuppress = () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem(STORAGE_KEY, today);
    } catch {
      // ignore
    }
    setShowModal(false);
  };

  return (
    <EventAlertContext.Provider value={{ tomorrowEvents: events }}>
      {children}
      <EventAlertModal
        open={showModal}
        events={events}
        onClose={handleClose}
        onSuppress={handleSuppress}
      />
    </EventAlertContext.Provider>
  );
}
