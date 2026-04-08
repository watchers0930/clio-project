'use client';

import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, CheckSquare } from 'lucide-react';
import { startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import CalendarView from '@/components/schedule/calendar-view';
import EventFormModal from '@/components/schedule/event-form-modal';
import type { EventFormData } from '@/components/schedule/event-form-modal';
import TodoList from '@/components/schedule/todo-list';
import TodoFormModal from '@/components/schedule/todo-form-modal';
import type { CalendarEvent, TodoItem, TodoStatus, TodoPriority } from '@/lib/supabase/types';

type Tab = 'calendar' | 'todo';

export default function SchedulePage() {
  const [activeTab, setActiveTab] = useState<Tab>('calendar');

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
    const start = startOfMonth(new Date(year, month)).toISOString();
    const end = endOfMonth(new Date(year, month)).toISOString();
    const params = new URLSearchParams({ start, end });
    if (selectedDept) params.set('department_id', selectedDept);

    fetch(`/api/events?${params}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setEvents(res.data ?? []); })
      .then(() => {}, () => {});
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
  const goNextMonth = () => {
    const d = addMonths(new Date(year, month), 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const goPrevMonth = () => {
    const d = subMonths(new Date(year, month), 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const goToday = () => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
  };

  // 일정 CRUD
  const handleCreateEvent = async (data: EventFormData) => {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if ((await res.json()).success) fetchEvents();
  };

  const handleUpdateEvent = async (data: EventFormData) => {
    if (!selectedEvent) return;
    const res = await fetch(`/api/events/${selectedEvent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if ((await res.json()).success) fetchEvents();
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    const res = await fetch(`/api/events/${selectedEvent.id}`, { method: 'DELETE' });
    if ((await res.json()).success) fetchEvents();
  };

  // 할일 CRUD
  const handleCreateTodo = async (data: { title: string; description: string; due_date: string; priority: TodoPriority }) => {
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if ((await res.json()).success) fetchTodos();
  };

  const handleUpdateTodo = async (data: { title: string; description: string; due_date: string; priority: TodoPriority }) => {
    if (!selectedTodo) return;
    const res = await fetch(`/api/todos/${selectedTodo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if ((await res.json()).success) fetchTodos();
  };

  const handleToggleTodo = async (id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const newStatus = todo.status === 'active' ? 'completed' : 'active';
    const res = await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if ((await res.json()).success) fetchTodos();
  };

  const handleDeleteTodo = async (id: string) => {
    const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    if ((await res.json()).success) fetchTodos();
  };

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-navy">일정 / 할일</h1>
        <p className="text-sm text-clio-text-secondary mt-1">팀 일정을 공유하고 개인 할일을 관리하세요</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-5 py-2 text-sm rounded-lg transition-colors ${
            activeTab === 'calendar'
              ? 'bg-white text-navy font-semibold shadow-sm'
              : 'text-clio-text-secondary hover:text-navy'
          }`}
        >
          <CalendarDays size={16} />
          캘린더
        </button>
        <button
          onClick={() => setActiveTab('todo')}
          className={`flex items-center gap-2 px-5 py-2 text-sm rounded-lg transition-colors ${
            activeTab === 'todo'
              ? 'bg-white text-navy font-semibold shadow-sm'
              : 'text-clio-text-secondary hover:text-navy'
          }`}
        >
          <CheckSquare size={16} />
          할일
          {todos.filter((t) => t.status === 'active').length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-accent text-white rounded-full">
              {todos.filter((t) => t.status === 'active').length}
            </span>
          )}
        </button>
      </div>

      {/* 콘텐츠 */}
      {activeTab === 'calendar' ? (
        <CalendarView
          year={year}
          month={month}
          events={events}
          selectedDate={selectedDate}
          departments={departments}
          selectedDept={selectedDept}
          onPrevMonth={goPrevMonth}
          onNextMonth={goNextMonth}
          onToday={goToday}
          onDeptChange={setSelectedDept}
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
