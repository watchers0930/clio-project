'use client';

import { SkeletonCard, ConfirmDialog } from '@/components/ui';
import { TemplateAutoRegisterModal, TemplateEditModal } from '@/components/templates/template-modals';
import { TemplatePreviewModal } from '@/components/templates/template-preview-modal';
import { TemplatesGrid, TemplatesHeader, TemplatesTabs } from '@/components/templates/templates-sections';
import { useTemplatesPage } from '@/components/templates/use-templates-page';
import {
  analyzeAutoRegFile,
  getTemplateUploadError,
  submitAutoRegTemplate,
} from '@/components/templates/template-page-actions';

const ICON_OPTIONS = ['📊', '📝', '💡', '📋', '📈', '✉️', '👥', '🎯', '📄', '🔧', '🗂️', '📌'];

export default function TemplatesPage() {
  const {
    loading, templates, deptList, tab, setTab, selectedIds, setSelectedIds, selectMode, setSelectMode, filtered, toast,
    showModal, previewTemplate, setPreviewTemplate, editId,
    formName, setFormName, formDescription, setFormDescription, formDepartmentId, setFormDepartmentId,
    formScope, setFormScope, formIcon, setFormIcon, formContent, setFormContent, formFile, setFormFile,
    formExistingFile, formRemoveFile, setFormRemoveFile, formTemplateHtml, setFormTemplateHtml,
    formTemplateFields, formTemplateSections, saving,
    confirmState, closeConfirm,
    showAutoReg, setShowAutoReg, autoRegStep, setAutoRegStep, autoRegFile, setAutoRegFile, analyzing, setAnalyzing,
    detectedPlaceholders, setDetectedPlaceholders, autoRegFileId, setAutoRegFileId, autoRegPreview, setAutoRegPreview,
    autoRegPreviewHtml, setAutoRegPreviewHtml, autoRegName, setAutoRegName, autoRegDesc, setAutoRegDesc,
    autoRegDeptId, setAutoRegDeptId, autoRegScope, setAutoRegScope, autoRegSaving, setAutoRegSaving,
    loadTemplates, resetForm, openCreate, openEdit, handleSave, handleDelete, toggleSelect, toggleSelectAll,
    handleBulkDelete, handleDuplicate,
  } = useTemplatesPage();

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
        confirmLabel={confirmState.confirmLabel ?? '삭제'}
        variant={confirmState.variant ?? 'danger'}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
}
