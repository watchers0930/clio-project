'use client';

import { useState, useEffect } from 'react';

/* ────────────────────────── types ────────────────────────── */
interface StatCard {
  label: string;
  value: number;
  change: number;
  icon: 'folder' | 'file-text' | 'users' | 'search';
}

interface RecentFile {
  id: string;
  name: string;
  type: string;
  department: string;
  date: string;
  status: '완료' | '처리중' | '오류';
}

interface Activity {
  id: string;
  icon: string;
  description: string;
  timeAgo: string;
}

interface FileTypeBreakdown {
  label: string;
  value: number;
  color: string;
}

interface DeptUsage {
  department: string;
  count: number;
}

/* ────────────────────────── icons (inline svg) ────────────── */
const Icons = {
  folder: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  ),
  'file-text': (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  users: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  search: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  upload: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  ),
  aiSearch: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  ),
  doc: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5" />
    </svg>
  ),
  template: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
};

/* ────────────────────────── mock data ────────────────────── */
const MOCK_STATS: StatCard[] = [
  { label: '전체 파일', value: 1284, change: 12, icon: 'folder' },
  { label: '생성 문서', value: 56, change: 8, icon: 'file-text' },
  { label: '활성 사용자', value: 42, change: 5, icon: 'users' },
  { label: '검색 횟수', value: 328, change: 23, icon: 'search' },
];

const MOCK_FILES: RecentFile[] = [
  { id: '1', name: '2026년 1분기 실적보고서.pdf', type: 'PDF', department: '경영기획팀', date: '2026-03-25', status: '완료' },
  { id: '2', name: '프로젝트 제안서_v3.docx', type: 'DOCX', department: '개발팀', date: '2026-03-25', status: '완료' },
  { id: '3', name: '3월 회의록.md', type: 'MD', department: '인사팀', date: '2026-03-24', status: '처리중' },
  { id: '4', name: '계약서_최종.pdf', type: 'PDF', department: '법무팀', date: '2026-03-24', status: '완료' },
  { id: '5', name: '마케팅 전략 보고서.pptx', type: 'PPTX', department: '마케팅팀', date: '2026-03-23', status: '오류' },
];

const MOCK_ACTIVITIES: Activity[] = [
  { id: '1', icon: '📄', description: '김민수님이 "2026년 1분기 실적보고서"를 업로드했습니다.', timeAgo: '5분 전' },
  { id: '2', icon: '🔍', description: '이지은님이 "계약서 템플릿"을 검색했습니다.', timeAgo: '15분 전' },
  { id: '3', icon: '✏️', description: '박준형님이 "프로젝트 제안서"를 수정했습니다.', timeAgo: '1시간 전' },
  { id: '4', icon: '🤖', description: 'AI가 "3월 회의록" 요약을 생성했습니다.', timeAgo: '2시간 전' },
  { id: '5', icon: '👥', description: '최서연님이 개발팀 채널에 메시지를 보냈습니다.', timeAgo: '3시간 전' },
];

const MOCK_FILE_TYPES: FileTypeBreakdown[] = [
  { label: 'PDF', value: 40, color: '#FF6B6B' },
  { label: 'DOCX', value: 25, color: '#4B8FD4' },
  { label: 'PPTX', value: 15, color: '#FF9F0A' },
  { label: 'XLSX', value: 12, color: '#34C759' },
  { label: '기타', value: 8, color: '#AF52DE' },
];

const MOCK_DEPT_USAGE: DeptUsage[] = [
  { department: '경영기획팀', count: 320 },
  { department: '개발팀', count: 280 },
  { department: '마케팅팀', count: 210 },
  { department: '인사팀', count: 180 },
  { department: '법무팀', count: 150 },
];

/* ────────────────────────── helpers ──────────────────────── */
function formatDate(d: Date) {
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

const statusColor: Record<string, string> = {
  '완료': 'bg-green-100 text-green-700',
  '처리중': 'bg-amber-100 text-amber-700',
  '오류': 'bg-red-100 text-red-700',
};

const typeBadge: Record<string, string> = {
  PDF: 'bg-red-100 text-red-600',
  DOCX: 'bg-blue-100 text-blue-600',
  PPTX: 'bg-orange-100 text-orange-600',
  XLSX: 'bg-green-100 text-green-600',
  MD: 'bg-purple-100 text-purple-600',
};

/* ────────────────────────── page ─────────────────────────── */
export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatCard[]>([]);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [fileTypes, setFileTypes] = useState<FileTypeBreakdown[]>([]);
  const [deptUsage, setDeptUsage] = useState<DeptUsage[]>([]);
  const userName = '관리자';

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats ?? MOCK_STATS);
          setRecentFiles(data.recentFiles ?? MOCK_FILES);
          setActivities(data.activities ?? MOCK_ACTIVITIES);
          setFileTypes(data.fileTypes ?? MOCK_FILE_TYPES);
          setDeptUsage(data.deptUsage ?? MOCK_DEPT_USAGE);
        } else throw new Error();
      } catch {
        setStats(MOCK_STATS);
        setRecentFiles(MOCK_FILES);
        setActivities(MOCK_ACTIVITIES);
        setFileTypes(MOCK_FILE_TYPES);
        setDeptUsage(MOCK_DEPT_USAGE);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <DashboardSkeleton />;

  const maxDept = Math.max(...deptUsage.map((d) => d.count));
  const totalFiles = fileTypes.reduce((a, b) => a + b.value, 0);

  /* conic-gradient for donut */
  let conicStops = '';
  let cum = 0;
  fileTypes.forEach((ft) => {
    const pct = (ft.value / totalFiles) * 100;
    conicStops += `${ft.color} ${cum}% ${cum + pct}%, `;
    cum += pct;
  });
  conicStops = conicStops.slice(0, -2);

  return (
    <div className="space-y-8 pb-10">
      {/* ── greeting ── */}
      <section>
        <h1 className="text-2xl font-bold text-[#0A1628]">안녕하세요, {userName}님</h1>
        <p className="text-[#6B7A8D] mt-1">{formatDate(new Date())}</p>
      </section>

      {/* ── stat cards ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl border border-[#DDE3EC] p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 rounded-xl bg-[#EBF2FA] text-[#4B8FD4] flex items-center justify-center shrink-0">
              {Icons[s.icon]}
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-[#0A1628]">{s.value.toLocaleString()}</p>
              <p className="text-sm text-[#6B7A8D]">{s.label}</p>
              <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                +{s.change}%
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* ── quick actions ── */}
      <section className="flex flex-wrap gap-3">
        {[
          { label: '파일 업로드', icon: Icons.upload, href: '/files' },
          { label: 'AI 검색', icon: Icons.aiSearch, href: '/search' },
          { label: '문서 생성', icon: Icons.doc, href: '/documents' },
          { label: '템플릿 관리', icon: Icons.template, href: '/templates' },
        ].map((a) => (
          <a
            key={a.label}
            href={a.href}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-[#DDE3EC] text-sm font-medium text-[#0A1628] hover:bg-[#4B8FD4] hover:text-white hover:border-[#4B8FD4] transition-colors shadow-sm"
          >
            {a.icon}
            {a.label}
          </a>
        ))}
      </section>

      {/* ── main grid: recent files + activity ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* recent files */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-[#DDE3EC] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#DDE3EC] flex items-center justify-between">
            <h2 className="font-semibold text-[#0A1628]">최근 파일</h2>
            <a href="/files" className="text-sm text-[#4B8FD4] hover:underline">전체 보기</a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAFC] text-left text-[#6B7A8D]">
                  <th className="px-6 py-3 font-medium">파일명</th>
                  <th className="px-4 py-3 font-medium">유형</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">부서</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">날짜</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC]">
                {recentFiles.map((f) => (
                  <tr key={f.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-6 py-3 font-medium text-[#0A1628] max-w-[200px] truncate">{f.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge[f.type] ?? 'bg-gray-100 text-gray-600'}`}>{f.type}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-[#6B7A8D]">{f.department}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-[#6B7A8D]">{f.date}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[f.status]}`}>{f.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* activity timeline */}
        <div className="bg-white rounded-2xl border border-[#DDE3EC] shadow-sm">
          <div className="px-6 py-4 border-b border-[#DDE3EC]">
            <h2 className="font-semibold text-[#0A1628]">최근 활동</h2>
          </div>
          <ul className="divide-y divide-[#DDE3EC]">
            {activities.map((a) => (
              <li key={a.id} className="px-6 py-4 flex gap-3 items-start">
                <span className="text-lg shrink-0">{a.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm text-[#1A2332] leading-snug">{a.description}</p>
                  <p className="text-xs text-[#6B7A8D] mt-1">{a.timeAgo}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* donut chart */}
        <div className="bg-white rounded-2xl border border-[#DDE3EC] shadow-sm p-6">
          <h2 className="font-semibold text-[#0A1628] mb-6">파일 유형 분포</h2>
          <div className="flex items-center justify-center gap-10 flex-wrap">
            <div
              className="w-44 h-44 rounded-full relative"
              style={{
                background: `conic-gradient(${conicStops})`,
              }}
            >
              <div className="absolute inset-0 m-auto w-24 h-24 rounded-full bg-white flex items-center justify-center">
                <div className="text-center">
                  <p className="text-xl font-bold text-[#0A1628]">{totalFiles}</p>
                  <p className="text-xs text-[#6B7A8D]">전체</p>
                </div>
              </div>
            </div>
            <ul className="space-y-2">
              {fileTypes.map((ft) => (
                <li key={ft.label} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ft.color }} />
                  <span className="text-[#1A2332]">{ft.label}</span>
                  <span className="text-[#6B7A8D]">{ft.value}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* bar chart */}
        <div className="bg-white rounded-2xl border border-[#DDE3EC] shadow-sm p-6">
          <h2 className="font-semibold text-[#0A1628] mb-6">부서별 사용량</h2>
          <div className="space-y-4">
            {deptUsage.map((d) => (
              <div key={d.department}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#1A2332]">{d.department}</span>
                  <span className="text-[#6B7A8D]">{d.count}건</span>
                </div>
                <div className="h-3 bg-[#F2F5F9] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#4B8FD4] transition-all duration-700"
                    style={{ width: `${(d.count / maxDept) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── skeleton ── */
function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-64 bg-[#DDE3EC] rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-white rounded-2xl border border-[#DDE3EC]" />
        ))}
      </div>
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 w-32 bg-white rounded-xl border border-[#DDE3EC]" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 h-80 bg-white rounded-2xl border border-[#DDE3EC]" />
        <div className="h-80 bg-white rounded-2xl border border-[#DDE3EC]" />
      </div>
    </div>
  );
}
