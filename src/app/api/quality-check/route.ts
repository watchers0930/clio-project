import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import type {
  QualityCheckResult,
  QualityCheckItem,
  QualityCheckResponse,
} from '@/lib/supabase/types';

export const maxDuration = 60;

// ────────────────────────────────────────────────────────────────────────────
// System Prompt
// ────────────────────────────────────────────────────────────────────────────

const QUALITY_CHECK_SYSTEM_PROMPT = `당신은 대한민국 행정기관 공문서 전문 교정자입니다.
아래 기준에 따라 제출된 문서를 엄격하게 검토하고, 반드시 지정된 JSON 형식으로만 응답하십시오.

## 검토 기준

### 1. 맞춤법 및 어문 규범 (category: "spelling")
- 한글 맞춤법 위반: 띄어쓰기, 된소리, 사이시옷, 어미 오용
- 외래어 표기법 오류 (국립국어원 기준)
- 문장 부호 오용: 쌍점·마침표 위치, 따옴표 종류
- 높임말·평어 혼용 (공문서 내 경어 일관성)
- 맞춤법 오류가 없으면 items에 spelling 항목을 포함하지 마라.
- severity 기준: 명백한 오탈자=error, 표기 관습 차이=warning, 더 나은 표현=suggestion

### 2. 공문서 규격 준수 (category: "format")
- 행정업무운영규정 기반 공문서 양식 기준 적용
- 날짜 표기: "2026. 4. 12." 형식 (한글 날짜 표기 금지) — 위반 시 반드시 error로 분류
- 금액 표기: "금 1,000,000원정" 형식
- 문단 번호 체계: 1. → 가. → 1) → 가) 순서
- 제목에 마침표가 있으면 warning으로 분류
- 문단 번호 순서 역전은 error로 분류

### 3. 논리 흐름 및 문장 품질 (category: "logic")
- 문단 간 논리 연결 자연스러움
- 중복 표현 및 불필요한 수식어
- 단일 문장 3줄 초과 여부 (suggestion으로 분류)
- 결론 없는 열거 구조 (warning으로 분류)
- 문단 수가 2개 미만이면 logic 항목은 생략 가능

### 4. 누락 항목 검사 (category: "missing")
- 필수 필드 미기재: 수신기관, 발신일, 문서번호 → error로 분류
- 서명·날인 안내 누락 → suggestion으로 분류
- 첨부파일 언급 후 목록 없음 → warning으로 분류
- 금액 기재 후 산출근거 누락 → warning으로 분류

## 응답 형식 (JSON only)
{
  "overall_score": <0~100 정수. spelling:-5/건, format:-5/건, logic:-3/건, missing:-8/건 차감>,
  "items": [
    {
      "category": "spelling" | "format" | "logic" | "missing",
      "severity": "error" | "warning" | "suggestion",
      "original": "<원문 인용 최대 100자, 없으면 빈 문자열>",
      "suggestion": "<수정 제안, 없으면 빈 문자열>",
      "description": "<위반 이유 1~2문장>"
    }
  ],
  "summary": "<전체 요약 1~2문장>"
}

문서가 매우 짧거나 내용이 없는 경우: overall_score: 0, items: [], summary: "문서 내용이 부족하여 검수할 수 없습니다."`;

// ────────────────────────────────────────────────────────────────────────────
// Row types for untyped tables
// ────────────────────────────────────────────────────────────────────────────

type DocRow = { id: string; content: string | null; created_by: string; title: string };
type QCRow  = { id: string; overall_score: number; result_json: QualityCheckResult; created_at: string };

// ────────────────────────────────────────────────────────────────────────────
// POST /api/quality-check — 검수 요청 (GPT-4o 호출 + DB 저장)
// ────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. OpenAI 설정 확인
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'AI 검수 서비스가 설정되지 않았습니다.' }, { status: 503 });
  }

  // 2. 세션 인증
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
  }

  const authUserId = await getAuthUserId(supabase);
  if (!authUserId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  // 3. 파라미터 파싱
  let body: { document_id?: string; force?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const { document_id, force = false } = body;

  if (!document_id || typeof document_id !== 'string') {
    return NextResponse.json({ error: '문서 ID가 필요합니다.' }, { status: 400 });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(document_id)) {
    return NextResponse.json({ error: '유효하지 않은 문서 ID입니다.' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  // 4. 문서 조회 (admin — RLS 우회로 content 안전하게 읽기)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc, error: docError } = await (admin as any)
    .from('documents')
    .select('id, content, created_by, title')
    .eq('id', document_id)
    .single() as { data: DocRow | null; error: unknown };

  if (docError || !doc) {
    return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
  }

  if (doc.created_by !== authUserId) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const content = doc.content?.trim() ?? '';
  if (!content) {
    return NextResponse.json({ error: '문서 내용이 없어 검수할 수 없습니다.' }, { status: 422 });
  }

  // 5. 캐시 확인 (force=false 일 때)
  if (!force) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cached } = await (admin as any)
      .from('document_quality_checks')
      .select('id, overall_score, result_json, created_at')
      .eq('document_id', document_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as { data: QCRow | null };

    if (cached) {
      const resp: QualityCheckResponse = {
        check_id: cached.id,
        document_id,
        overall_score: cached.overall_score,
        items: (cached.result_json.items ?? []) as QualityCheckItem[],
        summary: cached.result_json.summary ?? '',
        checked_at: cached.created_at,
        from_cache: true,
      };
      return NextResponse.json(resp);
    }
  }

  // 6. GPT-4o 호출
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const truncatedContent = content.slice(0, 10000);
  const userPrompt = `다음 공문서를 검토하십시오.\n\n--- 문서 시작 ---\n${truncatedContent}\n--- 문서 끝 ---\n\nJSON 형식으로 결과를 반환하십시오.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  let parsed: QualityCheckResult;
  try {
    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o',
        temperature: 0.1,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: QUALITY_CHECK_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      },
      { signal: controller.signal },
    );
    clearTimeout(timeoutId);

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const mayParsed = JSON.parse(raw) as Partial<QualityCheckResult>;

    if (typeof mayParsed.overall_score !== 'number' || !Array.isArray(mayParsed.items)) {
      throw new Error('GPT-4o 응답 구조 불일치');
    }

    parsed = {
      overall_score: Math.max(0, Math.min(100, Math.round(mayParsed.overall_score))),
      items: (mayParsed.items ?? []) as QualityCheckItem[],
      summary: mayParsed.summary ?? '',
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'))) {
      return NextResponse.json({ error: '검수 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.' }, { status: 408 });
    }
    if (err instanceof SyntaxError) {
      console.error('[quality-check] JSON parse error:', err);
      return NextResponse.json({ error: 'AI 응답 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
    console.error('[quality-check] GPT-4o error:', err);
    return NextResponse.json({ error: 'AI 검수 중 오류가 발생했습니다.' }, { status: 500 });
  }

  // 7. DB 저장
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: saved, error: insertError } = await (admin as any)
    .from('document_quality_checks')
    .insert({
      document_id,
      checked_by: authUserId,
      overall_score: parsed.overall_score,
      result_json: parsed,
    })
    .select('id, created_at')
    .single() as { data: { id: string; created_at: string } | null; error: unknown };

  if (insertError || !saved) {
    console.error('[quality-check] INSERT error:', insertError);
    return NextResponse.json({ error: '검수 결과 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }

  const resp: QualityCheckResponse = {
    check_id: saved.id,
    document_id,
    overall_score: parsed.overall_score,
    items: parsed.items,
    summary: parsed.summary,
    checked_at: saved.created_at,
    from_cache: false,
  };

  return NextResponse.json(resp);
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/quality-check?document_id={id} — 최신 캐시 조회
// ────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
  }

  const authUserId = await getAuthUserId(supabase);
  if (!authUserId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const document_id = request.nextUrl.searchParams.get('document_id');
  if (!document_id) {
    return NextResponse.json({ error: '문서 ID가 필요합니다.' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cached } = await (admin as any)
    .from('document_quality_checks')
    .select('id, overall_score, result_json, created_at')
    .eq('document_id', document_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single() as { data: QCRow | null };

  if (!cached) {
    return NextResponse.json({ check_id: null, document_id, from_cache: false });
  }

  const resp: QualityCheckResponse = {
    check_id: cached.id,
    document_id,
    overall_score: cached.overall_score,
    items: (cached.result_json.items ?? []) as QualityCheckItem[],
    summary: cached.result_json.summary ?? '',
    checked_at: cached.created_at,
    from_cache: true,
  };

  return NextResponse.json(resp);
}
