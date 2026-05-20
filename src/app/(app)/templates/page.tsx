'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import { SkeletonCard, ConfirmDialog } from '@/components/ui';
import { TemplateAutoRegisterModal, TemplateEditModal } from '@/components/templates/template-modals';
import { TemplatePreviewModal } from '@/components/templates/template-preview-modal';
import { TemplatesGrid, TemplatesHeader, TemplatesTabs } from '@/components/templates/templates-sections';
import type { AutoPlaceholder, Template, TemplateFile } from '@/components/templates/types';
import { createTemplateBundle } from '@/lib/templates/template-schema';
import {
  analyzeAutoRegFile,
  getTemplateUploadError,
  readApiError,
  submitAutoRegTemplate,
} from '@/components/templates/template-page-actions';

const ICON_OPTIONS = ['📊', '📝', '💡', '📋', '📈', '✉️', '👥', '🎯', '📄', '🔧', '🗂️', '📌'];

export default function TemplatesPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [deptList, setDeptList] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'전사 공용' | '부서 전용'>('전사 공용');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
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
  const [formTemplateHtml, setFormTemplateHtml] = useState('');
  const [formTemplateFields, setFormTemplateFields] = useState<Template['templateFields']>([]);
  const [formTemplateSections, setFormTemplateSections] = useState<Template['templateSections']>([]);
  const [saving, setSaving] = useState(false);

  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; description?: string; onConfirm: () => void }>({ open: false, title: '', onConfirm: () => {} });
  const openConfirm = (title: string, description: string | undefined, onConfirm: () => void) => setConfirmState({ open: true, title, description, onConfirm });
  const closeConfirm = () => setConfirmState((s) => ({ ...s, open: false }));

  const [showAutoReg, setShowAutoReg] = useState(false);
  const [autoRegStep, setAutoRegStep] = useState(1);
  const [autoRegFile, setAutoRegFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedPlaceholders, setDetectedPlaceholders] = useState<AutoPlaceholder[]>([]);
  const [autoRegFileId, setAutoRegFileId] = useState<string | null>(null);
  const [autoRegPreview, setAutoRegPreview] = useState('');
  const [autoRegPreviewHtml, setAutoRegPreviewHtml] = useState('');
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
            content: (t.content as string) ?? '',
            templateMode: (t.templateMode as 'html-template' | undefined) ?? 'html-template',
            templateHtml: (t.templateHtml as string | undefined) ?? '',
            templateFields: (t.templateFields as Template['templateFields']) ?? [],
            templateSections: (t.templateSections as Template['templateSections']) ?? [],
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
    fetch('/api/departments').then(r => r.json()).then(json => {
      const depts = (json.data ?? [])
        .filter((d: { is_active: boolean }) => d.is_active !== false)
        .map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }));
      setDeptList(depts);
      if (depts.length > 0 && !formDepartmentId) setFormDepartmentId(depts[0].id);
    }).catch(() => {});
  }, [loadTemplates, formDepartmentId]);

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
    const bundle = createTemplateBundle({ name: '', description: '', outline: '' });
    setFormTemplateHtml(bundle.layoutHtml);
    setFormTemplateFields(bundle.fields);
    setFormTemplateSections(bundle.sections);
    setSaving(false);
  };

  const openCreate = () => { resetForm(); setShowModal(true); };

  const openEdit = (t: Template) => {
    setPreviewTemplate(null);
    setEditId(t.id);
    setFormName(t.name);
    setFormDescription(t.description);
    setFormContent(t.content ?? '');
    setFormTemplateHtml(t.templateHtml ?? '');
    setFormTemplateFields(t.templateFields ?? []);
    setFormTemplateSections(t.templateSections ?? []);
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
    const fileError = getTemplateUploadError(formFile);
    if (fileError) {
      toast.error(fileError);
      return;
    }
    setSaving(true);

    const templateBundle = createTemplateBundle({
      name: formName.trim(),
      description: formDescription,
      outline: formContent,
    });
    const templateHtml = formTemplateHtml.trim() || templateBundle.layoutHtml;
    const templateFields = formTemplateFields?.length ? formTemplateFields : templateBundle.fields;
    const templateSections = formTemplateSections?.length ? formTemplateSections : templateBundle.sections;

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
          fd.append('templateHtml', templateHtml);
          fd.append('templateFields', JSON.stringify(templateFields));
          fd.append('templateSections', JSON.stringify(templateSections));
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
              templateHtml,
              templateFields,
              templateSections,
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
                ? {
                    ...t,
                    name: updated.name,
                    description: updated.description,
                    content: updated.content ?? '',
                    templateMode: updated.templateMode ?? 'html-template',
                    templateHtml: updated.templateHtml ?? '',
                    templateFields: updated.templateFields ?? [],
                    templateSections: updated.templateSections ?? [],
                    department: updated.department,
                    departmentId: updated.departmentId,
                    scope: updated.scope,
                    lastUpdated: updated.lastUpdated,
                    icon: formIcon,
                    templateFile: updated.templateFile ?? null,
                  }
                : t
            )
          );
        } else {
          toast.error(await readApiError(res, '템플릿 수정에 실패했습니다.'));
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
          fd.append('templateHtml', templateHtml);
          fd.append('templateFields', JSON.stringify(templateFields));
          fd.append('templateSections', JSON.stringify(templateSections));
          fd.append('departmentId', formDepartmentId);
          fd.append('scope', formScope);
          if (formFile) fd.append('file', formFile);
          res = await fetch('/api/templates', { method: 'POST', body: fd });
        } else {
          res = await fetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: formName, description: formDescription, content: formContent, departmentId: formDepartmentId, scope: formScope, templateHtml, templateFields, templateSections }),
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
              templateMode: newTmpl.templateMode ?? 'html-template',
              templateHtml: newTmpl.templateHtml ?? '',
              templateFields: newTmpl.templateFields ?? [],
              templateSections: newTmpl.templateSections ?? [],
              department: newTmpl.department,
              departmentId: newTmpl.departmentId, scope: newTmpl.scope,
              usageCount: 0, lastUpdated: newTmpl.lastUpdated, placeholders: [],
              templateFile: newTmpl.templateFile ?? null,
            },
          ]);
        } else {
          toast.error(await readApiError(res, '템플릿 생성에 실패했습니다.'));
          setSaving(false);
          return;
        }
      }
      resetForm();
      loadTemplates();
    } catch {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    openConfirm('템플릿을 삭제하시겠습니까?', '삭제된 템플릿은 복구할 수 없습니다.', async () => {
      try {
        const res = await fetch(`/api/templates?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          setTemplates((prev) => prev.filter((t) => t.id !== id));
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || '삭제에 실패했습니다.');
        }
        await loadTemplates();
      } catch { toast.error('삭제 중 오류가 발생했습니다.'); }
      closeConfirm();
    });
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

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    openConfirm(`선택한 ${selectedIds.size}개 템플릿을 삭제하시겠습니까?`, '삭제된 템플릿은 복구할 수 없습니다.', async () => {
      try {
        const results = await Promise.all(
          Array.from(selectedIds).map((id) =>
            fetch(`/api/templates?id=${id}`, { method: 'DELETE' }).then((r) => r.ok)
          )
        );
        const failCount = results.filter((ok) => !ok).length;
        if (failCount > 0) toast.error(`${failCount}개 삭제 실패`);
        setSelectedIds(new Set());
        setSelectMode(false);
        await loadTemplates();
      } catch { toast.error('삭제 중 오류가 발생했습니다.'); }
      closeConfirm();
    });
  };

  const handleDuplicate = async (t: Template) => {
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${t.name} (복사본)`,
          description: t.description,
          content: t.content,
          departmentId: t.departmentId,
          scope: t.scope,
          templateHtml: t.templateHtml,
          templateFields: t.templateFields,
          templateSections: t.templateSections,
          templateFileId: t.templateFile?.id || undefined,
        }),
      });
      if (res.ok) {
        toast.success('템플릿이 복사되었습니다.');
        loadTemplates();
      } else {
        toast.error('템플릿 복사에 실패했습니다.');
      }
    } catch {
      toast.error('템플릿 복사 중 오류가 발생했습니다.');
    }
  };

  if (loading) return <SkeletonCard count={6} />;

  return (
    <div className="flex flex-col gap-5 pb-10">
      <TemplatesHeader
        selectMode={selectMode}
        selectedCount={selectedIds.size}
        allSelected={selectedIds.size === filtered.length && filtered.length > 0}
        onToggleSelectAll={toggleSelectAll}
        onBulkDelete={handleBulkDelete}
        onCancelSelect={() => { setSelectMode(false); setSelectedIds(new Set()); }}
        onEnterSelectMode={() => setSelectMode(true)}
        onOpenAutoRegister={() => { setShowAutoReg(true); setAutoRegStep(1); setAutoRegFile(null); setDetectedPlaceholders([]); setAutoRegFileId(null); setAutoRegPreview(''); setAutoRegPreviewHtml(''); setAutoRegName(''); setAutoRegDesc(''); }}
        onOpenCreate={openCreate}
      />

      <TemplatesTabs tab={tab} templates={templates} onChange={setTab} />

      <TemplatesGrid
        filtered={filtered}
        tab={tab}
        selectMode={selectMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onOpenCreate={openCreate}
        onPreview={setPreviewTemplate}
        onEdit={openEdit}
        onDuplicate={(template) => { void handleDuplicate(template); }}
        onDelete={handleDelete}
      />

      <TemplateEditModal
        open={showModal}
        editId={editId}
        formName={formName}
        formDescription={formDescription}
        formDepartmentId={formDepartmentId}
        formScope={formScope}
        formIcon={formIcon}
        formContent={formContent}
        formTemplateHtml={formTemplateHtml}
        formTemplateFields={formTemplateFields ?? []}
        formTemplateSections={formTemplateSections ?? []}
        formFile={formFile}
        formExistingFile={formExistingFile}
        formRemoveFile={formRemoveFile}
        saving={saving}
        deptList={deptList}
        iconOptions={ICON_OPTIONS}
        onClose={resetForm}
        onNameChange={setFormName}
        onDescriptionChange={setFormDescription}
        onDepartmentChange={setFormDepartmentId}
        onScopeChange={setFormScope}
        onIconChange={setFormIcon}
        onContentChange={setFormContent}
        onTemplateHtmlChange={setFormTemplateHtml}
        onFileChange={(file) => {
          const fileError = getTemplateUploadError(file);
          if (fileError) {
            toast.error(fileError);
            return;
          }
          setFormFile(file);
          setFormRemoveFile(false);
        }}
        onRemoveExistingFile={() => setFormRemoveFile(true)}
        onClearNewFile={() => { setFormFile(null); setFormRemoveFile(false); }}
        onSave={() => { void handleSave(); }}
      />

      <TemplatePreviewModal
        open={previewTemplate !== null}
        template={previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        onEdit={openEdit}
      />

      <TemplateAutoRegisterModal
        open={showAutoReg}
        step={autoRegStep}
        autoRegFile={autoRegFile}
        analyzing={analyzing}
        detectedPlaceholders={detectedPlaceholders}
        autoRegPreview={autoRegPreview}
        autoRegPreviewHtml={autoRegPreviewHtml}
        autoRegName={autoRegName}
        autoRegDesc={autoRegDesc}
        autoRegDeptId={autoRegDeptId}
        autoRegScope={autoRegScope}
        autoRegSaving={autoRegSaving}
        deptList={deptList}
        onClose={() => setShowAutoReg(false)}
        onStepChange={setAutoRegStep}
        onFileChange={(file) => {
          const fileError = getTemplateUploadError(file);
          if (fileError) {
            toast.error(fileError);
            return;
          }
          setAutoRegFile(file);
        }}
        onTogglePlaceholder={(index) => setDetectedPlaceholders((prev) => prev.map((placeholder, placeholderIndex) => placeholderIndex === index ? { ...placeholder, selected: !placeholder.selected } : placeholder))}
        onRenamePlaceholder={(index, value) => setDetectedPlaceholders((prev) => prev.map((placeholder, placeholderIndex) => placeholderIndex === index ? { ...placeholder, label: value } : placeholder))}
        onNameChange={setAutoRegName}
        onDescChange={setAutoRegDesc}
        onDeptChange={setAutoRegDeptId}
        onScopeChange={setAutoRegScope}
        onAnalyze={() => { void analyzeAutoRegFile({ autoRegFile, setAnalyzing, setAutoRegFileId, setAutoRegPreview, setAutoRegPreviewHtml, setAutoRegName, setDetectedPlaceholders, setAutoRegStep, toast }); }}
        onSubmit={() => { void submitAutoRegTemplate({ autoRegName, autoRegDesc, autoRegDeptId, autoRegScope, autoRegFileId, detectedPlaceholders, setAutoRegSaving, setShowAutoReg, loadTemplates, toast }); }}
      />

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel="삭제"
        variant="danger"
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
}
