import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { extractText } from '@/lib/ai/extract-text';
import { analyzeContractRisk } from '@/lib/ai/contract-risk-analyzer';
import type { ContractType, Perspective } from '@/lib/types/contract-risk';

export const maxDuration = 60;

const ALLOWED_EXTS = ['docx', 'hwpx', 'hwp', 'pdf', 'txt'];
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'AI 서비스가 설정되지 않았습니다.' }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
  }

  const userId = await getAuthUserId(supabase);
  if (!userId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  // ── multipart/form-data 파싱 ─────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const contractType = (formData.get('contract_type') as ContractType | null) ?? 'general';
  const perspective = (formData.get('perspective') as Perspective | null) ?? 'seller_side';

  if (!file) {
    return NextResponse.json({ error: '파일을 첨부해 주세요.' }, { status: 400 });
  }

  // ── 파일 유효성 검사 ─────────────────────────────────────────────────────
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: 'FILE_TOO_LARGE', message: '파일 크기가 20MB를 초과합니다.' },
      { status: 413 },
    );
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTS.includes(ext)) {
    return NextResponse.json(
      { error: 'INVALID_FILE_TYPE', message: '지원하지 않는 파일 형식입니다. DOCX, HWPX, PDF만 가능합니다.' },
      { status: 400 },
    );
  }

  const admin = createAdminSupabaseClient();

  // ── DB에 pending 레코드 INSERT ────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: record, error: insertError } = await (admin as any)
    .from('contract_risk_analyses')
    .insert({
      user_id: userId,
      file_name: file.name,
      file_type: ext === 'hwp' ? 'hwpx' : ext,
      contract_type: contractType,
      perspective,
      status: 'processing',
      risk_result: { items: [], summary: '' },
      risk_count: { high: 0, medium: 0, low: 0 },
    })
    .select('id')
    .single() as { data: { id: string } | null; error: unknown };

  if (insertError || !record) {
    console.error('[contract-risk/analyze] INSERT error:', insertError);
    return NextResponse.json({ error: '분석 레코드 생성에 실패했습니다.' }, { status: 500 });
  }

  const recordId = record.id;

  // ── 텍스트 추출 ───────────────────────────────────────────────────────────
  const buffer = await file.arrayBuffer();
  let rawText: string;
  try {
    rawText = await extractText(buffer, file.type, file.name);
  } catch (err) {
    await (admin as any)
      .from('contract_risk_analyses')
      .update({ status: 'error' })
      .eq('id', recordId);
    console.error('[contract-risk/analyze] extractText error:', err);
    return NextResponse.json(
      { error: 'TEXT_EXTRACTION_FAILED', message: '텍스트를 추출할 수 없습니다. 스캔 이미지 PDF는 지원하지 않습니다.' },
      { status: 400 },
    );
  }

  if (!rawText.trim()) {
    await (admin as any)
      .from('contract_risk_analyses')
      .update({ status: 'error' })
      .eq('id', recordId);
    return NextResponse.json(
      { error: 'TEXT_EXTRACTION_FAILED', message: '계약서에서 텍스트를 추출할 수 없습니다.' },
      { status: 400 },
    );
  }

  // ── GPT-4o 분석 ───────────────────────────────────────────────────────────
  let risk_result, risk_count;
  try {
    ({ risk_result, risk_count } = await analyzeContractRisk(rawText, contractType, perspective));
  } catch (err) {
    await (admin as any)
      .from('contract_risk_analyses')
      .update({ status: 'error' })
      .eq('id', recordId);
    console.error('[contract-risk/analyze] analyzeContractRisk error:', err);
    return NextResponse.json(
      { error: 'AI_ANALYSIS_FAILED', message: 'AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 502 },
    );
  }

  // ── 원본 파일 Storage 업로드 (apply 라우트에서 조항 교체 시 필요) ─────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .storage
    .from('files')
    .upload(`contract-risk/${userId}/${file.name}`, Buffer.from(buffer), {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });

  // ── DB UPDATE: done ───────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('contract_risk_analyses')
    .update({
      status: 'done',
      raw_text: rawText.slice(0, 200_000), // 최대 200K자 저장
      risk_result,
      risk_count,
    })
    .eq('id', recordId);

  return NextResponse.json({ id: recordId, status: 'done', risk_count, risk_result });
}
