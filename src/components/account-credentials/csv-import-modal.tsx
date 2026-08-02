'use client';

import { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ParsedRow {
  site_name: string;
  site_url: string;
  username: string;
  password: string;
  valid: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

  const nameIdx = header.findIndex((h) => h === 'name' || h === '사이트명');
  const urlIdx = header.findIndex((h) => h === 'url' || h === 'website' || h === 'site_url' || h === '사이트주소');
  const userIdx = header.findIndex((h) => h === 'username' || h === 'user' || h === 'login' || h === '아이디');
  const pwIdx = header.findIndex((h) => h === 'password' || h === 'pw' || h === 'pass' || h === '비밀번호');

  if (userIdx < 0 || pwIdx < 0) return [];

  return lines.slice(1).map((line) => {
    const cols = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) ?? line.split(',');
    const get = (idx: number) => (cols[idx] ?? '').trim().replace(/^"|"$/g, '');

    const site_name = nameIdx >= 0 ? get(nameIdx) : get(urlIdx >= 0 ? urlIdx : 0);
    const site_url = urlIdx >= 0 ? get(urlIdx) : '';
    const username = get(userIdx);
    const password = get(pwIdx);

    return {
      site_name: site_name || site_url || '(이름 없음)',
      site_url,
      username,
      password,
      valid: !!username && !!password,
    };
  }).filter((r) => r.username || r.password);
}

export function CsvImportModal({ open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  if (!open) return null;

  const reset = () => {
    setRows([]);
    setFileName('');
    setError('');
    setDone(false);
    setImportedCount(0);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (file: File) => {
    setError('');
    setDone(false);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        setError('인식할 수 있는 계정 데이터가 없습니다. name, url, username, password 컬럼이 필요합니다.');
        setRows([]);
      } else {
        setRows(parsed);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) handleFile(file);
  };

  const validRows = rows.filter((r) => r.valid);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setError('');
    try {
      const res = await fetch('/api/account-credentials/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: validRows }),
      });
      const json = await res.json() as { success?: boolean; error?: string; data?: { count: number } };
      if (!res.ok) {
        setError(json.error ?? '가져오기에 실패했습니다.');
        return;
      }
      const count = json.data?.count ?? validRows.length;
      setImportedCount(count);
      setDone(true);
      onImported(count);
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-white shadow-xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 flex-shrink-0">
          <h3 className="text-[15px] font-semibold text-foreground">CSV 가져오기</h3>
          <button onClick={handleClose} className="text-foreground-secondary hover:text-foreground">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
          {/* 완료 상태 */}
          {done ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle2 size={48} className="text-green-500" />
              <p className="text-[15px] font-semibold text-foreground">{importedCount}개 계정을 가져왔습니다.</p>
              <button
                onClick={handleClose}
                className="mt-2 h-10 rounded-xl bg-primary px-6 text-[13px] font-medium text-white hover:bg-primary-dark"
              >
                확인
              </button>
            </div>
          ) : (
            <>
              {/* 파일 업로드 영역 */}
              {rows.length === 0 ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary hover:bg-blue-50/30 transition-colors py-12"
                >
                  <Upload size={32} className="text-muted" />
                  <p className="text-[14px] font-medium text-foreground">CSV 파일을 클릭하거나 드래그하여 업로드</p>
                  <p className="text-[12px] text-foreground-quaternary">웨일/크롬 비밀번호 내보내기 파일 지원</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-secondary px-4 py-3">
                  <FileText size={16} className="text-primary flex-shrink-0" />
                  <span className="text-[13px] text-foreground flex-1 truncate">{fileName}</span>
                  <button
                    onClick={() => { reset(); }}
                    className="text-[12px] text-foreground-secondary hover:text-red-500 flex-shrink-0"
                  >
                    다시 선택
                  </button>
                </div>
              )}

              {/* 에러 */}
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <AlertCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[12px] text-red-600">{error}</p>
                </div>
              )}

              {/* 미리보기 */}
              {rows.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-foreground">
                      총 {rows.length}개 중 가져올 수 있는 항목: <span className="text-primary">{validRows.length}개</span>
                    </p>
                    {rows.length !== validRows.length && (
                      <p className="text-[11px] text-foreground-quaternary">{rows.length - validRows.length}개 항목은 아이디/비밀번호 누락으로 제외됩니다</p>
                    )}
                  </div>

                  <div className="overflow-y-auto max-h-64 rounded-xl border border-border">
                    <table className="w-full text-[12px]">
                      <thead className="sticky top-0 bg-surface-secondary">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-foreground-secondary w-[180px]">사이트명</th>
                          <th className="px-3 py-2 text-left font-semibold text-foreground-secondary">사이트 주소</th>
                          <th className="px-3 py-2 text-left font-semibold text-foreground-secondary w-[130px]">아이디</th>
                          <th className="px-3 py-2 text-center font-semibold text-foreground-secondary w-[50px]">상태</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-white">
                        {rows.map((row, i) => (
                          <tr key={i} className={row.valid ? '' : 'opacity-40'}>
                            <td className="px-3 py-2 text-foreground truncate max-w-[180px]">{row.site_name}</td>
                            <td className="px-3 py-2 text-foreground-secondary truncate max-w-[200px]">{row.site_url || '—'}</td>
                            <td className="px-3 py-2 text-foreground-secondary truncate">{row.username || '—'}</td>
                            <td className="px-3 py-2 text-center">
                              {row.valid
                                ? <span className="text-green-500">✓</span>
                                : <span className="text-red-400">✗</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!done && rows.length > 0 && (
          <div className="flex justify-end gap-2 border-t border-border px-6 py-4 flex-shrink-0">
            <button
              onClick={handleClose}
              className="h-9 rounded-xl border border-border px-4 text-[13px] font-medium text-foreground-secondary hover:bg-surface-secondary"
            >
              취소
            </button>
            <button
              onClick={() => { void handleImport(); }}
              disabled={importing || validRows.length === 0}
              className="h-9 rounded-xl bg-primary px-5 text-[13px] font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {importing ? '가져오는 중...' : `${validRows.length}개 가져오기`}
            </button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
