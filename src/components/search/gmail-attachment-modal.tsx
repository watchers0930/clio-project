'use client';

import { useEffect, useState } from 'react';
import type { GmailAttachment } from '@/app/api/gmail/attachments/route';

interface Props {
  messageId: string;
  emailName: string;
  onClose: () => void;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GmailAttachmentModal({ messageId, emailName, onClose }: Props) {
  const [attachments, setAttachments] = useState<GmailAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/gmail/attachments?messageId=${encodeURIComponent(messageId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setAttachments(data.attachments ?? []);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : '첨부파일 목록을 불러올 수 없습니다.');
      })
      .finally(() => setLoading(false));
  }, [messageId]);

  const download = async (attachment: GmailAttachment) => {
    setDownloading(attachment.id);
    try {
      const url = `/api/gmail/attachment/${encodeURIComponent(messageId)}?attachmentId=${encodeURIComponent(attachment.id)}&filename=${encodeURIComponent(attachment.filename)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('다운로드 실패');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = attachment.filename;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      alert('첨부파일 다운로드에 실패했습니다.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-8 py-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground">첨부파일 받기</h2>
            <p className="mt-0.5 truncate text-[12px] text-foreground-secondary">{emailName}</p>
          </div>
          <button onClick={onClose} className="ml-3 shrink-0 rounded-lg p-2 text-foreground-secondary hover:bg-surface-secondary">
            <CloseIcon />
          </button>
        </div>

        <div className="px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : error ? (
            <p className="text-center text-sm text-red-500">{error}</p>
          ) : attachments.length === 0 ? (
            <p className="text-center text-sm text-foreground-secondary">이 이메일에 첨부파일이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {attachments.map((att) => (
                <div key={att.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{att.filename}</p>
                    <p className="text-[11px] text-foreground-secondary">{formatBytes(att.size)}</p>
                  </div>
                  <button
                    onClick={() => { void download(att); }}
                    disabled={downloading === att.id}
                    className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                  >
                    {downloading === att.id ? '받는 중...' : '받기'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
}
