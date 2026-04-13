/**
 * POST /api/documents/[id]/diff/analyze
 * DiffResult를 GPT-4o에 전달 → 변경 내용 분석을 SSE 스트리밍으로 반환
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import type { DiffResult, DiffLine } from '@/lib/utils/myers-diff';

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── 프롬프트 빌더 ──────────────────────────────────────────────────────────

function buildSystemPrompt(contractType?: string): string {
  const contractSection = contractType
    ? `\n3. [유불리 분석]: 갑(발주자/임차인)과 을(공급자/임대인) 각각에 유리/불리한 변경 항목을 분류하세요.\n4. [법적 주의 사항]: 추가 협의가 필요한 모호한 조항을 지적하세요. 없으면 "해당 없음".`
    : '';

  return `당신은 문서 변경 내용 분석 전문가입니다.
아래 diff 결과를 보고 다음을 수행하세요:

1. [변경 요약]: 총 변경 항목 수와 주요 변경 내용을 번호 목록으로 정리하세요.
2. [변경 맥락]: 변경 내용의 흐름과 의도를 2~3문장으로 설명하세요.${contractSection}

답변은 간결하고 명확하게 작성하세요. 불필요한 서론 없이 바로 분석을 시작하세요.`;
}

function buildUserPrompt(
  diffResult: DiffResult,
  title: string,
  contractType?: string,
  perspective?: 'buyer' | 'seller',
): string {
  const perspectiveLabel =
    perspective === 'buyer' ? '갑(발주자) 입장' :
    perspective === 'seller' ? '을(공급자) 입장' : '중립';

  // 변경된 줄만 추출 (unchanged 제외), 앞뒤 2줄 컨텍스트 포함
  const changedIndices = new Set<number>();
  diffResult.lines.forEach((line, idx) => {
    if (line.type !== 'unchanged') {
      for (let j = Math.max(0, idx - 2); j <= Math.min(diffResult.lines.length - 1, idx + 2); j++) {
        changedIndices.add(j);
      }
    }
  });

  const diffText = [...changedIndices]
    .sort((a, b) => a - b)
    .map((idx) => {
      const line: DiffLine = diffResult.lines[idx];
      if (line.type === 'unchanged') return `  ${line.content}`;
      if (line.type === 'removed') return `삭제: ${line.content}`;
      if (line.type === 'added') return `추가: ${line.content}`;
      if (line.type === 'modified') return `변경: ${line.oldContent ?? ''} → ${line.content}`;
      return '';
    })
    .join('\n');

  // 5,000자 초과 시 자르기
  const truncatedDiff = diffText.length > 5000 ? diffText.slice(0, 5000) + '\n... (이하 생략)' : diffText;

  return `문서 제목: ${title}
문서 유형: ${contractType ?? '일반 문서'}
비교 입장: ${perspectiveLabel}

--- 변경 내용 ---
${truncatedDiff || '(변경 사항 없음)'}
---

위 변경 내용을 분석해 주세요.`;
}

// ── SSE 유틸 ──────────────────────────────────────────────────────────────

function encodeSSE(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ── 핸들러 ──────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ message: 'AI 서비스가 설정되지 않았습니다.' })}\n\nevent: done\ndata: {}\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } },
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ message: 'DB 미설정' })}\n\nevent: done\ndata: {}\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } },
    );
  }

  const authUserId = await getAuthUserId(supabase);
  if (!authUserId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await params;

  let body: { diffResult?: DiffResult; contractType?: string; perspective?: 'buyer' | 'seller'; title?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const { diffResult, contractType, perspective, title = '' } = body;

  if (!diffResult) {
    return new Response('diffResult is required', { status: 400 });
  }

  // 변경 사항이 없으면 즉시 done
  const hasChanges = diffResult.stats.added + diffResult.stats.removed + diffResult.stats.changed > 0;
  if (!hasChanges) {
    return new Response(
      `event: done\ndata: {}\n\n`,
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Content-Type-Options': 'nosniff',
          'X-Document-Id': id,
        },
      },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          stream: true,
          max_tokens: 2000,
          messages: [
            { role: 'system', content: buildSystemPrompt(contractType) },
            { role: 'user', content: buildUserPrompt(diffResult, title, contractType, perspective) },
          ],
        });

        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) {
            controller.enqueue(encodeSSE('chunk', { text }));
          }
        }
      } catch (err) {
        console.error('[diff/analyze] OpenAI error:', err);
        controller.enqueue(
          encodeSSE('error', { message: 'AI 해석에 실패했습니다. diff 뷰는 정상 동작합니다.' }),
        );
      } finally {
        controller.enqueue(encodeSSE('done', {}));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
