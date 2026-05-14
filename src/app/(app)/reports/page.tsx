'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, Search, Sparkles } from 'lucide-react';
import { Spinner } from '@/components/ui';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
}

interface ReportDocument {
  id: string;
  title: string;
  createdAt: string;
  status: string;
  template: string;
}

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [docs, setDocs] = useState<ReportDocument[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [templatesRes, docsRes] = await Promise.all([
          fetch('/api/templates'),
          fetch('/api/documents'),
        ]);

        if (templatesRes.ok) {
          const json = await templatesRes.json();
          const reportTemplates = (json.templates ?? []).filter((template: { name: string }) =>
            /보고서|주간업무보고서|report/i.test(template.name ?? ''),
          );
          setTemplates(reportTemplates.slice(0, 8));
        }

        if (docsRes.ok) {
          const json = await docsRes.json();
          const reportDocs = (json.documents ?? []).filter((doc: { title: string; template: string }) =>
            /보고서|주간업무보고서|report/i.test(`${doc.title ?? ''} ${doc.template ?? ''}`),
          );
          setDocs(reportDocs.slice(0, 8));
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const topTemplate = templates[0] ?? null;

  return (
    <div className="space-y-[25px] pb-10">
      <section className="rounded-[28px] border border-[#e5e5e7] bg-white overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <div className="px-4 py-5 sm:px-6 sm:py-6 xl:px-[30px] xl:py-[30px]">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0071e3]">Report Workflow</p>
            <h1 className="text-[24px] font-bold leading-[1.25] text-[#1d1d1f] sm:text-[28px]">보고서</h1>
            <p className="max-w-2xl text-[15px] text-[#6e6e73]" style={{ lineHeight: '20px' }}>
              보고서는 독립 기능이 아니라 문서 생성 시나리오의 한 종류입니다. 관련 문서를 모으고,
              보고서 템플릿을 선택해 초안을 만들고, 공유와 검토까지 같은 흐름 안에서 이어갑니다.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MetricCard label="보고서 템플릿" value={templates.length} />
              <MetricCard label="최근 보고서" value={docs.length} />
              <MetricCard label="바로 시작 템플릿" value={topTemplate ? 1 : 0} />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push('/documents?create=true&originContext=report_draft&contextTitle=%EB%B3%B4%EA%B3%A0%EC%84%9C')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0071e3] transition-colors"
              >
                <Sparkles size={16} />
                보고서 작성 시작
              </button>
              <button
                onClick={() => router.push(`/search?q=${encodeURIComponent('보고서')}`)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#D7E7FF] bg-white px-4 py-2.5 text-sm font-medium text-[#2E6FF2] hover:bg-[#eef6ff] transition-colors"
              >
                <Search size={16} />
                관련 문서 검색
              </button>
              <Link
                href="/documents"
                className="inline-flex items-center gap-2 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-4 py-2.5 text-sm font-medium text-[#1d1d1f] hover:border-[#0071e3] hover:text-[#0071e3] transition-colors"
              >
                <FileText size={16} />
                문서 생성으로 이동
              </Link>
            </div>
            </div>
          </div>
          <div className="border-t border-[#e5e5e7] bg-[#fbfbfc] px-4 py-5 sm:px-6 sm:py-6 xl:border-l xl:border-t-0 xl:px-[28px] xl:py-[28px]">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7C8494]">Recommended Flow</p>
              <div className="flex flex-col gap-3">
              <QuickAction
                title="1. 관련 자료를 찾습니다"
                description="문서허브와 검색에서 보고에 필요한 계약서, 회의록, 실적 문서를 먼저 모읍니다."
                onClick={() => router.push('/search')}
              />
              <QuickAction
                title="2. 보고서 초안을 작성합니다"
                description={topTemplate ? `"${topTemplate.name}" 템플릿부터 바로 보고서 초안을 만들 수 있습니다.` : '문서 생성 화면에서 템플릿을 선택해 보고서 초안을 만들 수 있습니다.'}
                onClick={() => router.push('/documents?create=true&originContext=report_draft&contextTitle=%EB%B3%B4%EA%B3%A0%EC%84%9C')}
              />
              <QuickAction
                title="3. 공유와 검토로 넘깁니다"
                description="완성된 보고서를 공유하고 코멘트 반영, 후속 보고서 작성으로 이어갑니다."
                onClick={() => router.push('/shared-documents')}
              />
            </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
        <section className="rounded-2xl border border-[#e5e5e7] bg-white p-5">
          <p className="text-[16px] font-semibold text-[#1d1d1f]">보고서 템플릿</p>
          <p className="mt-1 text-[12px] text-[#6e6e73]">문서 생성 화면에서 선택할 수 있는 보고서 계열 템플릿입니다.</p>
          <div className="mt-4 flex flex-col gap-4">
            {templates.length === 0 ? (
              <EmptyCard label="보고서 템플릿이 아직 없습니다." />
            ) : templates.map((template) => (
              <div key={template.id} className="rounded-2xl border border-[#E2E5EA] bg-[#fbfbfc] p-4">
                <p className="text-[14px] font-semibold text-[#1d1d1f]">{template.name}</p>
                <p className="mt-2 text-[12px] leading-5 text-[#6e6e73]">{template.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => router.push(`/documents?create=true&template=${encodeURIComponent(template.id)}&originContext=report_draft&contextTitle=${encodeURIComponent(template.name)}`)}
                    className="rounded-xl bg-[#1d1d1f] px-3 py-2 text-[12px] font-medium text-white hover:bg-[#0071e3] transition-colors"
                  >
                    이 템플릿으로 작성
                  </button>
                  <button
                    onClick={() => router.push(`/search?q=${encodeURIComponent(template.name)}`)}
                    className="rounded-xl border border-[#D7E7FF] px-3 py-2 text-[12px] font-medium text-[#2E6FF2] hover:bg-[#eef6ff] transition-colors"
                  >
                    관련 문서 검색
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e5e5e7] bg-white p-5">
          <p className="text-[16px] font-semibold text-[#1d1d1f]">최근 보고서 문서</p>
          <p className="mt-1 text-[12px] text-[#6e6e73]">이전에 작성한 보고서를 열어 업데이트, 재활용, 공유 흐름으로 이어갑니다.</p>
          <div className="mt-4 flex flex-col gap-4">
            {docs.length === 0 ? (
              <EmptyCard label="최근 보고서 문서가 없습니다." />
            ) : docs.map((doc) => (
              <div key={doc.id} className="rounded-2xl border border-[#E2E5EA] bg-[#fbfbfc] p-4">
                <p className="text-[14px] font-semibold text-[#1d1d1f]">{doc.title}</p>
                <p className="mt-1 text-[12px] text-[#6e6e73]">{doc.template} · {doc.createdAt} · {doc.status}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => router.push(`/documents/${doc.id}`)}
                    className="rounded-xl bg-[#1d1d1f] px-3 py-2 text-[12px] font-medium text-white hover:bg-[#0071e3] transition-colors"
                  >
                    문서 열기
                  </button>
                  <button
                    onClick={() => router.push(`/documents?create=true&originDocumentId=${encodeURIComponent(doc.id)}&originContext=report_update&contextTitle=${encodeURIComponent(doc.title)}&instructions=${encodeURIComponent(`"${doc.title}" 보고서를 바탕으로 업데이트 보고서를 작성해줘.`)}`)}
                    className="rounded-xl border border-[#D7EFDE] px-3 py-2 text-[12px] font-medium text-[#258A4E] hover:bg-[#F4FBF6] transition-colors"
                  >
                    업데이트 보고서 작성
                  </button>
                  <button
                    onClick={() => router.push(`/documents/${doc.id}#document-comment-panel`)}
                    className="rounded-xl border border-[#E6DBFF] px-3 py-2 text-[12px] font-medium text-[#7C3AED] hover:bg-[#FAF5FF] transition-colors"
                  >
                    코멘트 보기
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#E2E5EA] bg-[#f8f8fa] px-4 py-3.5">
      <p className="text-[12px] text-[#6e6e73]">{label}</p>
      <p className="mt-1 text-[20px] font-bold text-[#1d1d1f] font-num">{value}</p>
    </div>
  );
}

function QuickAction({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-[#E2E5EA] bg-white px-4 py-3.5 text-left hover:border-[#0071e3]/35 transition-colors">
      <p className="text-[14px] font-semibold text-[#1d1d1f]">{title}</p>
      <p className="mt-1 text-[12px] leading-5 text-[#6e6e73]">{description}</p>
    </button>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#D7E7FF] bg-[#fbfbfc] px-4 py-10 text-center text-[12px] text-[#6e6e73]">
      {label}
    </div>
  );
}
