'use client';

// 주간업무 상세 모달 — 선택한 리포트의 작성자 메타 + 본문(마크다운)을 읽기 전용으로 표시.
// 본문 렌더는 기존 문서 뷰어와 동일하게 DocumentMarkdownBody를 재사용한다.

import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { DocumentMarkdownBody } from '@/components/documents/document-markdown-body';
import type { WeeklyReport } from './types';
import { statusBadgeVariant, statusLabel, formatDateTime } from './helpers';

interface WeeklyReportDetailModalProps {
  report: WeeklyReport | null;
  onClose: () => void;
}

export function WeeklyReportDetailModal({ report, onClose }: WeeklyReportDetailModalProps) {
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
          <div className="max-h-[60vh] overflow-y-auto">
            {report.content.trim() ? (
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
