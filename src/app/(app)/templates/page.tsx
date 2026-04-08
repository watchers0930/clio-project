'use client';

import { useState, useEffect, useCallback } from 'react';

/* ────────────────────────── types ────────────────────────── */
interface TemplateFile {
  id: string;
  name: string;
  type: string;
  size: string;
}

interface Template {
  id: string;
  name: string;
  icon: string;
  description: string;
  content: string;
  department: string;
  departmentId: string;
  scope: '전사 공용' | '부서 전용';
  usageCount: number;
  lastUpdated: string;
  placeholders: string[];
  templateFile: TemplateFile | null;
}

/* DEPARTMENTS: API에서 동적 로드 */

const ICON_OPTIONS = ['📊', '📝', '💡', '📋', '📈', '✉️', '👥', '🎯', '📄', '🔧', '🗂️', '📌'];

/* ────────────────────────── page ─────────────────────────── */
export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [deptList, setDeptList] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'전사 공용' | '부서 전용'>('전사 공용');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // Create/Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDepartmentId, setFormDepartmentId] = useState('');
  const [formScope, setFormScope] = useState<'전사 공용' | '부서 전용'>('전사 공용');
  const [formIcon, setFormIcon] = useState('📄');
  const [formContent, setFormContent] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formExistingFile, setFormExistingFile] = useState<TemplateFile | null>(null);
  const [formRemoveFile, setFormRemoveFile] = useState(false);
  const [saving, setSaving] = useState(false);

  // 자가등록 모달 상태
  const [showAutoReg, setShowAutoReg] = useState(false);
  const [autoRegStep, setAutoRegStep] = useState(1);
  const [autoRegFile, setAutoRegFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedPlaceholders, setDetectedPlaceholders] = useState<Array<{ key: string; label: string; type: string; location: string; context?: string; selected: boolean }>>([]);
  const [autoRegFileId, setAutoRegFileId] = useState<string | null>(null);
  const [autoRegPreview, setAutoRegPreview] = useState('');
  const [autoRegName, setAutoRegName] = useState('');
  const [autoRegDesc, setAutoRegDesc] = useState('');
  const [autoRegDeptId, setAutoRegDeptId] = useState('');
  const [autoRegScope, setAutoRegScope] = useState<'전사 공용' | '부서 전용'>('전사 공용');
  const [autoRegSaving, setAutoRegSaving] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        const raw = data.templates ?? [];
        setTemplates(
          raw.map((t: Record<string, unknown>) => ({
            id: t.id as string,
            name: t.name as string,
            icon: getIconForName(t.name as string),
            description: t.description as string,
            department: t.department as string,
            departmentId: t.departmentId as string,
            scope: t.scope as '전사 공용' | '부서 전용',
            usageCount: t.usageCount as number,
            lastUpdated: t.lastUpdated as string,
            placeholders: (t.placeholders as string[]) ?? [],
            templateFile: (t.templateFile as TemplateFile | null) ?? null,
          }))
        );
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    // 부서 목록 로드
    fetch('/api/departments').then(r => r.json()).then(json => {
      const depts = (json.data ?? [])
        .filter((d: { is_active: boolean }) => d.is_active !== false)
        .map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }));
      setDeptList(depts);
      if (depts.length > 0 && !formDepartmentId) setFormDepartmentId(depts[0].id);
    }).catch(() => {});
  }, [loadTemplates]);

  function getIconForName(name: string): string {
    const map: Record<string, string> = {
      '주간업무보고서': '📊',
      '회의록': '📝',
      '기술설계문서': '💡',
      '마케팅_캠페인_기획서': '🎯',
      '채용공고_양식': '👥',
    };
    return map[name] ?? '📄';
  }

  const filtered = templates.filter((t) => t.scope === tab);

  const resetForm = () => {
    setShowModal(false);
    setEditId(null);
    setFormName('');
    setFormDescription('');
    setFormContent('');
    setFormDepartmentId(deptList[0]?.id ?? '');
    setFormScope('전사 공용');
    setFormIcon('📄');
    setFormFile(null);
    setFormExistingFile(null);
    setFormRemoveFile(false);
    setSaving(false);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (t: Template) => {
    setEditId(t.id);
    setFormName(t.name);
    setFormDescription(t.description);
    setFormContent(t.content ?? '');
    setFormDepartmentId(t.departmentId);
    setFormScope(t.scope);
    setFormIcon(t.icon);
    setFormExistingFile(t.templateFile);
    setFormFile(null);
    setFormRemoveFile(false);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);

    try {
      const hasFile = formFile !== null;
      const useFormData = hasFile;

      if (editId) {
        let res: Response;
        if (useFormData) {
          const fd = new FormData();
          fd.append('id', editId);
          fd.append('name', formName);
          fd.append('description', formDescription);
          fd.append('content', formContent);
          fd.append('departmentId', formDepartmentId);
          fd.append('scope', formScope);
          if (formFile) fd.append('file', formFile);
          if (formRemoveFile) fd.append('removeFile', 'true');
          res = await fetch('/api/templates', { method: 'PUT', body: fd });
        } else {
          res = await fetch('/api/templates', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: editId, name: formName, description: formDescription,
              content: formContent, departmentId: formDepartmentId, scope: formScope,
              removeFile: formRemoveFile || undefined,
            }),
          });
        }
        if (res.ok) {
          const data = await res.json();
          const updated = data.template;
          setTemplates((prev) =>
            prev.map((t) =>
              t.id === editId
                ? { ...t, name: updated.name, description: updated.description, content: updated.content ?? '', department: updated.department, departmentId: updated.departmentId, scope: updated.scope, lastUpdated: updated.lastUpdated, icon: formIcon, templateFile: updated.templateFile ?? null }
                : t
            )
          );
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(errData.error || '템플릿 수정에 실패했습니다.');
          setSaving(false);
          return;
        }
      } else {
        let res: Response;
        if (useFormData) {
          const fd = new FormData();
          fd.append('name', formName);
          fd.append('description', formDescription);
          fd.append('content', formContent);
          fd.append('departmentId', formDepartmentId);
          fd.append('scope', formScope);
          if (formFile) fd.append('file', formFile);
          res = await fetch('/api/templates', { method: 'POST', body: fd });
        } else {
          res = await fetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: formName, description: formDescription, content: formContent, departmentId: formDepartmentId, scope: formScope }),
          });
        }
        if (res.ok) {
          const data = await res.json();
          const newTmpl = data.template;
          setTemplates((prev) => [
            ...prev,
            {
              id: newTmpl.id, name: newTmpl.name, icon: formIcon,
              description: newTmpl.description, content: newTmpl.content ?? '',
              department: newTmpl.department,
              departmentId: newTmpl.departmentId, scope: newTmpl.scope,
              usageCount: 0, lastUpdated: newTmpl.lastUpdated, placeholders: [],
              templateFile: newTmpl.templateFile ?? null,
            },
          ]);
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(errData.error || '템플릿 생성에 실패했습니다.');
          setSaving(false);
          return;
        }
      }
      resetForm();
      loadTemplates();
    } catch (e) {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/templates?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || '삭제에 실패했습니다.');
      }
      await loadTemplates();
    } catch {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((t) => t.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개 템플릿을 삭제하시겠습니까?`)) return;
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/templates?id=${id}`, { method: 'DELETE' }).then((r) => r.ok)
        )
      );
      const failCount = results.filter((ok) => !ok).length;
      if (failCount > 0) alert(`${failCount}개 삭제 실패`);
      setSelectedIds(new Set());
      setSelectMode(false);
      await loadTemplates();
    } catch {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleDuplicate = async (t: Template) => {
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${t.name} (복사본)`,
          description: t.description,
          departmentId: t.departmentId,
          scope: t.scope,
          templateFileId: t.templateFile?.id || undefined,
        }),
      });
      if (res.ok) {
        loadTemplates(); // DB 응답 기반으로 목록 새로고침
      }
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-[#e5e5e7] rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-white rounded-2xl border border-[#e5e5e7]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">템플릿 관리</h1>
          <p className="text-[#6e6e73] mt-1" style={{ marginBottom: 10 }}>문서 생성에 사용할 템플릿을 관리하세요</p>
        </div>
        <div className="flex gap-2">
          {selectMode ? (
            <>
              <button
                onClick={toggleSelectAll}
                className="px-4 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
              >
                {selectedIds.size === filtered.length ? '전체 해제' : '전체 선택'}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0}
                className="px-4 py-2.5 rounded-xl bg-[#ff3b30] text-white text-sm font-medium hover:bg-[#ff453a] transition-colors disabled:opacity-40"
              >
                {selectedIds.size}개 삭제
              </button>
              <button
                onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                className="px-4 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors"
              >
                취소
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setSelectMode(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                선택
              </button>
              <button
                onClick={() => { setShowAutoReg(true); setAutoRegStep(1); setAutoRegFile(null); setDetectedPlaceholders([]); setAutoRegFileId(null); setAutoRegPreview(''); setAutoRegName(''); setAutoRegDesc(''); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#2E6FF2] text-[#2E6FF2] text-sm font-medium hover:bg-[#2E6FF2]/5 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                파일에서 등록
              </button>
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                새 템플릿
              </button>
            </>
          )}
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-6">
        {(['전사 공용', '부서 전용'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-1 pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t ? 'border-[#0071e3] text-[#0071e3]' : 'border-transparent text-[#6e6e73] hover:text-[#1d1d1f]'}`}
          >
            {t} ({templates.filter((tmpl) => tmpl.scope === t).length})
          </button>
        ))}
      </div>

      {/* grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 rounded-full bg-[#f5f5f7] flex items-center justify-center" style={{ marginBottom: 20 }}>
            <svg className="w-10 h-10 text-[#0071e3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#1d1d1f]" style={{ marginBottom: 20 }}>{tab} 템플릿이 없습니다</h3>
          <p className="text-[#6e6e73] text-sm" style={{ marginBottom: 20 }}>새 템플릿을 만들어 보세요</p>
          <button onClick={openCreate} className="px-6 py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors">
            새 템플릿
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filtered.map((t) => {
            const isSelected = selectedIds.has(t.id);
            return (
              <div
                key={t.id}
                onClick={selectMode ? () => toggleSelect(t.id) : undefined}
                className="bg-white rounded-xl border overflow-hidden transition-all hover:shadow-lg group"
                style={{
                  borderColor: isSelected ? '#2E6FF2' : '#E2E5EA',
                  boxShadow: isSelected ? '0 0 0 1px #2E6FF2' : '0 1px 3px rgba(0,0,0,0.04)',
                  cursor: selectMode ? 'pointer' : undefined,
                }}
              >
                {/* 상단 컬러 바 */}
                <div style={{ height: 3, backgroundColor: '#2E6FF2' }} />

                {/* 카드 본문 */}
                <div style={{ padding: '18px 20px 14px' }}>
                  {/* 아이콘 + 체크박스 */}
                  <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                    <div className="flex items-center gap-2.5">
                      {selectMode && (
                        <div
                          className="w-[16px] h-[16px] rounded flex items-center justify-center border-2 transition-colors"
                          style={{
                            borderColor: isSelected ? '#2E6FF2' : '#E2E5EA',
                            backgroundColor: isSelected ? '#2E6FF2' : 'transparent',
                          }}
                        >
                          {isSelected && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                          )}
                        </div>
                      )}
                      <span className="text-2xl">{t.icon}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {t.templateFile && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: '#2E6FF2' + '12', color: '#2E6FF2' }}>
                          {t.templateFile.type}
                        </span>
                      )}
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md" style={{ backgroundColor: '#2E6FF2' + '12', color: '#2E6FF2' }}>
                        {t.scope === '전사 공용' ? '전사' : '부서'}
                      </span>
                    </div>
                  </div>

                  {/* 제목 + 설명 */}
                  <h3 className="text-[13px] font-semibold text-[#1B1F2B] truncate" style={{ marginBottom: 4 }}>{t.name}</h3>
                  <p className="text-[11px] text-[#7C8494] line-clamp-2" style={{ marginBottom: 12 }}>{t.description}</p>

                  {/* 메타 정보 */}
                  <div className="flex items-center gap-3 text-[10px] text-[#7C8494]">
                    <span>{t.department}</span>
                    <span>사용 {t.usageCount}회</span>
                    <span className="font-num">{t.lastUpdated}</span>
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className="flex items-center border-t border-[#E2E5EA]/60">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                    className="flex-1 py-2.5 text-[12px] font-medium text-[#1B1F2B] hover:bg-[#f5f5f7] transition-colors border-r border-[#E2E5EA]/60"
                  >
                    편집
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(t); }}
                    className="flex-1 py-2.5 text-[12px] font-medium text-[#1B1F2B] hover:bg-[#f5f5f7] transition-colors border-r border-[#E2E5EA]/60"
                  >
                    복제
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                    className="flex-1 py-2.5 text-[12px] font-medium text-[#ff3b30]/70 hover:bg-[#ff3b30]/5 hover:text-[#ff3b30] transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="tmpl-modal-title" onKeyDown={(e) => { if (e.key === 'Escape') resetForm(); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
            <div className="px-8 py-6 border-b border-[#e5e5e7] flex items-center justify-between">
              <h2 id="tmpl-modal-title" className="text-lg font-semibold text-[#1d1d1f]">
                {editId ? '템플릿 편집' : '새 템플릿 만들기'}
              </h2>
              <button onClick={resetForm} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-8 py-6 space-y-6">
              {/* Icon selector */}
              <div>
                <label className="block text-sm font-medium text-[#1d1d1f]" style={{ marginBottom: 5 }}>아이콘</label>
                <div className="flex flex-wrap gap-2.5">
                  {ICON_OPTIONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setFormIcon(icon)}
                      className={`w-11 h-11 rounded-lg flex items-center justify-center text-xl border transition-colors ${formIcon === icon ? 'border-[#0071e3] bg-[#f5f5f7] ring-2 ring-[#0071e3]/30' : 'border-[#e5e5e7] hover:border-[#0071e3]'}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div style={{ marginTop: 20 }}>
                <label className="block text-sm font-medium text-[#1d1d1f]" style={{ marginBottom: 5 }}>이름 *</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="템플릿 이름을 입력하세요"
                  className="w-full px-4 py-3 rounded-xl border border-[#e5e5e7] text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                />
              </div>

              {/* Description */}
              <div style={{ marginTop: 20 }}>
                <label className="block text-sm font-medium text-[#1d1d1f]" style={{ marginBottom: 5 }}>설명</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="템플릿에 대한 설명을 입력하세요"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-[#e5e5e7] text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3] resize-none"
                />
              </div>

              {/* Content (문서 구조) */}
              <div style={{ marginTop: 20 }}>
                <label className="block text-sm font-medium text-[#1d1d1f]" style={{ marginBottom: 5 }}>문서 구조</label>
                <p className="text-xs text-[#6e6e73]" style={{ marginBottom: 8 }}>AI가 이 구조를 따라 문서를 생성합니다. 섹션/항목을 정의하세요.</p>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder={"예:\n# 업무일지\n## 오늘의 업무\n- 주요 업무 내용 1\n- 주요 업무 내용 2\n## 문제점 및 해결 방안\n## 내일의 계획"}
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl border border-[#e5e5e7] text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3] resize-none font-mono"
                />
              </div>

              {/* Department */}
              <div style={{ marginTop: 20 }}>
                <label className="block text-sm font-medium text-[#1d1d1f]" style={{ marginBottom: 5 }}>부서</label>
                <select
                  value={formDepartmentId}
                  onChange={(e) => setFormDepartmentId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#e5e5e7] text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                >
                  {deptList.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Scope */}
              <div style={{ marginTop: 20 }}>
                <label className="block text-sm font-medium text-[#1d1d1f]" style={{ marginBottom: 5 }}>범위</label>
                <div className="flex gap-3">
                  {(['전사 공용', '부서 전용'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setFormScope(s)}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${formScope === s ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white' : 'border-[#e5e5e7] text-[#6e6e73] hover:border-[#1d1d1f]'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {/* Template File */}
              <div style={{ marginTop: 20 }}>
                <label className="block text-sm font-medium text-[#1d1d1f]" style={{ marginBottom: 5 }}>표준양식 파일</label>
                <p className="text-xs text-[#6e6e73] mb-3">HWP, HWPX, DOCX, XLSX, PPTX, PDF 등 표준양식 파일을 첨부하세요</p>

                {/* 기존 파일 표시 */}
                {formExistingFile && !formRemoveFile && !formFile && (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7]">
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{formExistingFile.type}</span>
                    <span className="text-sm text-[#1d1d1f] flex-1 truncate">{formExistingFile.name}</span>
                    <span className="text-xs text-[#6e6e73]">{formExistingFile.size}</span>
                    <button
                      type="button"
                      onClick={() => setFormRemoveFile(true)}
                      className="p-1 rounded hover:bg-white text-[#ff3b30]"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}

                {/* 새 파일 선택됨 */}
                {formFile && (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-[#0071e3] bg-[#f0f5ff]">
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                      {formFile.name.split('.').pop()?.toUpperCase() ?? 'FILE'}
                    </span>
                    <span className="text-sm text-[#1d1d1f] flex-1 truncate">{formFile.name}</span>
                    <span className="text-xs text-[#6e6e73]">
                      {formFile.size < 1024 * 1024 ? `${(formFile.size / 1024).toFixed(0)} KB` : `${(formFile.size / (1024 * 1024)).toFixed(1)} MB`}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setFormFile(null); setFormRemoveFile(false); }}
                      className="p-1 rounded hover:bg-white text-[#ff3b30]"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}

                {/* 파일 선택 버튼 */}
                {!formFile && (!formExistingFile || formRemoveFile) && (
                  <label className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-[#e5e5e7] cursor-pointer hover:border-[#0071e3] hover:bg-[#f5f5f7] transition-colors">
                    <svg className="w-5 h-5 text-[#6e6e73]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className="text-sm text-[#6e6e73]">파일 선택</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.md"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) { setFormFile(file); setFormRemoveFile(false); }
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
            <div className="px-8 py-5 border-t border-[#e5e5e7] flex justify-end gap-3">
              <button onClick={resetForm} className="px-6 py-3 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors">취소</button>
              <button
                onClick={handleSave}
                disabled={!formName.trim() || saving}
                className="px-6 py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? '저장 중...' : editId ? '수정' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ────── 자가등록 모달 ────── */}
      {showAutoReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4" style={{ padding: '28px 32px' }}>
            {/* 스텝 인디케이터 */}
            <div className="flex items-center gap-3 mb-6">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold ${
                    autoRegStep >= s ? 'bg-[#2E6FF2] text-white' : 'bg-[#f5f5f7] text-[#7C8494]'
                  }`}>{s}</div>
                  <span className={`text-[12px] ${autoRegStep >= s ? 'text-[#1B1F2B] font-medium' : 'text-[#7C8494]'}`}>
                    {s === 1 ? '파일 업로드' : s === 2 ? '빈칸 확인' : '정보 입력'}
                  </span>
                  {s < 3 && <div className="w-6 h-px bg-[#E2E5EA]" />}
                </div>
              ))}
            </div>

            {/* Step 1: 파일 업로드 */}
            {autoRegStep === 1 && (
              <div>
                <div
                  className="border-2 border-dashed border-[#E2E5EA] rounded-xl p-8 text-center hover:border-[#2E6FF2] transition-colors cursor-pointer"
                  onClick={() => document.getElementById('auto-reg-file')?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) setAutoRegFile(f);
                  }}
                >
                  <input
                    id="auto-reg-file"
                    type="file"
                    accept=".docx,.hwpx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setAutoRegFile(f);
                    }}
                  />
                  {autoRegFile ? (
                    <div>
                      <svg className="w-10 h-10 mx-auto mb-2 text-[#30d158]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p className="text-[14px] font-medium text-[#1B1F2B]">{autoRegFile.name}</p>
                      <p className="text-[12px] text-[#7C8494] mt-1">{(autoRegFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <svg className="w-10 h-10 mx-auto mb-2 text-[#7C8494]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                      <p className="text-[14px] text-[#1B1F2B]">DOCX 또는 HWPX 파일을 드래그하거나 클릭</p>
                      <p className="text-[12px] text-[#7C8494] mt-1">양식 문서의 빈칸을 자동으로 감지합니다</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end mt-5">
                  <button onClick={() => setShowAutoReg(false)} className="px-4 py-2 text-[13px] text-[#7C8494]">취소</button>
                  <button
                    onClick={async () => {
                      if (!autoRegFile) return;
                      setAnalyzing(true);
                      try {
                        const fd = new FormData();
                        fd.append('file', autoRegFile);
                        const res = await fetch('/api/templates/analyze', { method: 'POST', body: fd });
                        const d = await res.json();
                        if (d.success) {
                          setAutoRegFileId(d.data.fileId);
                          setAutoRegPreview(d.data.preview);
                          setAutoRegName(autoRegFile.name.replace(/\.(docx|hwpx)$/i, ''));
                          setDetectedPlaceholders(
                            (d.data.placeholders ?? []).map((p: { key: string; label: string; type: string; location: string; context?: string }) => ({ ...p, selected: true }))
                          );
                          setAutoRegStep(2);
                        } else {
                          alert(d.error ?? '분석 실패');
                        }
                      } catch { alert('서버 오류'); }
                      setAnalyzing(false);
                    }}
                    disabled={!autoRegFile || analyzing}
                    className="px-5 py-2 text-[13px] font-medium text-white bg-[#2E6FF2] rounded-lg hover:bg-[#1a5ad9] disabled:opacity-40 transition-colors"
                  >
                    {analyzing ? '분석 중...' : '분석 시작'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: 플레이스홀더 확인 */}
            {autoRegStep === 2 && (
              <div>
                <p className="text-[13px] text-[#7C8494] mb-3">감지된 빈칸/플레이스홀더 ({detectedPlaceholders.length}개)</p>

                {detectedPlaceholders.length === 0 ? (
                  <div className="text-center py-8 text-[#7C8494] text-[13px]">
                    <p>감지된 빈칸이 없습니다.</p>
                    <p className="text-[12px] mt-1">이 파일을 그대로 템플릿으로 등록할 수 있습니다.</p>
                  </div>
                ) : (
                  <div className="max-h-[280px] overflow-y-auto border border-[#E2E5EA] rounded-lg">
                    {detectedPlaceholders.map((p, i) => (
                      <div key={p.key} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#E2E5EA] last:border-0">
                        <input
                          type="checkbox"
                          checked={p.selected}
                          onChange={() => setDetectedPlaceholders(prev => prev.map((pp, ii) => ii === i ? { ...pp, selected: !pp.selected } : pp))}
                          className="accent-[#2E6FF2]"
                        />
                        <input
                          type="text"
                          value={p.label}
                          onChange={(e) => setDetectedPlaceholders(prev => prev.map((pp, ii) => ii === i ? { ...pp, label: e.target.value } : pp))}
                          className="flex-1 text-[13px] text-[#1B1F2B] border-0 border-b border-transparent hover:border-[#E2E5EA] focus:border-[#2E6FF2] focus:outline-none py-0.5"
                        />
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          p.type === 'blank' ? 'bg-[#ff9f0a]/10 text-[#ff9f0a]' :
                          p.type === 'placeholder' ? 'bg-[#2E6FF2]/10 text-[#2E6FF2]' :
                          p.type === 'underline' ? 'bg-[#7C8494]/10 text-[#7C8494]' :
                          'bg-[#30d158]/10 text-[#30d158]'
                        }`}>
                          {p.type === 'blank' ? '빈칸' : p.type === 'placeholder' ? '변수' : p.type === 'underline' ? '밑줄' : '괄호'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {autoRegPreview && (
                  <details className="mt-3">
                    <summary className="text-[12px] text-[#7C8494] cursor-pointer">미리보기</summary>
                    <pre className="mt-1 p-3 bg-[#f9fafb] rounded-lg text-[11px] text-[#7C8494] max-h-[120px] overflow-y-auto whitespace-pre-wrap">{autoRegPreview}</pre>
                  </details>
                )}

                <div className="flex gap-2 justify-end mt-5">
                  <button onClick={() => setAutoRegStep(1)} className="px-4 py-2 text-[13px] text-[#7C8494]">이전</button>
                  <button
                    onClick={() => setAutoRegStep(3)}
                    className="px-5 py-2 text-[13px] font-medium text-white bg-[#2E6FF2] rounded-lg hover:bg-[#1a5ad9] transition-colors"
                  >
                    다음
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: 정보 입력 */}
            {autoRegStep === 3 && (
              <div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[13px] text-[#7C8494] mb-1.5">템플릿 이름</label>
                    <input
                      type="text"
                      value={autoRegName}
                      onChange={(e) => setAutoRegName(e.target.value)}
                      className="w-full px-3 py-2.5 text-[13px] border border-[#E2E5EA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E6FF2]/30 focus:border-[#2E6FF2]"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] text-[#7C8494] mb-1.5">설명</label>
                    <textarea
                      value={autoRegDesc}
                      onChange={(e) => setAutoRegDesc(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2.5 text-[13px] border border-[#E2E5EA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E6FF2]/30 focus:border-[#2E6FF2] resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[13px] text-[#7C8494] mb-1.5">부서</label>
                      <select
                        value={autoRegDeptId}
                        onChange={(e) => setAutoRegDeptId(e.target.value)}
                        className="w-full px-3 py-2.5 text-[13px] border border-[#E2E5EA] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2E6FF2]/30"
                      >
                        <option value="">전사</option>
                        {deptList.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[13px] text-[#7C8494] mb-1.5">공개 범위</label>
                      <select
                        value={autoRegScope}
                        onChange={(e) => setAutoRegScope(e.target.value as '전사 공용' | '부서 전용')}
                        className="w-full px-3 py-2.5 text-[13px] border border-[#E2E5EA] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2E6FF2]/30"
                      >
                        <option value="전사 공용">전사 공용</option>
                        <option value="부서 전용">부서 전용</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end mt-6">
                  <button onClick={() => setAutoRegStep(2)} className="px-4 py-2 text-[13px] text-[#7C8494]">이전</button>
                  <button
                    onClick={async () => {
                      if (!autoRegName.trim()) { alert('이름을 입력해주세요.'); return; }
                      setAutoRegSaving(true);
                      try {
                        const selectedPhs = detectedPlaceholders.filter(p => p.selected).map(({ key, label, type, location, context }) => ({ key, label, type, location, context }));
                        const res = await fetch('/api/templates', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: autoRegName.trim(),
                            description: autoRegDesc.trim(),
                            departmentId: autoRegDeptId || null,
                            scope: autoRegScope,
                            content: '',
                            templateFileId: autoRegFileId,
                            placeholders: selectedPhs,
                          }),
                        });
                        const d = await res.json();
                        if (d.template) {
                          setShowAutoReg(false);
                          loadTemplates();
                        } else {
                          alert(d.error ?? '등록 실패');
                        }
                      } catch { alert('서버 오류'); }
                      setAutoRegSaving(false);
                    }}
                    disabled={autoRegSaving || !autoRegName.trim()}
                    className="px-5 py-2 text-[13px] font-medium text-white bg-[#2E6FF2] rounded-lg hover:bg-[#1a5ad9] disabled:opacity-40 transition-colors"
                  >
                    {autoRegSaving ? '등록 중...' : '템플릿 등록'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
