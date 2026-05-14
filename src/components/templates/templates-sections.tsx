'use client';

import { EmptyState, Tabs } from '@/components/ui';
import type { Template } from './types';

export function TemplatesHeader({
  selectMode,
  selectedCount,
  allSelected,
  onToggleSelectAll,
  onBulkDelete,
  onCancelSelect,
  onEnterSelectMode,
  onOpenAutoRegister,
  onOpenCreate,
}: {
  selectMode: boolean;
  selectedCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onBulkDelete: () => void;
  onCancelSelect: () => void;
  onEnterSelectMode: () => void;
  onOpenAutoRegister: () => void;
  onOpenCreate: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        <h1 className="text-[22px] font-bold text-[#1d1d1f] sm:text-2xl">템플릿 관리</h1>
        <p className="text-[#6e6e73]">문서 생성에 사용할 템플릿을 관리하세요</p>
      </div>
      <div className="grid w-full gap-3 sm:flex sm:w-auto">
        {selectMode ? (
          <>
            <button onClick={onToggleSelectAll} className="px-4 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors">
              {allSelected ? '전체 해제' : '전체 선택'}
            </button>
            <button onClick={onBulkDelete} disabled={selectedCount === 0} className="px-4 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#2d2d2f] transition-colors disabled:opacity-40">
              {selectedCount}개 삭제
            </button>
            <button onClick={onCancelSelect} className="px-4 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors">
              취소
            </button>
          </>
        ) : (
          <>
            <button onClick={onEnterSelectMode} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              선택
            </button>
            <button onClick={onOpenAutoRegister} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#2E6FF2] text-[#2E6FF2] text-sm font-medium hover:bg-[#2E6FF2]/5 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
              파일에서 등록
            </button>
            <button onClick={onOpenCreate} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors shadow-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              새 템플릿
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function TemplatesTabs({
  tab,
  templates,
  onChange,
}: {
  tab: '전사 공용' | '부서 전용';
  templates: Template[];
  onChange: (value: '전사 공용' | '부서 전용') => void;
}) {
  return (
      <div className="mb-5 sm:mb-6">
      <Tabs
        variant="underline"
        tabs={[
          { id: '전사 공용', label: `전사 공용 (${templates.filter((template) => template.scope === '전사 공용').length})` },
          { id: '부서 전용', label: `부서 전용 (${templates.filter((template) => template.scope === '부서 전용').length})` },
        ]}
        activeTab={tab}
        onChange={(id) => onChange(id as '전사 공용' | '부서 전용')}
      />
    </div>
  );
}

export function TemplatesGrid({
  filtered,
  tab,
  selectMode,
  selectedIds,
  onToggleSelect,
  onOpenCreate,
  onPreview,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  filtered: Template[];
  tab: '전사 공용' | '부서 전용';
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpenCreate: () => void;
  onPreview: (template: Template) => void;
  onEdit: (template: Template) => void;
  onDuplicate: (template: Template) => void;
  onDelete: (id: string) => void;
}) {
  if (filtered.length === 0) {
    return (
      <EmptyState
        iconType="template"
        title={`${tab} 템플릿이 없습니다`}
        description="새 템플릿을 만들어 보세요"
        action={{ label: '새 템플릿', onClick: onOpenCreate }}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
      {filtered.map((template) => {
        const isSelected = selectedIds.has(template.id);
        return (
          <div
            key={template.id}
            onClick={selectMode ? () => onToggleSelect(template.id) : undefined}
            className="bg-white rounded-2xl border overflow-hidden transition-all hover:shadow-lg group"
            style={{
              borderColor: isSelected ? '#2E6FF2' : '#E2E5EA',
              boxShadow: isSelected ? '0 0 0 1px #2E6FF2' : '0 1px 3px rgba(0,0,0,0.04)',
              cursor: selectMode ? 'pointer' : undefined,
            }}
          >
            <div style={{ height: 3, backgroundColor: '#2E6FF2' }} />
            <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {selectMode && (
                    <div className="w-[16px] h-[16px] rounded flex items-center justify-center border-2 transition-colors" style={{ borderColor: isSelected ? '#2E6FF2' : '#E2E5EA', backgroundColor: isSelected ? '#2E6FF2' : 'transparent' }}>
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      )}
                    </div>
                  )}
                  <span className="text-2xl">{template.icon}</span>
                </div>
                <div className="flex items-center gap-2">
                  {template.templateFile && (
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-md" style={{ backgroundColor: '#2E6FF2' + '12', color: '#2E6FF2' }}>
                      {template.templateFile.type}
                    </span>
                  )}
                  <span className="text-[10px] font-medium px-2.5 py-1 rounded-md" style={{ backgroundColor: '#2E6FF2' + '12', color: '#2E6FF2' }}>
                    {template.scope === '전사 공용' ? '전사' : '부서'}
                  </span>
                </div>
              </div>

              <h3 className="mb-2 text-[13px] font-semibold text-[#1B1F2B] truncate">{template.name}</h3>
              <p className="mb-4 text-[11px] leading-5 text-[#7C8494] line-clamp-2">{template.description}</p>

              <div className="flex items-center gap-3.5 text-[10px] text-[#7C8494]">
                <span>{template.department}</span>
                <span>사용 {template.usageCount}회</span>
                <span className="font-num">{template.lastUpdated}</span>
              </div>
            </div>

            <div className="flex items-center border-t border-[#E2E5EA]/60">
              <button onClick={(e) => { e.stopPropagation(); onPreview(template); }} className="flex-1 px-3 py-3 text-[12px] font-medium text-[#1B1F2B] hover:bg-[#f5f5f7] transition-colors border-r border-[#E2E5EA]/60">
                미리보기
              </button>
              <button onClick={(e) => { e.stopPropagation(); onEdit(template); }} className="flex-1 px-3 py-3 text-[12px] font-medium text-[#1B1F2B] hover:bg-[#f5f5f7] transition-colors border-r border-[#E2E5EA]/60">
                편집
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDuplicate(template); }} className="flex-1 px-3 py-3 text-[12px] font-medium text-[#1B1F2B] hover:bg-[#f5f5f7] transition-colors border-r border-[#E2E5EA]/60">
                복제
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(template.id); }} className="flex-1 px-3 py-3 text-[12px] font-medium text-[#1d1d1f]/70 hover:bg-[#1d1d1f]/5 hover:text-[#1d1d1f] transition-colors">
                삭제
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
