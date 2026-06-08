import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { generateContractRiskReport } from '@/lib/ai/contract-risk-report';
import { generateContractRiskPdfHtml } from '@/lib/ai/contract-risk-report-pdf';
import type { ContractRiskAnalysis } from '@/lib/types/contract-risk';

export const maxDuration = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: '유효하지 않은 ID입니다.' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
  }

  const userId = await getAuthUserId(supabase);
  if (!userId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('contract_risk_analyses')
    .select('*')
    .eq('id', id)
    .single() as { data: ContractRiskAnalysis | null; error: unknown };

  if (error || !data) {
    return NextResponse.json({ error: 'NOT_FOUND', message: '분석 결과를 찾을 수 없습니다.' }, { status: 404 });
  }

  if (data.user_id !== userId) {
    return NextResponse.json({ error: 'NOT_FOUND', message: '분석 결과를 찾을 수 없습니다.' }, { status: 404 });
  }

  if (data.status !== 'done') {
    return NextResponse.json({ error: '분석이 완료되지 않았습니다.' }, { status: 422 });
  }

  const format = request.nextUrl.searchParams.get('format') ?? 'docx';

  if (format === 'pdf') {
    try {
      const html = generateContractRiskPdfHtml(data);
      const baseName = data.file_name.replace(/\.[^.]+$/, '');
      const safeFileName = encodeURIComponent(`리스크분석-${baseName}.html`);

      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename*=UTF-8''${safeFileName}`,
        },
      });
    } catch (err) {
      console.error('[contract-risk/download] PDF report generation error:', err);
      return NextResponse.json({ error: '리포트 생성 중 오류가 발생했습니다.' }, { status: 500 });
    }
  }

  // DOCX format (default)
  let buffer: Buffer;
  try {
    buffer = await generateContractRiskReport(data);
  } catch (err) {
    console.error('[contract-risk/download] report generation error:', err);
    return NextResponse.json({ error: '리포트 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }

  const safeFileName = encodeURIComponent(`리스크분석-${data.file_name.replace(/\.[^.]+$/, '')}.docx`);

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename*=UTF-8''${safeFileName}`,
    },
  });
}
