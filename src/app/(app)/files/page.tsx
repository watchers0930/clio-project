'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

/* ────────────────────────── types ────────────────────────── */
interface FileItem {
  id: string;
  name: string;
  type: string;
  department: string;
  size: string;
  sizeBytes?: number;
  uploadDate: string;
  status: '완료' | '처리중' | '오류';
}

/* ────────────────────────── constants ────────────────────── */
const TYPES = ['전체', 'PDF', 'DOCX', 'PPTX', 'XLSX', 'MD'];
const STATUSES = ['전체', '완료', '처리중', '오류'];

const statusColor: Record<string, string> = {
  '완료': 'bg-[#f5f5f7] text-[#30d158]',
  '처리중': 'bg-[#f5f5f7] text-[#ff9f0a]',
  '오류': 'bg-[#f5f5f7] text-[#ff3b30]',
};

const typeIconColor: Record<string, string> = {
  PDF: 'text-[#1d1d1f]',
  DOCX: 'text-[#1d1d1f]',
  PPTX: 'text-[#1d1d1f]',
  XLSX: 'text-[#1d1d1f]',
  MD: 'text-[#1d1d1f]',
};

const typeBadge: Record<string, string> = {
  PDF: 'bg-[#f5f5f7] text-[#1d1d1f]',
  DOCX: 'bg-[#f5f5f7] text-[#1d1d1f]',
  PPTX: 'bg-[#f5f5f7] text-[#1d1d1f]',
  XLSX: 'bg-[#f5f5f7] text-[#1d1d1f]',
  MD: 'bg-[#f5f5f7] text-[#1d1d1f]',
};

const PAGE_SIZE = 6;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileType(name: string): string {
  const ext = name.split('.').pop()?.toUpperCase() ?? '';
  if (['PDF', 'DOCX', 'PPTX', 'XLSX', 'MD'].includes(ext)) return ext;
  return ext || 'FILE';
}

/* ────────────────────────── page ─────────────────────────── */
export default function FilesPageWrapper() {
  return (
    <Suspense fallback={
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-[#e5e5e7] rounded-lg" />
        <div className="h-12 bg-white rounded-2xl border border-[#e5e5e7]" />
        <div className="h-96 bg-white rounded-2xl border border-[#e5e5e7]" />
      </div>
    }>
      <FilesPage />
    </Suspense>
  );
}

function FilesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [files, setFiles] = useState<FileItem[]>([]);
  const [departments, setDepartments] = useState<string[]>(['전체']);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('전체');
  const [typeFilter, setTypeFilter] = useState('전체');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [page, setPage] = useState(1);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detailFile, setDetailFile] = useState<FileItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<FileItem | null>(null);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* auto-open upload modal from query param */
  useEffect(() => {
    if (searchParams.get('upload') === 'true') {
      setShowUpload(true);
    }
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      try {
        const [filesRes, deptsRes] = await Promise.all([
          fetch('/api/files'),
          fetch('/api/departments'),
        ]);
        if (filesRes.ok) {
          const data = await filesRes.json();
          setFiles(data.files ?? []);
        }
        if (deptsRes.ok) {
          const data = await deptsRes.json();
          const deptNames = (data.data ?? [])
            .filter((d: { is_active: boolean }) => d.is_active !== false)
            .map((d: { name: string }) => d.name);
          setDepartments(['전체', ...deptNames]);
        }
      } catch {
        setFiles([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* filter */
  const filtered = files.filter((f) => {
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (deptFilter !== '전체' && f.department !== deptFilter) return false;
    if (typeFilter !== '전체' && f.type !== typeFilter) return false;
    if (statusFilter !== '전체' && f.status !== statusFilter) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === paged.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paged.map((f) => f.id)));
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const simulateUpload = async () => {
    if (!selectedFile) return;
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      setUploadProgress(40);

      const res = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(80);

      if (!res.ok) {
        throw new Error('업로드 실패');
      }

      setUploadProgress(100);

      // 파일 목록 갱신
      const listRes = await fetch('/api/files');
      if (listRes.ok) {
        const data = await listRes.json();
        setFiles(data.files ?? []);
      }

      setTimeout(() => {
        setUploadProgress(null);
        setShowUpload(false);
        setSelectedFile(null);
        setPage(1);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 600);
    } catch {
      setUploadProgress(null);
      alert('파일 업로드에 실패했습니다.');
    }
  };

  const handleDelete = (file: FileItem) => {
    setDeleteConfirm(file);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await fetch(`/api/files/${deleteConfirm.id}`, { method: 'DELETE' });
      setFiles((prev) => prev.filter((f) => f.id !== deleteConfirm.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteConfirm.id);
        return next;
      });
    } catch { /* ignore */ }
    setDeleteConfirm(null);
  };

  const bulkDelete = () => {
    if (selectedIds.size === 0) return;
    setFiles((prev) => prev.filter((f) => !selectedIds.has(f.id)));
    setSelectedIds(new Set());
  };

  const handleDownload = (file: FileItem) => {
    setDownloadToast(file.name);
    setTimeout(() => setDownloadToast(null), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-[#e5e5e7] rounded-lg" />
        <div className="h-12 bg-white rounded-2xl border border-[#e5e5e7]" />
        <div className="h-96 bg-white rounded-2xl border border-[#e5e5e7]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ marginBottom: 15 }}>
        <h1 className="text-2xl font-bold text-[#1d1d1f]">파일 관리</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors shadow-sm w-full sm:w-auto"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          파일 업로드
        </button>
      </div>

      {/* bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#f5f5f7] border border-[#0071e3]/30 rounded-xl">
          <span className="text-sm font-medium text-[#1d1d1f]">
            <span className="font-num">{selectedIds.size}</span>개 선택됨
          </span>
          <button
            onClick={bulkDelete}
            className="ml-auto px-5 py-2 rounded-lg bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors"
          >
            선택 삭제
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-5 py-2 rounded-lg border border-[#e5e5e7] bg-white text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors"
          >
            선택 해제
          </button>
        </div>
      )}

      {/* filter bar */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e6e73]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="파일 검색..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#e5e5e7] bg-white text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
          />
        </div>
        <select value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }} className="px-4 py-3 rounded-xl border border-[#e5e5e7] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3]">
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="px-4 py-3 rounded-xl border border-[#e5e5e7] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3]">
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-4 py-3 rounded-xl border border-[#e5e5e7] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3]">
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>

        {/* view toggle */}
        <div className="flex rounded-xl border border-[#e5e5e7] overflow-hidden ml-auto">
          <button onClick={() => setView('list')} className={`px-3.5 py-2.5 text-sm ${view === 'list' ? 'bg-[#1d1d1f] text-white' : 'bg-white text-[#6e6e73] hover:bg-[#f5f5f7]'} transition-colors`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
          </button>
          <button onClick={() => setView('grid')} className={`px-3.5 py-2.5 text-sm ${view === 'grid' ? 'bg-[#1d1d1f] text-white' : 'bg-white text-[#6e6e73] hover:bg-[#f5f5f7]'} transition-colors`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
          </button>
        </div>
      </div>

      {/* result count */}
      <p className="text-sm text-[#6e6e73]" style={{ marginTop: 12 }}>총 <span className="font-num font-medium text-[#1d1d1f]">{filtered.length}</span>개 파일</p>

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div className="bg-white rounded-2xl border border-[#e5e5e7] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f5f5f7] text-left text-[#6e6e73]">
                  <th className="px-4 py-4 w-10">
                    <input type="checkbox" checked={selectedIds.size === paged.length && paged.length > 0} onChange={toggleAll} className="rounded border-[#e5e5e7] text-[#0071e3] focus:ring-[#0071e3]" />
                  </th>
                  <th className="px-4 py-4 font-medium">파일명</th>
                  <th className="px-4 py-4 font-medium hidden sm:table-cell">부서</th>
                  <th className="px-4 py-4 font-medium hidden md:table-cell">크기</th>
                  <th className="px-4 py-4 font-medium hidden md:table-cell">업로드일</th>
                  <th className="px-4 py-4 font-medium">상태</th>
                  <th className="px-4 py-4 font-medium w-28">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e5e7]">
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-[#6e6e73]">검색 결과가 없습니다.</td>
                  </tr>
                )}
                {paged.map((f) => (
                  <tr key={f.id} className="hover:bg-[#f5f5f7] transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(f.id)} onChange={() => toggleSelect(f.id)} className="rounded border-[#e5e5e7] text-[#0071e3] focus:ring-[#0071e3]" />
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setDetailFile(f)} className="flex items-center gap-2 text-left group">
                        <svg className={`w-5 h-5 shrink-0 ${typeIconColor[f.type] ?? 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span className="font-medium text-[#1d1d1f] truncate max-w-[200px] group-hover:text-[#0071e3] transition-colors">{f.name}</span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${typeBadge[f.type] ?? 'bg-gray-100 text-gray-600'}`}>{f.type}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-[#6e6e73]">{f.department}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-[#6e6e73]">{f.size}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-[#6e6e73]">{f.uploadDate}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[f.status]}`}>{f.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setDetailFile(f)} title="보기" className="p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] hover:text-[#0071e3] transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </button>
                        <button onClick={() => handleDownload(f)} title="다운로드" className="p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] hover:text-[#0071e3] transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                        </button>
                        <button onClick={() => handleDelete(f)} title="삭제" className="p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] hover:text-[#ff3b30] transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paged.length === 0 && (
            <div className="col-span-full text-center py-12 text-[#6e6e73]">검색 결과가 없습니다.</div>
          )}
          {paged.map((f) => (
            <div key={f.id} className="bg-white rounded-2xl border border-[#e5e5e7] p-5 shadow-sm hover:shadow-md transition-shadow group relative">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl bg-[#f5f5f7] flex items-center justify-center ${typeIconColor[f.type] ?? 'text-gray-400'}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[f.status]}`}>{f.status}</span>
                {/* grid actions */}
                <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setDetailFile(f)} title="보기" className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] hover:text-[#0071e3]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button>
                  <button onClick={() => handleDownload(f)} title="다운로드" className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] hover:text-[#0071e3]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  </button>
                  <button onClick={() => handleDelete(f)} title="삭제" className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] hover:text-[#ff3b30]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  </button>
                </div>
              </div>
              <button onClick={() => setDetailFile(f)} className="text-left w-full">
                <h3 className="font-medium text-[#1d1d1f] truncate mb-1 hover:text-[#0071e3] transition-colors">{f.name}</h3>
              </button>
              <div className="flex items-center gap-2 text-xs text-[#6e6e73]">
                <span>{f.size}</span>
                <span>·</span>
                <span>{f.uploadDate}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge[f.type] ?? 'bg-gray-100 text-gray-600'}`}>{f.type}</span>
                <span className="text-xs text-[#6e6e73]">{f.department}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="px-3 py-1.5 rounded-lg border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">이전</button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`w-8 h-8 rounded-lg text-sm font-medium font-num transition-colors ${safePage === i + 1 ? 'bg-[#1d1d1f] text-white' : 'text-[#6e6e73] hover:bg-[#f5f5f7]'}`}
            >
              {i + 1}
            </button>
          ))}
          <button disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} className="px-3 py-1.5 rounded-lg border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">다음</button>
        </div>
      )}

      {/* ── Upload Modal ── */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) { setShowUpload(false); setUploadProgress(null); setSelectedFile(null); } }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#1d1d1f]">파일 업로드</h2>
              <button onClick={() => { setShowUpload(false); setUploadProgress(null); setSelectedFile(null); }} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.pptx,.xlsx,.md,.txt,.csv"
              className="hidden"
              onChange={handleFileInputChange}
            />

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors ${dragOver ? 'border-[#0071e3] bg-[#f5f5f7]' : 'border-[#e5e5e7] bg-[#f5f5f7]'}`}
            >
              <svg className="w-12 h-12 mx-auto text-[#6e6e73] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
              <p className="text-[#1d1d1f] font-medium mb-1">파일을 여기에 끌어다 놓으세요</p>
              <p className="text-sm text-[#6e6e73] mb-4">또는</p>
              <button onClick={handleFilePicker} className="px-5 py-2 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors">
                파일 선택
              </button>
              <p className="text-xs text-[#6e6e73] mt-3">PDF, DOCX, PPTX, XLSX, MD (최대 50MB)</p>
            </div>

            {/* selected file info */}
            {selectedFile && uploadProgress === null && (
              <div className="mt-4 p-4 bg-[#f5f5f7] rounded-xl border border-[#e5e5e7]">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-white border border-[#e5e5e7] flex items-center justify-center ${typeIconColor[getFileType(selectedFile.name)] ?? 'text-gray-400'}`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1d1d1f] truncate">{selectedFile.name}</p>
                    <p className="text-xs text-[#6e6e73]">
                      {formatFileSize(selectedFile.size)} · {getFileType(selectedFile.name)}
                    </p>
                  </div>
                  <button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="p-1 rounded-lg hover:bg-white text-[#6e6e73]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <button
                  onClick={simulateUpload}
                  className="mt-3 w-full py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors"
                >
                  업로드
                </button>
              </div>
            )}

            {uploadProgress !== null && (
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#1d1d1f]">{uploadProgress >= 100 ? '업로드 완료!' : '업로드 중...'}</span>
                  <span className="text-[#0071e3] font-medium font-num">{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-[#f5f5f7] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${uploadProgress >= 100 ? 'bg-[#30d158]' : 'bg-[#0071e3]'}`} style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detailFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setDetailFile(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#1d1d1f]">파일 상세</h2>
              <button onClick={() => setDetailFile(null)} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-14 h-14 rounded-2xl bg-[#f5f5f7] flex items-center justify-center ${typeIconColor[detailFile.type] ?? 'text-gray-400'}`}>
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-[#1d1d1f] truncate">{detailFile.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge[detailFile.type] ?? 'bg-gray-100 text-gray-600'}`}>{detailFile.type}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[detailFile.status]}`}>{detailFile.status}</span>
                </div>
              </div>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-[#6e6e73]">부서</dt><dd className="text-[#1d1d1f] font-medium">{detailFile.department}</dd></div>
              <div className="flex justify-between"><dt className="text-[#6e6e73]">크기</dt><dd className="text-[#1d1d1f] font-medium">{detailFile.size}</dd></div>
              <div className="flex justify-between"><dt className="text-[#6e6e73]">업로드일</dt><dd className="text-[#1d1d1f] font-medium">{detailFile.uploadDate}</dd></div>
              <div className="flex justify-between"><dt className="text-[#6e6e73]">상태</dt><dd className="text-[#1d1d1f] font-medium">{detailFile.status}</dd></div>
            </dl>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { handleDownload(detailFile); setDetailFile(null); }} className="flex-1 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors">
                다운로드
              </button>
              <button onClick={() => setDetailFile(null)} className="flex-1 py-2.5 rounded-xl border border-[#e5e5e7] text-sm font-medium text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-[#f5f5f7] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#ff3b30]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#1d1d1f] mb-2">파일 삭제</h3>
            <p className="text-sm text-[#6e6e73] mb-6">
              &quot;{deleteConfirm.name}&quot;을(를) 삭제하시겠습니까?<br />이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-[#e5e5e7] text-sm font-medium text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors">
                취소
              </button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors">
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Download Toast ── */}
      {downloadToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 bg-[#1d1d1f] text-white rounded-xl shadow-lg animate-[slideUp_0.3s_ease-out]">
          <svg className="w-5 h-5 text-[#30d158] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm">&quot;{downloadToast}&quot; 다운로드를 시작합니다.</span>
        </div>
      )}
    </div>
  );
}
