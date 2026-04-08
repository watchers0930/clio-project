'use client';

import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, CheckSquare, Loader2 } from 'lucide-react';
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

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // 할일 로드
  const fetchTodos = useCallback(() => {
    fetch('/api/todos?status=all')
      .then((r) => r.json())
      .then((res) => { if (res.success) setTodos(res.data ?? []); })
      .then(() => {}, () => {});
  }, []);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

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

  return (
    <div className="w-full" style={{ maxWidth: '94%', margin: '0 auto', paddingTop: 36, paddingBottom: 40 }}>
      {/* 헤더 */}
      <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
        <CalendarDays size={24} className="text-[#2E6FF2]" />
        <h1 className="text-[22px] font-semibold text-[#1B1F2B]">일정 / 할일</h1>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-[#f5f5f7] rounded-lg p-1 w-fit" style={{ marginBottom: 10 }}>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-md transition-all ${
            activeTab === 'calendar' ? 'bg-white text-[#1B1F2B] shadow-sm' : 'text-[#7C8494] hover:text-[#1B1F2B]'
          }`}
        >
          <CalendarDays size={15} />
          캘린더
        </button>
        <button
          onClick={() => setActiveTab('todo')}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-md transition-all ${
            activeTab === 'todo' ? 'bg-white text-[#1B1F2B] shadow-sm' : 'text-[#7C8494] hover:text-[#1B1F2B]'
          }`}
        >
          <CheckSquare size={15} />
          할일
          {activeTodoCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-[#2E6FF2] text-white rounded-full font-num">
              {activeTodoCount}
            </span>
          )}
        </button>
      </div>

      {/* 콘텐츠 */}
      {activeTab === 'calendar' ? (
        loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-[#7C8494]" size={24} />
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
