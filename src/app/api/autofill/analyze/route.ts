/**
 * POST /api/autofill/analyze
 * DOCX/HWPX 파일을 업로드하면:
 * 1. analyze-template.ts로 빈 필드 감지
 * 2. GPT-4o로 필드명 추론 (신뢰도 포함)
 * 3. DB 자동 매핑 (이름/직급/부서/날짜)
 * 4. autofill_sessions 레코드 생성 후 세션 ID 반환
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { analyzeDocumentStructure } from '@/lib/ai/analyze-template';
import OpenAI from 'openai';

export const maxDuration = 60;

const ALLOWED_EXTS = ['docx', 'hwpx', 'hwp'];
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export interface DetectedField {
  key: string;
  label: string;
  type: 'blank' | 'placeholder' | 'underline' | 'bracket';
  location: string;
  context?: string;
  inferredName?: string;      // GPT-4o 추론 필드명
  confidence: 'high' | 'medium' | 'low';
  autoMapped?: boolean;       // DB에서 자동 매핑됨
  autoValue?: string;         // 자동 매핑된 값
}

// 날짜 관련 키워드
const DATE_KEYWORDS = ['날짜', '일자', '일시', '작성일', '계약일', '체결일', '기준일', '신청일', '등록일'];
// 이름 관련 키워드
const NAME_KEYWORDS = ['이름', '성명', '작성자', '담당자', '신청자', '대표자', '작성자명', '담당자명'];
// 직급 관련 키워드
const POSITION_KEYWORDS = ['직급', '직위', '직책', '직함'];
// 부서 관련 키워드
const DEPT_KEYWORDS = ['부서', '소속', '팀', '부서명', '소속팀'];

function autoMapField(
  inferredName: string,
  userData: { name: string; position: string; department: string },
): { autoMapped: boolean; autoValue?: string } {
  const lower = inferredName.toLowerCase();

  if (DATE_KEYWORDS.some(k => lower.includes(k))) {
    const today = new Date();
    const formatted = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
    return { autoMapped: true, autoValue: formatted };
  }
  if (NAME_KEYWORDS.some(k => lower.includes(k))) {
    return { autoMapped: true, autoValue: userData.name };
  }
  if (POSITION_KEYWORDS.some(k => lower.includes(k))) {
    return { autoMapped: true, autoValue: userData.position };
  }
  if (DEPT_KEYWORDS.some(k => lower.includes(k))) {
    return { autoMapped: true, autoValue: userData.department };
  }

  return { autoMapped: false };
}

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: '파일을 첨부해 주세요.' }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: '파일 크기가 20MB를 초과합니다.' }, { status: 413 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTS.includes(ext)) {
    return NextResponse.json(
      { error: 'DOCX, HWPX, HWP 파일만 지원합니다.' },
      { status: 400 },
    );
  }

  // HWP 바이너리는 신뢰도 Low 강제 (analyzeDocumentStructure가 빈 배열 반환)
  const isHwpBinary = ext === 'hwp';

  // 사용자 정보 조회 (자동 매핑용)
  const admin = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userRow } = await (admin as any)
    .from('users')
    .select('name, position, department_id, departments(name)')
    .eq('id', userId)
    .single() as { data: { name: string; position: string; departments: { name: string } | null } | null };

  const userData = {
    name: userRow?.name ?? '',
    position: userRow?.position ?? '',
    department: (userRow?.departments as { name: string } | null)?.name ?? '',
  };

  // 파일 버퍼 읽기 + Storage에 임시 저장 (generate API에서 재사용)
  const buffer = await file.arrayBuffer();
  const tempPath = `autofill-temp/${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).storage
    .from('files')
    .upload(tempPath, Buffer.from(buffer), {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  // 1. 문서 구조 분석
  let rawFields = await analyzeDocumentStructure(buffer, file.type, file.name);

  // HWP 바이너리: 패턴 감지만 가능, 신뢰도 Low
  if (isHwpBinary) {
    rawFields = rawFields.map(f => ({ ...f, confidence: 'low' as const }));
  }

  if (rawFields.length === 0) {
    return NextResponse.json(
      { error: '빈 필드를 감지하지 못했습니다. 양식 문서인지 확인해 주세요.' },
      { status: 422 },
    );
  }

  // 2. GPT-4o로 필드명 추론 (최대 30개 제한)
  const fieldsToInfer = rawFields.slice(0, 30);
  let inferredFields: DetectedField[] = fieldsToInfer.map(f => ({
    ...f,
    confidence: isHwpBinary ? 'low' : 'medium',
  }));

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `다음은 양식 문서에서 감지된 빈 필드 목록입니다.
각 필드의 "key", "label", "context"를 보고 해당 필드가 어떤 정보를 입력받는 칸인지 한국어 이름을 추론해 주세요.
신뢰도는 high(확실), medium(추정), low(불분명)으로 설정해 주세요.

필드 목록 (JSON):
${JSON.stringify(fieldsToInfer.map(f => ({ key: f.key, label: f.label, context: f.context })), null, 2)}

응답 형식 (JSON 배열, 필드 순서 유지):
[{"key": "...", "inferredName": "...", "confidence": "high|medium|low"}, ...]`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: '당신은 문서 양식 분석 전문가입니다. 빈 필드의 용도를 정확하게 파악합니다.' },
        { role: 'user', content: prompt + '\n\n반드시 {"fields": [...]} 형태로 응답하세요.' },
      ],
      max_tokens: 1000,
    });

    const parsed = JSON.parse(response.choices[0].message.content ?? '{}');
    const gptResults: { key: string; inferredName: string; confidence: 'high' | 'medium' | 'low' }[] =
      parsed.fields ?? [];

    const gptMap = new Map(gptResults.map(r => [r.key, r]));

    inferredFields = fieldsToInfer.map(f => {
      const gpt = gptMap.get(f.key);
      return {
        ...f,
        inferredName: gpt?.inferredName ?? f.label,
        confidence: isHwpBinary ? 'low' : (gpt?.confidence ?? 'medium'),
      };
    });
  } catch (err) {
    console.error('[autofill/analyze] GPT inference error:', err);
    // GPT 실패 시 원본 label을 inferredName으로 사용
    inferredFields = fieldsToInfer.map(f => ({
      ...f,
      inferredName: f.label,
      confidence: 'low' as const,
    }));
  }

  // 3. 자동 매핑
  const detectedFields: DetectedField[] = inferredFields.map(f => {
    const name = f.inferredName ?? f.label;
    const mapped = autoMapField(name, userData);
    return { ...f, ...mapped };
  });

  // 4. autofill_sessions 레코드 생성
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session, error: insertError } = await (admin as any)
    .from('autofill_sessions')
    .insert({
      user_id: userId,
      file_name: file.name,
      file_type: ext === 'hwp' ? 'hwp' : ext,
      detected_fields: detectedFields,
      status: 'analyzed',
      output_path: tempPath,  // 원본 파일 임시 경로 저장
    })
    .select('id')
    .single() as { data: { id: string } | null; error: unknown };

  if (insertError || !session) {
    console.error('[autofill/analyze] INSERT error:', insertError);
    return NextResponse.json({ error: '세션 생성에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({
    sessionId: session.id,
    fields: detectedFields,
    totalFields: detectedFields.length,
    autoMappedCount: detectedFields.filter(f => f.autoMapped).length,
  });
}
