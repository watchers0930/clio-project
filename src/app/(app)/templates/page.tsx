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

  // Create/Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDepartmentId, setFormDepartmentId] = useState('');
  const [formScope, setFormScope] = useState<'전사 공용' | '부서 전용'>('전사 공용');
  const [formIcon, setFormIcon] = useState('📄');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formExistingFile, setFormExistingFile] = useState<TemplateFile | null>(null);
  const [formRemoveFile, setFormRemoveFile] = useState(false);
  const [saving, setSaving] = useState(false);

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
              departmentId: formDepartmentId, scope: formScope,
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
                ? { ...t, name: updated.name, description: updated.description, department: updated.department, departmentId: updated.departmentId, scope: updated.scope, lastUpdated: updated.lastUpdated, icon: formIcon, templateFile: updated.templateFile ?? null }
                : t
            )
          );
        }
      } else {
        let res: Response;
        if (useFormData) {
          const fd = new FormData();
          fd.append('name', formName);
          fd.append('description', formDescription);
          fd.append('departmentId', formDepartmentId);
          fd.append('scope', formScope);
          if (formFile) fd.append('file', formFile);
          res = await fetch('/api/templates', { method: 'POST', body: fd });
        } else {
          res = await fetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: formName, description: formDescription, departmentId: formDepartmentId, scope: formScope }),
          });
        }
        if (res.ok) {
          const data = await res.json();
          const newTmpl = data.template;
          setTemplates((prev) => [
            ...prev,
            {
              id: newTmpl.id, name: newTmpl.name, icon: formIcon,
              description: newTmpl.description, department: newTmpl.department,
              departmentId: newTmpl.departmentId, scope: newTmpl.scope,
              usageCount: 0, lastUpdated: newTmpl.lastUpdated, placeholders: [],
              templateFile: newTmpl.templateFile ?? null,
            },
          ]);
        }
      }
      resetForm();
      loadTemplates();
    } catch {
      // silent
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
      }
    } catch {
      // silent
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          새 템플릿
        </button>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-[#e5e5e7] p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{t.icon}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(t)}
                    title="편집"
                    className="p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] hover:text-[#0071e3] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                  </button>
                  <button
                    onClick={() => handleDuplicate(t)}
                    title="복제"
                    className="p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] hover:text-[#0071e3] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    title="삭제"
                    className="p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] hover:text-[#ff3b30] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-[#1d1d1f] mb-1">{t.name}</h3>
              <p className="text-sm text-[#6e6e73] line-clamp-2 mb-3">{t.description}</p>
              <div className="flex flex-wrap gap-2 items-center text-xs">
                <span className="px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f] font-medium">{t.department}</span>
                {t.templateFile && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{t.templateFile.type}</span>
                )}
                <span className="text-[#6e6e73]">사용 {t.usageCount}회</span>
                <span className="text-[#6e6e73]">·</span>
                <span className="text-[#6e6e73]">{t.lastUpdated}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="tmpl-modal-title" onKeyDown={(e) => { if (e.key === 'Escape') resetForm(); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-[#e5e5e7] flex items-center justify-between">
              <h2 id="tmpl-modal-title" className="text-lg font-semibold text-[#1d1d1f]">
                {editId ? '템플릿 편집' : '새 템플릿 만들기'}
              </h2>
              <button onClick={resetForm} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-6 space-y-8">
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
                <p className="text-xs text-[#6e6e73] mb-3">HWP, DOCX, XLSX, PDF 등 표준양식 파일을 첨부하세요</p>

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
                      accept=".hwp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.md"
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
            <div className="px-6 py-5 border-t border-[#e5e5e7] flex justify-end gap-3">
              <button onClick={resetForm} className="px-5 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors">취소</button>
              <button
                onClick={handleSave}
                disabled={!formName.trim() || saving}
                className="px-6 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? '저장 중...' : editId ? '수정' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
