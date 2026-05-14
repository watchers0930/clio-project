import { redirect } from 'next/navigation';
import { buildReportDraftHref } from '@/lib/documents/navigation';

export default function ReportsPage() {
  redirect(buildReportDraftHref());
}
