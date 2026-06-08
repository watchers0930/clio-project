'use client';

import { useContractRiskResult } from '@/hooks/useContractRiskResult';
import { ContractRiskDefaultView } from '@/components/contract-risk/ContractRiskDefaultView';
import {
  ContractRiskApplyErrorModal,
  ContractRiskResultError,
  ContractRiskResultLoading,
  ContractRiskSuggestLayout,
} from '@/components/contract-risk/contract-risk-result-sections';

export default function ContractRiskResultPage() {
  const state = useContractRiskResult();

  if (state.loading) {
    return <ContractRiskResultLoading />;
  }

  if (state.error || !state.analysis) {
    return <ContractRiskResultError error={state.error} onBack={() => state.router.push('/contract-risk')} />;
  }

  if (state.suggestMode) {
    return (
      <>
        <ContractRiskSuggestLayout
          foundItems={state.foundItems}
          selectedKeys={state.selectedKeys}
          onToggleSelect={state.toggleSelect}
          onSelectAll={state.selectAll}
          onClearAll={state.clearAll}
          activeKey={state.activeKey}
          onActivate={state.setActiveKey}
          suggestions={state.suggestions}
          activeSuggestion={state.activeSuggestion}
          isSuggesting={state.isSuggesting}
          onSuggestStart={state.handleSuggestStart}
          onAccept={state.handleAccept}
          onSkip={state.handleSkip}
          onEditRevised={state.handleEditRevised}
          acceptedCount={state.acceptedCount}
          outputFormat={state.outputFormat}
          onFormatChange={state.setOutputFormat}
          onDownload={state.handleBulkDownload}
          isApplying={state.isApplying}
          onExit={state.handleExitSuggestMode}
        />
        <ContractRiskApplyErrorModal
          applyError={state.applyError}
          onClose={() => state.setApplyError(null)}
          onRetry={() => state.router.push('/contract-risk')}
        />
      </>
    );
  }

  return (
    <ContractRiskDefaultView
      analysis={state.analysis}
      total={state.total}
      filter={state.filter}
      onFilterChange={state.setFilter}
      counts={state.counts}
      sortedItems={state.sortedItems}
      downloading={state.downloading}
      onDownload={state.handleDownload}
      onEnterSuggestMode={state.handleEnterSuggestMode}
      onNavigate={(path) => state.router.push(path)}
    />
  );
}
