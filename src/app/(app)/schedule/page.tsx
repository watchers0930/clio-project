'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, CheckSquare, Search, Sparkles } from 'lucide-react';
import { Spinner, Tabs } from '@/components/ui';
import { startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import CalendarHeader from '@/components/schedule/calendar-header';
import CalendarGrid from '@/components/schedule/calendar-grid';
import EventFormModal from '@/components/schedule/event-form-modal';
import type { EventFormData } from '@/components/schedule/event-form-modal';
import TodoList from '@/components/schedule/todo-list';
import TodoFormModal from '@/components/schedule/todo-form-modal';
import type { CalendarEvent, TodoItem, TodoStatus, TodoPriority } from '@/lib/supabase/types';

type Tab = 'calendar' | 'todo';

export default function SchedulePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('calendar');
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
  const scheduleFocus =
    selectedEvent?.title ||
    todos.find((t) => t.status === 'active')?.title ||
    '회의와 실행 일정';

  return (
    <div className="space-y-[25px] pb-10">
      <section className="rounded-[28px] border border-[#e5e5e7] bg-white overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <div className="px-4 py-5 sm:px-6 sm:py-6 xl:px-[30px] xl:py-[30px]">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0071e3]">Schedule Workflow</p>
              <h1 className="text-[24px] font-bold leading-[1.25] text-[#1d1d1f] sm:text-[28px]">일정 / 할일</h1>
              <p className="max-w-2xl text-[15px] text-[#6e6e73]" style={{ lineHeight: '20px' }}>
                일정과 할일도 문서 운영의 실행 단계입니다. 회의 일정과 실행 항목을 정리한 뒤,
                관련 문서를 찾고 회의록, 보고서, 후속 실행 문서로 바로 이어갈 수 있습니다.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <MetricCard label="다가오는 일정" value={events.length} />
                <MetricCard label="진행 중 할일" value={activeTodoCount} />
                <MetricCard label="완료된 할일" value={completedTodoCount} />
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => router.push('/meetings')}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0071e3] transition-colors"
                >
                  <CalendarDays size={16} />
                  회의 허브
                </button>
                <button
                  onClick={() => {
                    const params = new URLSearchParams({ q: scheduleFocus });
                    router.push(`/search?${params.toString()}`);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D7E7FF] bg-white px-4 py-2.5 text-sm font-medium text-[#2E6FF2] hover:bg-[#F3F8FF] transition-colors"
                >
                  <Search size={16} />
                  관련 문서 검색
                </button>
                <button
                  onClick={() => {
                    const params = new URLSearchParams({
                      create: 'true',
                      instructions: `${scheduleFocus}와 관련된 회의/실행 문서를 작성하세요.`,
                    });
                    router.push(`/documents?${params.toString()}`);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D7EFDE] bg-white px-4 py-2.5 text-sm font-medium text-[#258A4E] hover:bg-[#F4FBF6] transition-colors"
                >
                  <Sparkles size={16} />
                  일정 기반 문서 작성
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-[#e5e5e7] bg-[#fbfbfc] px-4 py-5 sm:px-6 sm:py-6 xl:border-t-0 xl:border-l xl:px-[28px] xl:py-[28px]">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7C8494]">Recommended Flow</p>
              <div className="flex flex-col gap-3">
                <QuickAction
                  title="1. 일정 우선순위를 정합니다"
                  description={`현재 기준 항목은 "${scheduleFocus}"입니다. 일정과 할일 중 먼저 처리할 대상을 정합니다.`}
                  onClick={() => setActiveTab('calendar')}
                />
                <QuickAction
                  title="2. 관련 문서를 찾습니다"
                  description="회의 일정과 실행 항목을 바로 검색으로 넘겨 참고 자료와 기존 문서를 확인합니다."
                  onClick={() => {
                    const params = new URLSearchParams({ q: scheduleFocus });
                    router.push(`/search?${params.toString()}`);
                  }}
                />
                <QuickAction
                  title="3. 문서 작성으로 이어갑니다"
                  description="회의록, 후속 보고서, 실행 문서를 일정 문맥 그대로 생성 흐름으로 넘깁니다."
                  onClick={() => {
                    const params = new URLSearchParams({
                      create: 'true',
                      instructions: `${scheduleFocus}와 관련된 회의/실행 문서를 작성하세요.`,
                    });
                    router.push(`/documents?${params.toString()}`);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div>
        <Tabs
          className=""
          tabs={[
            { id: 'calendar', label: '캘린더', icon: <CalendarDays size={14} /> },
            { id: 'todo', label: '할일', icon: <CheckSquare size={14} />, count: activeTodoCount || undefined },
          ]}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as Tab)}
        />
      </div>

      {/* 콘텐츠 */}
      <div>
      {activeTab === 'calendar' ? (
        loading ? (
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
            />
          </>
        )
      ) : (
        <TodoList
          todos={todos}
          filter={todoFilter}
          onFilterChange={setTodoFilter}
          onAdd={() => { setSelectedTodo(null); setTodoModalOpen(true); }}
          onToggle={handleToggleTodo}
          onEdit={(todo) => { setSelectedTodo(todo); setTodoModalOpen(true); }}
          onDelete={handleDeleteTodo}
        />
      )}
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

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#E2E5EA] bg-[#f8f8fa] px-5 py-4">
      <p className="text-[12px] text-[#6e6e73]">{label}</p>
      <p className="mt-1 text-[20px] font-bold text-[#1d1d1f] font-num">{value}</p>
    </div>
  );
}

function QuickAction({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-[#E2E5EA] bg-white px-5 py-4 text-left hover:border-[#0071e3]/35 transition-colors">
      <p className="text-[14px] font-semibold text-[#1d1d1f]">{title}</p>
      <p className="mt-1 text-[12px] leading-5 text-[#6e6e73]">{description}</p>
    </button>
  );
}
