/**
 * POST /api/generate/extract-fields
 * 소스 파일 텍스트를 분석하여 템플릿 필드값을 추론하는 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { loadSourceChunks } from '@/app/api/generate/route-helpers';

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }

  const authUserId = await getAuthUserId(supabase);
  if (!authUserId) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  let body: {
    sourceFileIds?: unknown;
    fields?: unknown;
    templateName?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const { sourceFileIds, fields, templateName } = body;

  if (!Array.isArray(sourceFileIds) || sourceFileIds.length === 0 || !sourceFileIds.every((id) => typeof id === 'string')) {
    return NextResponse.json({ error: 'sourceFileIds는 비어있지 않은 문자열 배열이어야 합니다.' }, { status: 400 });
  }
  if (!Array.isArray(fields) || fields.length === 0) {
    return NextResponse.json({ error: 'fields는 비어있지 않은 배열이어야 합니다.' }, { status: 400 });
  }
  for (const f of fields) {
    if (!f || typeof f !== 'object' || typeof (f as Record<string, unknown>).key !== 'string' || typeof (f as Record<string, unknown>).label !== 'string') {
      return NextResponse.json({ error: 'fields의 각 항목은 key, label 필드를 포함해야 합니다.' }, { status: 400 });
    }
  }

  try {
    const { sourceFileSummary, sourceChunks, sourceFileNames, sourceFileCount } = await loadSourceChunks(supabase, sourceFileIds as string[]);

    if (!sourceFileSummary.trim()) {
      console.error('[extract-fields] no_text debug:', { requestedIds: sourceFileIds.length, foundFiles: sourceFileCount, fileNames: sourceFileNames, chunksExtracted: sourceChunks.length });
      return NextResponse.json({ extractedInputs: {}, reason: 'no_text', debug: { requestedIds: sourceFileIds.length, foundFiles: sourceFileCount, fileNames: sourceFileNames } });
    }

    const validFields = fields as Array<{ key: string; label: string; placeholder?: string }>;
    const fieldList = validFields.map((f) => `- ${f.key}: ${f.label}${f.placeholder ? ` (예: ${f.placeholder})` : ''}`).join('\n');

    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      temperature: 0.2,
      system: `당신은 문서 분석 어시스턴트입니다. 참조 파일의 내용을 분석하여, 주어진 필드에 적합한 값을 추론합니다.
추론이 불가능한 필드는 빈 문자열("")로 남겨주세요. 추측이 아닌 확실한 정보만 채워주세요.
반드시 JSON 형식으로 응답하세요: { "extractedInputs": { "필드key": "값", ... } }`,
      prompt: `템플릿: ${typeof templateName === 'string' ? templateName : '문서'}

다음 참조 파일 내용을 분석하여 아래 필드값을 추론해주세요.

## 참조 파일 내용
${sourceFileSummary.slice(0, 4000)}

## 추론할 필드 목록
${fieldList}`,
    });

    let parsed: Record<string, unknown>;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] ?? '{}');
    } catch {
      return NextResponse.json({ extractedInputs: {} });
    }

    const extracted = (parsed.extractedInputs ?? parsed) as Record<string, string>;
    const result: Record<string, string> = {};
    for (const f of validFields) {
      const val = extracted[f.key];
      if (typeof val === 'string' && val.trim()) {
        result[f.key] = val.trim();
      }
    }

    return NextResponse.json({ extractedInputs: result });
  } catch (error) {
    console.error('[extract-fields] error:', error);
    return NextResponse.json({ error: '필드 추출에 실패했습니다.' }, { status: 500 });
  }
}
