'use client';

// 주간업무 상세 모달 — 선택한 리포트의 작성자 메타 + 본문을 읽기 전용으로 표시.
// 본문은 문서 뷰어와 동일하게 서버 양식(표 템플릿)으로 렌더하고(useServerRenderedPreview),
// 서버 렌더 불가 시 마크다운 본문으로 폴백한다.

import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui';
import { DocumentMarkdownBody } from '@/components/documents/document-markdown-body';
import { HtmlPreviewFrame } from '@/components/documents/html-preview-frame';
import { useServerRenderedPreview } from '@/components/documents/use-server-rendered-preview';
import type { WeeklyReport } from './types';
import { statusBadgeVariant, statusLabel, formatDateTime } from './helpers';

interface WeeklyReportDetailModalProps {
  report: WeeklyReport | null;
  onClose: () => void;
}

export function WeeklyReportDetailModal({ report, onClose }: WeeklyReportDetailModalProps) {
  // 빌트인 양식(주간업무)은 제목+DOCUMENT_INPUTS로 서버 양식 렌더 대상이 된다(훅 내부 판별).
  const serverPreview = useServerRenderedPreview(
    report
      ? { id: report.id, template: '', templateId: null, title: report.title, content: report.content }
      : null,
    '맑은 고딕',
  );

  return (
    <Modal open={report !== null} onClose={onClose} size="lg" title={report?.title ?? '주간업무'}>
      {report && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3 text-sm text-foreground-secondary">
            <span className="font-medium text-foreground">{report.authorName}</span>
            {report.authorRank && <span className="text-foreground-tertiary">· {report.authorRank}</span>}
            <span className="text-foreground-tertiary">· {report.authorDept}</span>
            <span className="text-foreground-tertiary">· {formatDateTime(report.createdAt)}</span>
            <Badge variant={statusBadgeVariant(report.status)}>{statusLabel(report.status)}</Badge>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {serverPreview.loading ? (
              <div className="flex h-[400px] items-center justify-center"><Spinner /></div>
            ) : !serverPreview.error && serverPreview.html ? (
              <HtmlPreviewFrame
                fit
                title={report.title}
                html={serverPreview.html}
                className="w-full rounded-xl border border-border bg-white"
              />
            ) : report.content.trim() ? (
              <DocumentMarkdownBody content={report.content} />
            ) : (
              <p className="whitespace-pre-wrap text-sm text-foreground-secondary">내용이 없습니다.</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
