'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import type { CalendarEvent, EventType } from '@/lib/supabase/types';
import { getEventTypeLabel } from '@/lib/schedule-utils';

const EVENT_TYPES: EventType[] = ['meeting', 'deadline', 'personal', 'company', 'other'];

interface EventFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: EventFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  event?: CalendarEvent | null;
  defaultDate?: Date | null;
  departments: { id: string; name: string }[];
}

export interface EventFormData {
  title: string;
  description: string;
  location: string;
  event_type: EventType;
  start_at: string;
  end_at: string;
  all_day: boolean;
  department_id: string | null;
}

function toLocalDatetime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

export default function EventFormModal({
  open,
  onClose,
  onSubmit,
  onDelete,
  event,
  defaultDate,
  departments,
}: EventFormModalProps) {
  const isEdit = !!event;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<EventFormData>({
    title: '',
    description: '',
    location: '',
    event_type: 'meeting',
    start_at: '',
    end_at: '',
    all_day: false,
    department_id: null,
  });

  useEffect(() => {
    if (event) {
      setForm({
        title: event.title,
        description: event.description ?? '',
        location: event.location ?? '',
        event_type: event.event_type,
        start_at: toLocalDatetime(new Date(event.start_at)),
        end_at: toLocalDatetime(new Date(event.end_at)),
        all_day: event.all_day,
        department_id: event.department_id ?? null,
      });
    } else if (defaultDate) {
      const start = new Date(defaultDate);
      start.setHours(9, 0, 0, 0);
      const end = new Date(defaultDate);
      end.setHours(10, 0, 0, 0);
      setForm({
        title: '',
        description: '',
        location: '',
        event_type: 'meeting',
        start_at: toLocalDatetime(start),
        end_at: toLocalDatetime(end),
        all_day: false,
        department_id: null,
      });
    }
  }, [event, defaultDate]);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.start_at || !form.end_at) return;
    setLoading(true);
    try {
      await onSubmit({
        ...form,
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at).toISOString(),
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? '일정 수정' : '일정 등록'} size="lg">
      <div className="space-y-4 px-2">
        {/* 제목 */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1">제목 *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="일정 제목을 입력하세요"
            className="w-full px-3 py-2 border border-clio-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* 유형 */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1">유형</label>
          <div className="flex gap-2 flex-wrap">
            {EVENT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setForm({ ...form, event_type: type })}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  form.event_type === type
                    ? 'border-accent bg-accent/10 text-accent font-medium'
                    : 'border-clio-border text-clio-text-secondary hover:bg-gray-50'
                }`}
              >
                {getEventTypeLabel(type)}
              </button>
            ))}
          </div>
        </div>

        {/* 종일 */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.all_day}
            onChange={(e) => setForm({ ...form, all_day: e.target.checked })}
            className="rounded border-clio-border text-accent focus:ring-accent"
          />
          종일
        </label>

        {/* 시작/종료 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-navy mb-1">시작</label>
            <input
              type={form.all_day ? 'date' : 'datetime-local'}
              value={form.all_day ? form.start_at.split('T')[0] : form.start_at}
              onChange={(e) => setForm({ ...form, start_at: form.all_day ? e.target.value + 'T00:00' : e.target.value })}
              className="w-full px-3 py-2 border border-clio-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">종료</label>
            <input
              type={form.all_day ? 'date' : 'datetime-local'}
              value={form.all_day ? form.end_at.split('T')[0] : form.end_at}
              onChange={(e) => setForm({ ...form, end_at: form.all_day ? e.target.value + 'T23:59' : e.target.value })}
              className="w-full px-3 py-2 border border-clio-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        {/* 장소 */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1">장소</label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="장소 (선택)"
            className="w-full px-3 py-2 border border-clio-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* 공개 범위 */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1">공개 범위</label>
          <select
            value={form.department_id ?? ''}
            onChange={(e) => setForm({ ...form, department_id: e.target.value || null })}
            className="w-full px-3 py-2 border border-clio-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">전사 공개</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}만</option>
            ))}
          </select>
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1">설명</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="설명 (선택)"
            rows={3}
            className="w-full px-3 py-2 border border-clio-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-none"
          />
        </div>

        {/* 버튼 */}
        <div className="flex items-center justify-between pt-2">
          <div>
            {isEdit && onDelete && (
              <button
                onClick={async () => { await onDelete(); onClose(); }}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                삭제
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-clio-border rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !form.title.trim()}
              className="px-5 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {loading ? '저장 중...' : isEdit ? '수정' : '등록'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
