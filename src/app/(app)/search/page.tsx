'use client';

import { Suspense, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { buildDocumentCreateHref } from '@/lib/documents/navigation';
import {
  AiSearchTab,
  FileSearchTab,
  SearchHeader,
  SearchPreviewModal,
  SearchTabs,
} from '@/components/search/search-sections';
import { ShareLinkModal } from '@/components/documents/ShareLinkModal';
import { GmailAttachmentModal } from '@/components/search/gmail-attachment-modal';
import { GmailEmailModal } from '@/components/search/gmail-email-modal';
import { GmailSyncBar } from '@/components/search/gmail-sync-bar';
import { useGmailSync } from '@/components/search/use-gmail-sync';
import { useGmailActions } from '@/components/search/use-gmail-actions';
import { useSearchChat } from '@/components/search/use-search-chat';
import { useSearchResultActions } from '@/components/search/use-search-result-actions';
import type { SearchResult, SearchTab } from '@/components/search/types';

/* ────────────────────────── page ─────────────────────────── */
function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // 탭
  const [activeTab, setActiveTab] = useState<SearchTab>('file');

  // 파일 검색 상태
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [department, setDepartment] = useState('전체');
  const [departments, setDepartments] = useState<string[]>(['전체']);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [fileType, setFileType] = useState('전체');
  const [sort, setSort] = useState('관련도순');
  const [expandedSummary, setExpandedSummary] = useState<string | null>(null);
  const gmail = useGmailActions();
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [searchContext, setSearchContext] = useState<{
    role: string;
    departmentName: string;
    documentScopeLabel: string;
    departmentFilterLabel: string;
    availableDepartments: string[];
  } | null>(null);

  // AI 채팅 상태
  const {
    chatMessages,
    setChatMessages,
    chatInput,
    setChatInput,
    chatLoading,
    setPinnedFileIds,
    chatEndRef,
    sendChat,
  } = useSearchChat(results);
  const [isElectron, setIsElectron] = useState(false);
  const {
    previewData,
    setPreviewData,
    previewLoading,
    shareTarget,
    setShareTarget,
    openPreview,
    startChatFromResult,
    canAnalyzeContract,
    handleDownloadOriginal,
    copyLocalPath,
    openResult,
    openComments,
    openShare,
  } = useSearchResultActions({ router, toast, gmail, setActiveTab, setPinnedFileIds, setChatInput });

  // 부서 목록 + 검색 제안어
  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(json => {
      const names = (json.templates ?? []).map((t: { name: string }) => t.name);
      setSuggestions(names.length > 0 ? names : ['회의록', '보고서', '계약서', '제안서', '공문']);
    }).catch(() => {
      setSuggestions(['회의록', '보고서', '계약서', '제안서', '공문']);
    });
  }, []);

  // 실행 환경 판별 (데스크톱 앱 여부)
  useEffect(() => {
    setIsElectron(!!(window as Window & { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron);
  }, []);


  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      setLoading(true);
      setSearched(true);
      setExpandedSummary(null);
      try {
        const [mainRes, localRes] = await Promise.allSettled([
          fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: q, department, fileType }),
          }),
          fetch('/api/local-files/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: q }),
          }),
        ]);

        let mainResults: SearchResult[] = [];
        let recentQs: string[] = [];
        let ctx = null;
        let depts = ['전체'];

        if (mainRes.status === 'fulfilled' && mainRes.value.ok) {
          const data = await mainRes.value.json();
          mainResults = data.results ?? [];
          recentQs = data.recentQueries ?? [];
          ctx = data.searchContext ?? null;
          depts = data.searchContext?.availableDepartments ?? ['전체'];
        }

        let localResults: SearchResult[] = [];
        if (localRes.status === 'fulfilled' && localRes.value.ok) {
          const data = await localRes.value.json() as { results: Array<{ id: string; name: string; path: string; fileType: string; excerpt: string; relevance: number }> };
          localResults = (data.results ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            excerpt: r.excerpt,
            relevance: r.relevance,
            fileType: r.fileType ?? '',
            department: '',
            date: '',
            aiSummary: '',
            sourceType: 'file' as const,
            dataSource: 'local' as const,
            localPath: r.path,
          }));
        }

        setResults([...mainResults, ...localResults]);
        setRecentQueries(recentQs);
        setSearchContext(ctx);
        setDepartments(depts);
      } catch {
        setResults([]);
        setRecentQueries([]);
        setSearchContext(null);
        setDepartments(['전체']);
      } finally {
        setLoading(false);
      }
    },
    [department, fileType],
  );

  const doSearchRef = useRef(doSearch);
  useEffect(() => { doSearchRef.current = doSearch; }, [doSearch]);

  // Gmail 동기화(진입 자동 + 수동). 새 메일이 들어오면 현재 검색어로 자동 재검색.
  const queryRef = useRef(query);
  useEffect(() => { queryRef.current = query; }, [query]);
  const gmailSync = useGmailSync(() => {
    if (queryRef.current.trim()) void doSearchRef.current(queryRef.current);
  });

  const qParam = searchParams.get('q')?.trim() ?? '';
  const askParam = searchParams.get('ask')?.trim() ?? '';
  const tabParam = searchParams.get('tab') ?? '';

  useEffect(() => {
    if (tabParam === 'ai') setActiveTab('ai');
    if (qParam) {
      setQuery(qParam);
      void doSearchRef.current(qParam);
    }
    if (askParam) {
      setActiveTab('ai');
      setChatInput(askParam);
    }
  }, [qParam, askParam, tabParam, setChatInput]);

  const sortedResults = [...results].sort((a, b) => {
    switch (sort) {
      case '최신순': return b.date.localeCompare(a.date);
      case '오래된순': return a.date.localeCompare(b.date);
      case '이름순': return a.name.localeCompare(b.name);
      default: return b.relevance - a.relevance;
    }
  });
  const relatedResults = sortedResults.filter((result) => {
    if (sortedResults.length <= 1) return false;
    if (result.id === sortedResults[0]?.id) return false;
    const sameOriginDocument = Boolean(
      sortedResults[0]?.originDocumentId &&
      result.originDocumentId &&
      sortedResults[0].originDocumentId === result.originDocumentId,
    );
    const sameDepartment = result.department === sortedResults[0]?.department;
    const sameType = result.fileType === sortedResults[0]?.fileType;
    return sameOriginDocument || sameDepartment || sameType;
  });

  useEffect(() => {
    if (searched && query.trim()) doSearch(query);
  }, [department, fileType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!departments.includes(department)) {
      setDepartment('전체');
    }
  }, [departments, department]);

  return (
    <div className="flex flex-col gap-5 pb-10">
      <SearchHeader
        query={query}
        onActivateFileTab={() => setActiveTab('file')}
        onActivateAiTab={() => setActiveTab('ai')}
        onOpenDocuments={() => router.push(buildDocumentCreateHref({
          instructions: query.trim() ? `"${query.trim()}" 관련 내용을 반영해 문서를 작성해줘.` : null,
        }))}
        onOpenContractRisk={() => router.push(`/contract-risk${query.trim() ? `?source=${encodeURIComponent(query.trim())}` : ''}`)}
        onOpenFiles={() => router.push('/files')}
      />

      <div className="flex flex-col gap-5">
        <SearchTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'file' && (
          <GmailSyncBar
            connected={gmailSync.connected}
            lastSyncedAt={gmailSync.lastSyncedAt}
            syncing={gmailSync.syncing}
            onSync={() => { void gmailSync.runSync(false); }}
          />
        )}

        {activeTab === 'file' && (
          <FileSearchTab
            query={query}
            searched={searched}
            loading={loading}
            departments={departments}
            department={department}
            fileType={fileType}
            sort={sort}
            suggestions={suggestions}
            recentQueries={recentQueries}
            searchContext={searchContext}
            sortedResults={sortedResults}
            relatedResults={relatedResults}
            expandedSummary={expandedSummary}
            onQueryChange={setQuery}
            onSearch={() => void doSearch(query)}
            onDepartmentChange={setDepartment}
            onFileTypeChange={setFileType}
            onSortChange={setSort}
            onSuggestionClick={(value) => { setQuery(value); void doSearch(value); }}
            onVoiceTranscript={(value) => { setQuery(value); void doSearch(value); }}
            onOpenPreview={(fileId) => { void openPreview(fileId); }}
            onOpenResult={openResult}
            onOpenComments={openComments}
            onOpenShare={openShare}
            onToggleSummary={(id) => setExpandedSummary(expandedSummary === id ? null : id)}
            onDownloadOriginal={(result) => { void handleDownloadOriginal(result); }}
            onOpenGmailAttachments={gmail.openAttachments}
            onStartChat={startChatFromResult}
            onOpenDocumentsFromResult={(result) => router.push(buildDocumentCreateHref({
              fileIds: [result.id],
              instructions: `"${result.name}" 문서를 중심으로 문서를 작성해줘.`,
            }))}
            onOpenContractRiskFromResult={(result) => router.push(`/contract-risk?source=${encodeURIComponent(result.name)}`)}
            onOpenFiles={() => router.push('/files')}
            canAnalyzeContract={canAnalyzeContract}
            isElectron={isElectron}
            onCopyLocalPath={(result) => { void copyLocalPath(result); }}
          />
        )}

        {activeTab === 'ai' && (
          <AiSearchTab
            chatMessages={chatMessages}
            chatInput={chatInput}
            chatLoading={chatLoading}
            chatEndRef={chatEndRef}
            onChatInputChange={setChatInput}
            onSendChat={() => { void sendChat(); }}
            onResetChat={() => { setChatMessages([]); setPinnedFileIds(null); }}
          />
        )}
      </div>

      <SearchPreviewModal
        previewData={previewData}
        previewLoading={previewLoading}
        onClose={() => setPreviewData(null)}
      />

      {shareTarget && (
        <ShareLinkModal
          resourceId={shareTarget.id}
          resourceTitle={shareTarget.title}
          resourceType={shareTarget.type}
          onClose={() => setShareTarget(null)}
        />
      )}

      {gmail.emailTarget && (
        <GmailEmailModal
          messageId={gmail.emailTarget.messageId}
          emailName={gmail.emailTarget.name}
          onClose={gmail.closeEmail}
        />
      )}

      {gmail.attachmentTarget && (
        <GmailAttachmentModal
          messageId={gmail.attachmentTarget.messageId}
          emailName={gmail.attachmentTarget.name}
          onClose={gmail.closeAttachments}
        />
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageInner />
    </Suspense>
  );
}
