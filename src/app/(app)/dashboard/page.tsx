'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FolderOpen, FileText, Users, Search,
  Upload, Sparkles, FilePlus, LayoutTemplate,
  ArrowUpRight, Clock
} from 'lucide-react';

interface UserInfo {
  name: string;
  department: string;
}

const stats = [
  { label: '전체 파일', value: '1,284', change: '+12%', icon: FolderOpen },
  { label: '생성 문서', value: '56', change: '+8%', icon: FileText },
  { label: '활성 사용자', value: '42', change: '+5%', icon: Users },
  { label: '검색 횟수', value: '328', change: '+23%', icon: Search },
];

const quickActions = [
  { label: '파일 업로드', href: '/files', icon: Upload },
  { label: 'AI 검색', href: '/search', icon: Sparkles },
  { label: '문서 생성', href: '/documents', icon: FilePlus },
  { label: '템플릿 관리', href: '/templates', icon: LayoutTemplate },
];

const recentFiles = [
  { id: 1, name: '2026년 1분기 실적보고서.pdf', type: 'PDF', dept: '경영기획팀', date: '2026-03-25', status: '완료' },
  { id: 2, name: '프로젝트 제안서_v3.docx', type: 'DOCX', dept: '개발팀', date: '2026-03-25', status: '완료' },
  { id: 3, name: '3월 회의록.md', type: 'MD', dept: '인사팀', date: '2026-03-24', status: '처리중' },
  { id: 4, name: '계약서_최종.pdf', type: 'PDF', dept: '법무팀', date: '2026-03-24', status: '완료' },
  { id: 5, name: '마케팅 전략 보고서.pptx', type: 'PPTX', dept: '마케팅팀', date: '2026-03-23', status: '오류' },
];

const activities = [
  { text: '김민수님이 "2026년 1분기 실적보고서"를 업로드했습니다.', time: '5분 전' },
  { text: '이지은님이 "계약서 템플릿"을 검색했습니다.', time: '15분 전' },
  { text: '박준형님이 "프로젝트 제안서"를 수정했습니다.', time: '1시간 전' },
  { text: 'AI가 "3월 회의록" 요약을 생성했습니다.', time: '2시간 전' },
];

const typeColors: Record<string, string> = {
  PDF: 'bg-[#f5f5f7] text-[#1d1d1f]',
  DOCX: 'bg-[#f5f5f7] text-[#1d1d1f]',
  XLSX: 'bg-[#f5f5f7] text-[#1d1d1f]',
  PPTX: 'bg-[#f5f5f7] text-[#1d1d1f]',
  MD: 'bg-[#f5f5f7] text-[#1d1d1f]',
};

const statusColors: Record<string, string> = {
  '완료': 'text-[#30d158]',
  '처리중': 'text-[#ff9f0a]',
  '오류': 'text-[#ff3b30]',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return '좋은 아침이에요';
  if (h < 18) return '좋은 오후에요';
  return '좋은 저녁이에요';
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('clio_user');
      if (stored) setUser(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Greeting */}
      <div style={{ paddingBottom: 12, borderBottom: '1px solid #e5e5e7' }}>
        <h1 className="text-[24px] font-bold text-foreground">
          {getGreeting()}, <span className="text-primary">{user?.name || '관리자'}님</span>
        </h1>
        <p className="text-[14px] text-muted" style={{ marginTop: 8 }}>
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 20 }}>
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card rounded-2xl border border-border card-hover" style={{ padding: 30 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#f5f5f7] text-[#1d1d1f]">
                  <Icon size={20} strokeWidth={1.5} />
                </div>
                <span className="text-[12px] font-semibold text-[#6e6e73] font-num">{s.change}</span>
              </div>
              <p className="text-[28px] font-bold text-foreground font-num leading-none">{s.value}</p>
              <p className="text-[13px] text-muted mt-2">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 12 }}>
        {quickActions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.label}
              href={a.href}
              className="flex items-center justify-center gap-3 rounded-xl bg-card border border-border text-[14px] font-medium text-foreground hover:border-primary hover:text-primary transition-all duration-200"
              style={{ padding: '14px 20px' }}
            >
              <Icon size={17} strokeWidth={1.5} />
              {a.label}
            </Link>
          );
        })}
      </div>

      {/* Recent Files */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between" style={{ padding: '20px 24px', borderBottom: '1px solid #e5e5e7' }}>
          <h2 className="text-[16px] font-semibold text-foreground">최근 파일</h2>
          <Link href="/files" className="text-[13px] font-medium text-primary hover:text-primary-dark flex items-center gap-1 transition-colors">
            전체 보기 <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-page-bg">
                <th className="text-left px-6 py-3.5 text-[12px] font-semibold text-muted uppercase tracking-wider">파일명</th>
                <th className="text-left px-6 py-3.5 text-[12px] font-semibold text-muted uppercase tracking-wider">유형</th>
                <th className="text-left px-6 py-3.5 text-[12px] font-semibold text-muted uppercase tracking-wider">부서</th>
                <th className="text-left px-6 py-3.5 text-[12px] font-semibold text-muted uppercase tracking-wider">날짜</th>
                <th className="text-left px-6 py-3.5 text-[12px] font-semibold text-muted uppercase tracking-wider">상태</th>
              </tr>
            </thead>
            <tbody>
              {recentFiles.map((f) => (
                <tr key={f.id} className="hover:bg-page-bg/50 transition-colors border-b border-border last:border-b-0">
                  <td className="px-6 py-4 text-[14px] font-medium text-foreground">{f.name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-bold ${typeColors[f.type] || 'bg-gray-100 text-gray-600'}`}>
                      {f.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[14px] text-muted">{f.dept}</td>
                  <td className="px-6 py-4 text-[13px] text-muted font-num">{f.date}</td>
                  <td className={`px-6 py-4 text-[13px] font-semibold ${statusColors[f.status] || ''}`}>{f.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Grid — 3:2 ratio */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>
        {/* Activity */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e5e7' }}>
            <h2 className="text-[16px] font-semibold text-foreground">최근 활동</h2>
          </div>
          <div style={{ padding: '8px 0' }}>
            {activities.map((a, i) => (
              <div key={i} className="flex items-center" style={{ gap: 14, padding: '10px 24px' }}>
                <div className="w-8 h-8 rounded-full bg-page-bg flex items-center justify-center flex-shrink-0">
                  <Clock size={14} strokeWidth={1.5} className="text-muted" />
                </div>
                <p className="flex-1 text-[13px] text-foreground" style={{ whiteSpace: 'nowrap' }}>{a.text}</p>
                <span className="text-[12px] text-muted font-num flex-shrink-0" style={{ marginLeft: 16 }}>{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* File Type Distribution */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e5e7' }}>
            <h2 className="text-[16px] font-semibold text-foreground">파일 유형 분포</h2>
          </div>
          <div className="flex items-center justify-center" style={{ gap: 24, padding: '24px' }}>
            <div className="relative flex-shrink-0" style={{ width: 150, height: 150 }}>
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e5e7" strokeWidth="20" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#1d1d1f" strokeWidth="20" strokeDasharray="100.5 151" strokeDashoffset="0" strokeLinecap="round" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#6e6e73" strokeWidth="20" strokeDasharray="62.8 188.5" strokeDashoffset="-100.5" strokeLinecap="round" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#0071e3" strokeWidth="20" strokeDasharray="37.7 213.6" strokeDashoffset="-163.3" strokeLinecap="round" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e5e7" strokeWidth="20" strokeDasharray="30.2 221.1" strokeDashoffset="-201" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[18px] font-bold text-foreground font-num">100</span>
                <span className="text-[10px] text-muted">전체</span>
              </div>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'PDF', pct: '40%', color: 'bg-[#1d1d1f]' },
                { label: 'DOCX', pct: '25%', color: 'bg-[#6e6e73]' },
                { label: 'PPTX', pct: '15%', color: 'bg-[#0071e3]' },
                { label: 'XLSX', pct: '12%', color: 'bg-[#e5e5e7]' },
                { label: '기타', pct: '8%', color: 'bg-[#f5f5f7]' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className="text-[12px] text-foreground w-12 font-medium">{item.label}</span>
                  <span className="text-[12px] text-muted font-num">{item.pct}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
