'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui';
import { startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { getCalendarDays } from '@/lib/schedule-utils';
import CalendarHeader from '@/components/schedule/calendar-header';
import CalendarGrid from '@/components/schedule/calendar-grid';
import DayDetailPanel from '@/components/schedule/day-detail-panel';
import EventFormModal from '@/components/schedule/event-form-modal';
import type { EventFormData } from '@/components/schedule/event-form-modal';
import TodoList from '@/components/schedule/todo-list';
import TodoFormModal from '@/components/schedule/todo-form-modal';
import type { CalendarEvent, TodoItem, TodoStatus, TodoPriority } from '@/lib/supabase/types';

function toLocalDatetime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

export default function SchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  // 상세 패널
  const [detailDate, setDetailDate] = useState<Date | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // 일정 폼 모달
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [formDefaultDate, setFormDefaultDate] = useState<Date | null>(null);
  const [formDefaultEnd, setFormDefaultEnd] = useState<Date | null>(null);

  // 할일
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoFilter, setTodoFilter] = useState<TodoStatus | 'all'>('all');
  const [todoModalOpen, setTodoModalOpen] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null);

  useEffect(() => {
    fetch('/api/departments')
      .then((r) => r.json())
      .then((res) => { if (res.success) setDepartments(res.data ?? []); })
      .then(() => {}, () => {});
  }, []);

  const fetchEvents = useCallback(() => {
    setLoading(true);
    const start = startOfMonth(new Date(year, month)).toISOString();
    const end = endOfMonth(new Date(year, month)).toISOString();
    const params = new URLSearchParams({ start, end });
    if (selectedDept) params.set('department_id', selectedDept);
    fetch(`/api/events?${params}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((res) => { if (res.success) setEvents(res.data ?? []); })
      .then(() => {}, () => {})
      .finally(() => setLoading(false));
  }, [year, month, selectedDept]);

  useEffect(() => {
    const t = setTimeout(fetchEvents, 0);
    return () => clearTimeout(t);
  }, [fetchEvents]);

  const fetchTodos = useCallback(() => {
    fetch('/api/todos?status=all')
      .then((r) => r.json())
      .then((res) => { if (res.success) setTodos(res.data ?? []); })
      .then(() => {}, () => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchTodos, 0);
    return () => clearTimeout(t);
  }, [fetchTodos]);

  const goNextMonth = () => { const d = addMonths(new Date(year, month), 1); setYear(d.getFullYear()); setMonth(d.getMonth()); };
  const goPrevMonth = () => { const d = subMonths(new Date(year, month), 1); setYear(d.getFullYear()); setMonth(d.getMonth()); };
  const goToday = () => { const t = new Date(); setYear(t.getFullYear()); setMonth(t.getMonth()); };

  // 날짜 클릭 → 상세 패널
  const handleDateClick = (date: Date) => {
    setDetailDate(date);
    setDetailOpen(true);
  };

  // 이벤트 바 클릭 → 편집 폼 바로 열기
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setFormDefaultDate(null);
    setFormDefaultEnd(null);
    setEventModalOpen(true);
  };

  // 드래그로 날짜 범위 선택 → 생성 폼 (범위 미리채움)
  const handleRangeSelect = (start: Date, end: Date) => {
    setSelectedEvent(null);
    setFormDefaultDate(start);
    setFormDefaultEnd(end);
    setEventModalOpen(true);
  };

  // 상세 패널에서 "수정" 클릭
  const handleEditEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setFormDefaultDate(null);
    setFormDefaultEnd(null);
    setEventModalOpen(true);
  };

  // 상세 패널에서 "새 일정" 클릭
  const handleCreateFromDetail = () => {
    setSelectedEvent(null);
    setFormDefaultDate(detailDate);
    setFormDefaultEnd(null);
    setEventModalOpen(true);
  };

  const handleCreateEvent = async (data: EventFormData) => {
    const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const json = await res.json();
    if (json.success) fetchEvents();
  };

  const handleUpdateEvent = async (data: EventFormData) => {
    if (!selectedEvent) return;
    const res = await fetch(`/api/events/${selectedEvent.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const json = await res.json();
    if (json.success) fetchEvents();
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    const res = await fetch(`/api/events/${selectedEvent.id}`, { method: 'DELETE' });
    if ((await res.json()).success) fetchEvents();
  };

  const handleCreateTodo = async (data: { title: string; description: string; due_date: string; priority: TodoPriority }) => {
    const res = await fetch('/api/todos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if ((await res.json()).success) fetchTodos();
  };
  const handleUpdateTodo = async (data: { title: string; description: string; due_date: string; priority: TodoPriority }) => {
    if (!selectedTodo) return;
    const res = await fetch(`/api/todos/${selectedTodo.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if ((await res.json()).success) fetchTodos();
  };
  const handleToggleTodo = async (id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const newStatus = todo.status === 'active' ? 'completed' : 'active';
    const res = await fetch(`/api/todos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
    if ((await res.json()).success) fetchTodos();
  };
  const handleDeleteTodo = async (id: string) => {
    const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    if ((await res.json()).success) fetchTodos();
  };

  const activeTodoCount = todos.filter((t) => t.status === 'active').length;
  const completedTodoCount = todos.filter((t) => t.status === 'completed').length;

  const visibleCalendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);
  const visibleCalendarStart = visibleCalendarDays[0];
  const visibleCalendarEnd = visibleCalendarDays[visibleCalendarDays.length - 1];
  const visibleTodos = todos.filter((todo) => {
    if (!todo.due_date) return false;
    const dueDate = new Date(`${todo.due_date}T00:00:00`);
    return dueDate >= visibleCalendarStart && dueDate <= visibleCalendarEnd;
  });

  const scheduleFocus =
    selectedEvent?.title ||
    todos.find((t) => t.status === 'active')?.title ||
    '회의와 실행 일정';

  // 폼 기본값 계산 (범위 드래그 or 날짜 클릭)
  const formDefaultDateValue = useMemo(() => {
    if (!formDefaultDate) return null;
    const d = new Date(formDefaultDate);
    d.setHours(9, 0, 0, 0);
    return d;
  }, [formDefaultDate]);

  const formDefaultEndValue = useMemo(() => {
    if (formDefaultEnd) {
      const d = new Date(formDefaultEnd);
      d.setHours(18, 0, 0, 0);
      return d;
    }
    if (formDefaultDate) {
      const d = new Date(formDefaultDate);
      d.setHours(10, 0, 0, 0);
      return d;
    }
    return null;
  }, [formDefaultDate, formDefaultEnd]);

  return (
    <div className="flex flex-col gap-5 pb-10">
      <section className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-5 px-6 py-5 sm:px-8 sm:py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[20px] font-bold text-foreground">일정 / 할일</h1>
              <p className="mt-1.5 text-[13px] text-foreground-secondary">
                회의 일정과 실행 항목을 정리하고, 관련 문서를 찾아 회의록이나 보고서로 이어갑니다.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/meetings')}
                className="h-9 rounded-xl bg-foreground px-4 text-[13px] font-medium text-white transition-colors hover:bg-primary"
              >
                회의 허브
              </button>
              <button
                onClick={() => {
                  const params = new URLSearchParams({ q: scheduleFocus });
                  router.push(`/search?${params.toString()}`);
                }}
                className="h-9 rounded-xl border border-border bg-white px-4 text-[13px] font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary"
              >
                관련 문서 검색
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold text-foreground-tertiary">다가오는 일정</p>
                <p className="text-[18px] font-bold text-foreground font-num leading-tight">{events.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold text-foreground-tertiary">진행 중 할일</p>
                <p className="text-[18px] font-bold text-foreground font-num leading-tight">{activeTodoCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold text-foreground-tertiary">완료된 할일</p>
                <p className="text-[18px] font-bold text-foreground font-num leading-tight">{completedTodoCount}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)]">
        <section className="min-w-0">
          {loading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              <CalendarHeader
                year={year}
                month={month}
                onPrev={goPrevMonth}
                onNext={goNextMonth}
                onToday={goToday}
                departments={departments}
                selectedDept={selectedDept}
                onDeptChange={setSelectedDept}
              />
              <CalendarGrid
                year={year}
                month={month}
                events={events}
                todos={todos}
                selectedDate={detailDate}
                onDateClick={handleDateClick}
                onEventClick={handleEventClick}
                onTodoClick={(todo) => { setSelectedTodo(todo); setTodoModalOpen(true); }}
                onRangeSelect={handleRangeSelect}
              />
            </>
          )}
        </section>

        <aside className="min-w-0 rounded-xl border border-border bg-white p-4 shadow-sm xl:sticky xl:top-24 xl:self-start">
          <TodoList
            todos={visibleTodos}
            filter={todoFilter}
            onFilterChange={setTodoFilter}
            onAdd={() => { setSelectedTodo(null); setTodoModalOpen(true); }}
            onToggle={handleToggleTodo}
            onEdit={(todo) => { setSelectedTodo(todo); setTodoModalOpen(true); }}
            onDelete={handleDeleteTodo}
          />
        </aside>
      </div>

      {/* 날짜 상세 패널 */}
      <DayDetailPanel
        open={detailOpen}
        date={detailDate}
        events={events}
        todos={todos}
        onClose={() => setDetailOpen(false)}
        onEditEvent={handleEditEvent}
        onEditTodo={(todo) => { setSelectedTodo(todo); setTodoModalOpen(true); }}
        onCreateEvent={handleCreateFromDetail}
      />

      {/* 일정 폼 모달 */}
      <EventFormModal
        open={eventModalOpen}
        onClose={() => { setEventModalOpen(false); setSelectedEvent(null); setFormDefaultDate(null); setFormDefaultEnd(null); }}
        onSubmit={selectedEvent ? handleUpdateEvent : handleCreateEvent}
        onDelete={selectedEvent ? handleDeleteEvent : undefined}
        event={selectedEvent}
        defaultDate={formDefaultDateValue}
        defaultEndDate={formDefaultEndValue}
        departments={departments}
      />

      {/* 할일 모달 */}
      <TodoFormModal
        open={todoModalOpen}
        onClose={() => { setTodoModalOpen(false); setSelectedTodo(null); }}
        onSubmit={selectedTodo ? handleUpdateTodo : handleCreateTodo}
        todo={selectedTodo}
      />
    </div>
  );
}
