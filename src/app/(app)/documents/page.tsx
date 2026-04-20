'use client';

import { ShareLinkModal } from '@/components/documents/ShareLinkModal';
import { VersionPanel } from '@/components/documents/VersionPanel';
import { QualityCheckPanel } from '@/components/documents/QualityCheckPanel';
import { TodoExtractModal } from '@/components/meetings/TodoExtractModal';
import { SttModal } from '@/components/meetings/SttModal';
import { DocumentsPageHeader } from '@/components/documents/documents-page-header';
import { DocumentsListSection } from '@/components/documents/documents-list-section';
import { DocumentViewerModal } from '@/components/documents/document-viewer-modal';
import { NewDocumentModal } from '@/components/documents/new-document-modal';
import { ConfirmDialog } from '@/components/ui';
import {
  DOWNLOAD_FORMAT_OPTIONS,
  FONT_OPTIONS,
  statusColor,
  statusDot,
  useDocumentsPage,
} from '@/components/documents/use-documents-page';

export default function DocumentsPage() {
  const state = useDocumentsPage();

  if (state.loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-[#e5e5e7] rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 bg-white rounded-2xl border border-[#e5e5e7]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <DocumentsPageHeader
        onOpenStt={() => state.setSttModalOpen(true)}
        onOpenCreate={state.openCreateModal}
      />

      <DocumentsListSection
        docs={state.docs}
        selectedDocIds={state.selectedDocIds}
        statusDot={statusDot}
        onToggleSelectAll={state.toggleSelectAll}
        onBulkDelete={state.handleBulkDelete}
        onDeleteAll={state.handleDeleteAll}
        onToggleDocSelect={state.toggleDocSelect}
        onOpenDocument={(doc) => {
          if (doc.status === '초안') state.openDocModal(doc);
          else state.router.push(`/documents/${doc.id}`);
        }}
        onDownload={state.handleDownload}
        onOpenShare={(doc) => {
          state.setShareDocId(doc.id);
          state.setShareDocTitle(doc.title);
        }}
        onOpenVersionPanel={state.openVersionPanel}
        onDelete={state.handleDelete}
        onOpenCreate={state.openCreateModal}
      />

      <DocumentViewerModal
        viewDoc={state.viewDoc}
        editTitle={state.editTitle}
        editContent={state.editContent}
        saving={state.saving}
        isEdited={state.isEdited}
        isDraft={state.isDraft}
        showViewerComments={state.showViewerComments}
        statusColor={statusColor}
        selectedFont={state.selectedFont}
        downloadFormat={state.downloadFormat}
        fontOptions={FONT_OPTIONS}
        downloadFormatOptions={DOWNLOAD_FORMAT_OPTIONS}
        designPrompt={state.designPrompt}
        designPromptLang={state.designPromptLang}
        loadingDesignPrompt={state.loadingDesignPrompt}
        copiedDesignPrompt={state.copiedDesignPrompt}
        onChangeTitle={state.setEditTitle}
        onChangeContent={state.setEditContent}
        onToggleComments={() => state.setShowViewerComments((value: boolean) => !value)}
        onRequestClose={state.handleViewerClose}
        onSave={state.handleSave}
        onComplete={state.handleComplete}
        onRevertToDraft={state.handleRevertToDraft}
        onChangeDownloadFormat={state.setDownloadFormat}
        onChangeSelectedFont={state.setSelectedFont}
        onDownload={state.handleDownload}
        onOpenQualityCheck={state.setQualityCheckDocId}
        onOpenTodoExtract={() => {
          state.setTodoExtractInitial([]);
          state.setTodoExtractOpen(true);
        }}
        onGenerateDesignPrompt={state.handleDesignPrompt}
        onCopyDesignPrompt={state.handleCopyDesignPrompt}
        onDownloadAiContext={state.handleDownloadAiContext}
        onCommentsReflected={() => {
          state.setShowViewerComments(false);
          state.loadDocs();
        }}
      />

      <NewDocumentModal
        open={state.showModal}
        step={state.step}
        selectedTemplate={state.selectedTemplate}
        selectedFiles={state.selectedFiles}
        instructions={state.instructions}
        customStructure={state.customStructure}
        generating={state.generating}
        generatedDoc={state.generatedDoc}
        outputFormat={state.outputFormat}
        generatedDownloadUrl={state.generatedDownloadUrl}
        generatedOutline={state.generatedOutline}
        contractFormData={state.contractFormData}
        dateErrors={state.dateErrors}
        fileSearch={state.fileSearch}
        fileDeptFilter={state.fileDeptFilter}
        fileTypeFilter={state.fileTypeFilter}
        templates={state.templates}
        sourceFiles={state.sourceFiles}
        onClose={state.resetModal}
        onBack={() => {
          if (state.step === 1 || state.step === 5) state.resetModal();
          else state.setStep(state.step - 1);
        }}
        onNext={() => state.setStep(state.step + 1)}
        canNext={state.canNext()}
        onGenerate={state.handleGenerate}
        onOpenGeneratedDocument={(doc) => {
          state.openDocModal(doc);
          state.resetModal();
        }}
        onSetSelectedTemplate={state.setSelectedTemplate}
        onToggleFile={state.toggleFile}
        onClearSelectedFiles={() => state.setSelectedFiles(new Set())}
        onSetInstructions={state.setInstructions}
        onSetCustomStructure={state.setCustomStructure}
        onSetOutputFormat={state.setOutputFormat}
        onSetContractFormData={(updater) => state.setContractFormData(updater)}
        onHandleDateInput={state.handleDateInput}
        onSetFileSearch={state.setFileSearch}
        onSetFileDeptFilter={state.setFileDeptFilter}
        onSetFileTypeFilter={state.setFileTypeFilter}
        onDownloadGeneratedFile={state.handleDownloadGeneratedFile}
        onDownloadAiContext={state.handleDownloadAiContext}
      />

      {state.shareDocId && (
        <ShareLinkModal
          docId={state.shareDocId}
          docTitle={state.shareDocTitle}
          onClose={() => state.setShareDocId(null)}
        />
      )}

      {state.versionPanelDocId && (
        <VersionPanel
          docId={state.versionPanelDocId}
          items={state.versionItems}
          loading={state.versionLoading}
          onClose={() => state.setVersionPanelDocId(null)}
          onCreateNewVersion={state.handleVersionNew}
          onDownload={(id, title, status, createdAt) => {
            const doc = state.docs.find((item) => item.id === id);
            if (doc) {
              state.setVersionPanelDocId(null);
              state.handleDownload(doc);
              return;
            }
            state.handleDownload({ id, title, template: '', createdAt, status: status as '초안' | '완료', sourceCount: 0 });
          }}
        />
      )}

      <SttModal
        isOpen={state.sttModalOpen}
        onClose={() => state.setSttModalOpen(false)}
        onDocumentCreated={() => {
          state.setSttModalOpen(false);
          state.loadDocs();
        }}
      />

      {state.todoExtractOpen && state.viewDoc && (
        <TodoExtractModal
          isOpen={state.todoExtractOpen}
          onClose={() => state.setTodoExtractOpen(false)}
          documentId={state.viewDoc.id}
          documentTitle={state.viewDoc.title}
          initialTodos={state.todoExtractInitial}
          onSuccess={() => state.setTodoExtractOpen(false)}
        />
      )}

      {state.qualityCheckDocId && (
        <div className="fixed inset-y-0 right-0 z-50 w-96 shadow-2xl">
          <QualityCheckPanel
            documentId={state.qualityCheckDocId}
            onClose={() => state.setQualityCheckDocId(null)}
            autoRequest
          />
        </div>
      )}

      <ConfirmDialog
        open={state.confirmState.open}
        title={state.confirmState.title}
        description={state.confirmState.description}
        confirmLabel="확인"
        onConfirm={state.confirmState.onConfirm}
        onCancel={state.closeConfirm}
      />
    </div>
  );
}
