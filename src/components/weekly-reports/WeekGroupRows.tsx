'use client';

// 주간업무 목록의 주차 그룹 1개 — 머리 행(클릭 시 여닫기) + 소속 문서 행.

import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { statusBadgeVariant, statusLabel, formatDate, type WeekInfo } from './helpers';
import type { WeeklyReport } from './types';

interface WeekGroupRowsProps {
  week: WeekInfo;
  items: WeeklyReport[];
  open: boolean;
  onToggle: () => void;
  onSelect: (report: WeeklyReport) => void;
}

export function WeekGroupRows({ week, items, open, onToggle, onSelect }: WeekGroupRowsProps) {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-border bg-surface-secondary/60 hover:bg-surface-secondary"
        onClick={onToggle}
      >
        <td colSpan={6} className="px-4 py-2.5">
          {/* 전역 리셋(* { margin: 0 })이 ml-* 유틸을 덮으므로 간격은 gap으로 준다 */}
          <button
            type="button"
            aria-expanded={open}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="flex w-full items-center gap-2.5 text-left"
          >
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-foreground-tertiary transition-transform ${open ? 'rotate-90' : ''}`}
            />
            <span className="font-semibold text-foreground">{week.label}</span>
            {week.range && <span className="text-xs text-foreground-tertiary">{week.range}</span>}
            <span className="text-xs text-foreground-secondary">{items.length}건</span>
          </button>
        </td>
      </tr>
      {open &&
        items.map((r) => (
          <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-secondary/50">
            <td className="px-4 py-3 font-medium text-foreground">{r.authorName}</td>
            <td className="px-4 py-3 text-foreground-secondary">{r.authorRank || '-'}</td>
            <td className="px-4 py-3 text-foreground-secondary">{r.authorDept}</td>
            <td className="px-4 py-3 text-foreground-secondary">{formatDate(r.createdAt)}</td>
            <td className="px-4 py-3">
              <Badge variant={statusBadgeVariant(r.status)}>{statusLabel(r.status)}</Badge>
            </td>
            <td className="px-4 py-3 text-right">
              <Button variant="secondary" size="sm" onClick={() => onSelect(r)}>
                상세보기
              </Button>
            </td>
          </tr>
        ))}
    </>
  );
}
