import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { extractTextFromAnalysis } from '@/lib/contract-suggest/clause-extractor';
import { replaceClausesInDocx, replaceClausesInHwpx } from '@/lib/contract-suggest/clause-replacer';
import type { ContractRiskAnalysis, RiskItem } from '@/lib/types/contract-risk';
import type { ApplyRequest } from '@/lib/types/contract-suggest';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORAGE_BUCKET = 'files';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'INVALID_REQUEST', message: '유효하지 않은 ID입니다.' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'SERVICE_UNAVAILABLE', message: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
  }

  const userId = await getAuthUserId(supabase);
  if (!userId) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' }, { status: 401 });
  }

  let body: ApplyRequest;
  try {
    body = await request.json() as ApplyRequest;
  } catch {
    return NextResponse.json({ error: 'INVALID_REQUEST', message: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  if (!body.suggestions || body.suggestions.length === 0) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: '적용할 수정 조항이 없습니다.' },
      { status: 400 },
    );
  }

  const outputFormat = body.outputFormat ?? 'docx';

  const admin = createAdminSupabaseClient();

  // 분석 레코드 조회 + user_id 확인
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: analysis, error: analysisError } = await (admin as any)
    .from('contract_risk_analyses')
    .select('id, user_id, file_name, file_type, raw_text, risk_result')
    .eq('id', id)
    .single() as { data: ContractRiskAnalysis | null; error: unknown };

  if (analysisError || !analysis) {
    return NextResponse.json({ error: 'NOT_FOUND', message: '분석 결과를 찾을 수 없습니다.' }, { status: 404 });
  }

  if (analysis.user_id !== userId) {
    return NextResponse.json({ error: 'NOT_FOUND', message: '분석 결과를 찾을 수 없습니다.' }, { status: 404 });
  }

  // 원본 파일 다운로드 (analyze 라우트에서 contract-risk/{userId}/{fileName}으로 업로드됨)
  const storagePath = `contract-risk/${userId}/${analysis.file_name}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fileData, error: storageError } = await (admin as any)
    .storage
    .from(STORAGE_BUCKET)
    .download(storagePath) as { data: Blob | null; error: unknown };

  if (storageError || !fileData) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: '원본 계약서 파일을 찾을 수 없습니다. 파일을 다시 분석해 주세요.' },
      { status: 404 },
    );
  }
  const originalBuffer = Buffer.from(await fileData.arrayBuffer());

  // 원문 발췌 맵 구성 (item_key → excerpt)
  const allItems: RiskItem[] = analysis.risk_result.items ?? [];
  const excerpts: Record<string, string> = {};
  for (const item of allItems) {
    if (item.excerpt) excerpts[item.id] = item.excerpt;
  }

  // 조항 교체 + 파일 재생성
  let result: { buffer: Buffer; notFound: string[] };
  try {
    if (outputFormat === 'hwpx') {
      result = await replaceClausesInHwpx(originalBuffer, body.suggestions, excerpts);
    } else {
      // docx (기본) — 원본이 hwpx라도 docx로 출력 요청 시 docx로 변환 시도
      result = await replaceClausesInDocx(originalBuffer, body.suggestions, excerpts);
    }
  } catch (err) {
    console.error('[apply] file generation error:', err);
    return NextResponse.json(
      { error: 'FILE_GENERATION_FAILED', message: '수정 파일 생성 중 오류가 발생했습니다.' },
      { status: 502 },
    );
  }

  // 일부 조항 교체 실패 시 경고 (전체 실패는 아님)
  if (result.notFound.length > 0 && result.notFound.length === body.suggestions.length) {
    return NextResponse.json(
      {
        error: 'CLAUSE_NOT_FOUND',
        message: '일부 조항을 원본 파일에서 찾지 못했습니다. 수동 수정을 권장합니다.',
        notFound: result.notFound,
      },
      { status: 422 },
    );
  }

  // 수정 파일 Supabase Storage 업로드
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const baseName = analysis.file_name.replace(/\.[^.]+$/, '');
  const ext = outputFormat;
  const uploadFileName = `${baseName}_수정제안_${timestamp}.${ext}`;
  const uploadPath = `${userId}/revised/${id}_${Date.now()}.${ext}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: uploadError } = await (admin as any)
    .storage
    .from(STORAGE_BUCKET)
    .upload(uploadPath, result.buffer, {
      contentType: ext === 'hwpx' ? 'application/hwp+zip' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    });

  if (uploadError) {
    console.error('[apply] upload error:', uploadError);
    return NextResponse.json(
      { error: 'FILE_GENERATION_FAILED', message: '수정 파일 업로드 중 오류가 발생했습니다.' },
      { status: 502 },
    );
  }

  // Signed URL 생성 (60분)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: signedData, error: signedError } = await (admin as any)
    .storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(uploadPath, 3600) as { data: { signedUrl: string } | null; error: unknown };

  if (signedError || !signedData) {
    return NextResponse.json(
      { error: 'FILE_GENERATION_FAILED', message: '다운로드 URL 생성 중 오류가 발생했습니다.' },
      { status: 502 },
    );
  }

  // extractTextFromAnalysis는 import되어 있으나 직접 사용 안 함 — 향후 확장용
  void extractTextFromAnalysis;

  return NextResponse.json({
    signedUrl: signedData.signedUrl,
    fileName: uploadFileName,
    notFound: result.notFound.length > 0 ? result.notFound : undefined,
  });
}
