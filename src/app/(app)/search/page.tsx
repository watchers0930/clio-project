'use client';

import { Suspense, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { isContractTemplate } from '@/lib/contract-fields';
import { buildDocumentCreateHref } from '@/lib/documents/navigation';
import {
  AiSearchTab,
  FileSearchTab,
  SearchHeader,
  SearchPreviewModal,
  SearchTabs,
} from '@/components/search/search-sections';
import { ShareLinkModal } from '@/components/documents/ShareLinkModal';
import type { ChatMessage, SearchResult, SearchTab } from '@/components/search/types';

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
  const [previewData, setPreviewData] = useState<{ name: string; text: string; truncated?: boolean; totalLength?: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ id: string; title: string; type: 'document' | 'file' } | null>(null);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [searchContext, setSearchContext] = useState<{
    role: string;
    departmentName: string;
    documentScopeLabel: string;
    departmentFilterLabel: string;
    availableDepartments: string[];
  } | null>(null);

  // AI 채팅 상태
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [pinnedFileIds, setPinnedFileIds] = useState<string[] | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 부서 목록 + 검색 제안어
  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(json => {
      const names = (json.templates ?? []).map((t: { name: string }) => t.name);
      setSuggestions(names.length > 0 ? names : ['회의록', '보고서', '계약서', '제안서', '공문']);
    }).catch(() => {
      setSuggestions(['회의록', '보고서', '계약서', '제안서', '공문']);
    });
  }, []);

  const openPreview = async (fileId: string) => {
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await fetch(`/api/files/${fileId}/preview`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setPreviewData({ name: '오류', text: err?.error || '미리보기를 불러올 수 없습니다.' });
        return;
      }
      const data = await res.json();
      setPreviewData(data);
    } catch {
      setPreviewData({ name: '오류', text: '네트워크 오류가 발생했습니다.' });
    } finally {
      setPreviewLoading(false);
    }
  };

  // AI 채팅 전송
  const sendChat = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: msg };
    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    setChatInput('');
    setChatLoading(true);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: chatMessages,
          fileIds: pinnedFileIds ?? (results.length > 0 ? results.map((r) => r.id) : undefined),
        }),
      });
      const data = await res.json();
      setChatMessages([...nextHistory, {
        role: 'assistant',
        content: data.answer ?? data.error ?? '오류가 발생했습니다.',
      }]);
    } catch {
      setChatMessages([...nextHistory, { role: 'assistant', content: '네트워크 오류가 발생했습니다.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [chatInput, chatMessages, chatLoading, results]);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      setLoading(true);
      setSearched(true);
      setExpandedSummary(null);
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, department, fileType }),
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
          setRecentQueries(data.recentQueries ?? []);
          setSearchContext(data.searchContext ?? null);
          setDepartments(data.searchContext?.availableDepartments ?? ['전체']);
        } else {
          setResults([]);
          setRecentQueries([]);
          setSearchContext(null);
          setDepartments(['전체']);
        }
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

  useEffect(() => {
    const q = searchParams.get('q')?.trim();
    const ask = searchParams.get('ask')?.trim();
    const requestedTab = searchParams.get('tab');

    if (requestedTab === 'ai') setActiveTab('ai');
    if (q) {
      setQuery(q);
      void doSearch(q);
    }
    if (ask) {
      setActiveTab('ai');
      setChatInput(ask);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  const startChatFromResult = (result: SearchResult) => {
    setActiveTab('ai');
    setPinnedFileIds([result.id]);
    setChatInput(`"${result.name}" 문서를 기준으로 핵심 내용을 설명해줘.`);
    toast.success('AI 질의응답 탭으로 이동했습니다.');
  };

  const canAnalyzeContract = (result: SearchResult) => {
    const upperType = (result.fileType ?? '').toUpperCase();
    return isContractTemplate(result.name) || ['DOCX', 'HWPX', 'HWP', 'PDF'].includes(upperType);
  };

  const handleDownloadOriginal = async (result: SearchResult) => {
    try {
      const res = await fetch(`/api/files/${result.id}/download`);
      if (!res.ok) {
        toast.error('다운로드 실패');
        return;
      }
      const data = await res.json();
      if (data.url) {
        const dlRes = await fetch(data.url);
        const blob = await dlRes.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      toast.error('다운로드 실패');
    }
  };

  const openResult = (result: SearchResult) => {
    if (result.sourceType === 'document') {
      router.push(`/documents/${result.id}`);
      return;
    }
    void openPreview(result.id);
  };

  const openComments = (result: SearchResult) => {
    if (result.sourceType === 'document') {
      router.push(`/documents/${result.id}#document-comment-panel`);
      return;
    }
    startChatFromResult(result);
  };

  const openShare = (result: SearchResult) => {
    setShareTarget({
      id: result.id,
      title: result.name,
      type: result.sourceType === 'document' ? 'document' : 'file',
    });
  };

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
            onStartChat={startChatFromResult}
            onOpenDocumentsFromResult={(result) => router.push(buildDocumentCreateHref({
              fileIds: [result.id],
              instructions: `"${result.name}" 문서를 중심으로 문서를 작성해줘.`,
            }))}
            onOpenContractRiskFromResult={(result) => router.push(`/contract-risk?source=${encodeURIComponent(result.name)}`)}
            onOpenFiles={() => router.push('/files')}
            canAnalyzeContract={canAnalyzeContract}
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
