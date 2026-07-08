'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui';
import { startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { getCalendarDays } from '@/lib/schedule-utils';
import CalendarHeader from '@/components/schedule/calendar-header';
import CalendarGrid from '@/components/schedule/calendar-grid';
import EventFormModal from '@/components/schedule/event-form-modal';
import type { EventFormData } from '@/components/schedule/event-form-modal';
import TodoList from '@/components/schedule/todo-list';
import TodoFormModal from '@/components/schedule/todo-form-modal';
import type { CalendarEvent, TodoItem, TodoStatus, TodoPriority } from '@/lib/supabase/types';

export default function SchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // 캘린더 상태
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  // 할일 상태
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoFilter, setTodoFilter] = useState<TodoStatus | 'all'>('all');
  const [todoModalOpen, setTodoModalOpen] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null);

  // 부서 목록 로드
  useEffect(() => {
    fetch('/api/departments')
      .then((r) => r.json())
      .then((res) => { if (res.success) setDepartments(res.data ?? []); })
      .then(() => {}, () => {});
  }, []);

  // 일정 로드
  const fetchEvents = useCallback(() => {
    setLoading(true);
    const start = startOfMonth(new Date(year, month)).toISOString();
    const end = endOfMonth(new Date(year, month)).toISOString();
    const params = new URLSearchParams({ start, end });
    if (selectedDept) params.set('department_id', selectedDept);

    fetch(`/api/events?${params}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setEvents(res.data ?? []); })
      .then(() => {}, () => {})
      .finally(() => setLoading(false));
  }, [year, month, selectedDept]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEvents();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchEvents]);

  // 할일 로드
  const fetchTodos = useCallback(() => {
    fetch('/api/todos?status=all')
      .then((r) => r.json())
      .then((res) => { if (res.success) setTodos(res.data ?? []); })
      .then(() => {}, () => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTodos();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchTodos]);

  // 월 이동
  const goNextMonth = () => { const d = addMonths(new Date(year, month), 1); setYear(d.getFullYear()); setMonth(d.getMonth()); };
  const goPrevMonth = () => { const d = subMonths(new Date(year, month), 1); setYear(d.getFullYear()); setMonth(d.getMonth()); };
  const goToday = () => { const t = new Date(); setYear(t.getFullYear()); setMonth(t.getMonth()); };

  // 일정 CRUD
  const handleCreateEvent = async (data: EventFormData) => {
    const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if ((await res.json()).success) fetchEvents();
  };
  const handleUpdateEvent = async (data: EventFormData) => {
    if (!selectedEvent) return;
    const res = await fetch(`/api/events/${selectedEvent.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if ((await res.json()).success) fetchEvents();
  };
  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    const res = await fetch(`/api/events/${selectedEvent.id}`, { method: 'DELETE' });
    if ((await res.json()).success) fetchEvents();
  };

  // 할일 CRUD
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

      {/* 콘텐츠 */}
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
                selectedDate={selectedDate}
                onDateClick={(date) => {
                  setSelectedDate(date);
                  setSelectedEvent(null);
                  setEventModalOpen(true);
                }}
                onEventClick={(event) => {
                  setSelectedEvent(event);
                  setSelectedDate(null);
                  setEventModalOpen(true);
                }}
                onTodoClick={(todo) => {
                  setSelectedTodo(todo);
                  setTodoModalOpen(true);
                }}
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

      {/* 일정 모달 */}
      <EventFormModal
        open={eventModalOpen}
        onClose={() => { setEventModalOpen(false); setSelectedEvent(null); setSelectedDate(null); }}
        onSubmit={selectedEvent ? handleUpdateEvent : handleCreateEvent}
        onDelete={selectedEvent ? handleDeleteEvent : undefined}
        event={selectedEvent}
        defaultDate={selectedDate}
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
