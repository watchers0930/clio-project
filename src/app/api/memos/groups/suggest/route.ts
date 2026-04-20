/**
 * POST /api/memos/groups/suggest
 * 그룹 내 메모 기반 GPT-4o AI 아이디어 제안 (SSE 스트리밍)
 * 요청: { groupId, groupName }
 * 응답: SSE — data: {"type":"idea",...} / data: {"type":"done"}
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

// memo_groups 테이블은 generated types에 없으므로 캐스팅 사용
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rawFrom(admin: ReturnType<typeof createAdminSupabaseClient>, table: string): any {
  return (admin as unknown as Record<string, (t: string) => unknown>).from(table);
}

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  _openai = new OpenAI({ apiKey });
  return _openai;
}

export const maxDuration = 60;

interface GroupRow {
  id: string;
  user_id: string;
  memo_ids: string[];
}

interface MemoContent {
  title: string;
  content: string | null;
}

interface IdeaItem {
  title?: string;
  description?: string;
  effect?: string;
}

export async function POST(request: NextRequest) {
  // 인증 확인
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return new Response(JSON.stringify({ success: false, error: 'DB 미설정' }), { status: 503 });
  }
  const authUserId = await getAuthUserId(supabase);
  if (!authUserId) {
    return new Response(JSON.stringify({ success: false, error: '인증 필요' }), { status: 401 });
  }

  // 요청 파싱 + 검증
  let groupId: string;
  let groupName: string;
  try {
    const body = await request.json();
    groupId = body.groupId;
    groupName = body.groupName;
  } catch {
    return new Response(JSON.stringify({ success: false, error: '잘못된 요청 형식' }), {
      status: 400,
    });
  }

  if (!groupId || typeof groupId !== 'string') {
    return new Response(JSON.stringify({ success: false, error: 'groupId 필수' }), { status: 400 });
  }
  if (!groupName || typeof groupName !== 'string') {
    return new Response(JSON.stringify({ success: false, error: 'groupName 필수' }), {
      status: 400,
    });
  }

  const admin = createAdminSupabaseClient();

  // 그룹 조회 + 소유권 확인
  const { data: groupRaw, error: groupError } = await rawFrom(admin, 'memo_groups')
    .select('id, user_id, memo_ids')
    .eq('id', groupId)
    .single();

  const group = groupRaw as GroupRow | null;

  if (groupError || !group) {
    return new Response(JSON.stringify({ success: false, error: '그룹 없음' }), { status: 404 });
  }
  if (group.user_id !== authUserId) {
    return new Response(JSON.stringify({ success: false, error: '권한 없음' }), { status: 403 });
  }

  // 그룹 내 메모 조회
  const memoIds = group.memo_ids;
  const { data: memosRaw, error: memosError } = await admin
    .from('memos')
    .select('title, content')
    .in('id', memoIds)
    .eq('created_by', authUserId);

  if (memosError || !memosRaw || memosRaw.length === 0) {
    return new Response(JSON.stringify({ success: false, error: '메모 조회 실패' }), {
      status: 500,
    });
  }

  const memos = memosRaw as unknown as MemoContent[];
  const memoText = memos
    .map((m) => `[${m.title}]\n${m.content ?? ''}`)
    .join('\n\n');

  const prompt =
    `다음은 사용자가 기록한 메모들입니다. 이 메모들의 공통 맥락을 분석하고,\n` +
    `실행 가능한 아이디어 3~5개를 제안하세요.\n\n` +
    `각 아이디어는 다음 형식의 JSON 배열로 응답하세요:\n` +
    `[\n  {\n    "title": "아이디어 제목",\n    "description": "구체적인 설명 (2~3문장)",\n    "effect": "예상 효과 또는 기대 결과"\n  }\n]\n\n` +
    `메모 목록:\n${memoText}`;

  // SSE 스트림 생성
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const openai = getOpenAI();
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1500,
        });

        const content = completion.choices[0]?.message?.content ?? '[]';

        // JSON 배열 파싱 (마크다운 코드블록 제거 후)
        const cleaned = content.replace(/```json\n?|```\n?/g, '').trim();
        let ideas: IdeaItem[] = [];
        try {
          ideas = JSON.parse(cleaned) as IdeaItem[];
        } catch {
          console.error('[suggest/POST] JSON parse error, raw:', cleaned);
        }

        // 아이디어 순차 전송
        for (let i = 0; i < ideas.length; i++) {
          const idea = ideas[i];
          if (idea && idea.title) {
            send({
              type: 'idea',
              index: i + 1,
              title: idea.title,
              description: idea.description ?? '',
              effect: idea.effect ?? '',
            });
          }
        }

        send({ type: 'done' });
      } catch (err) {
        console.error('[suggest/POST] stream error:', err);
        send({ type: 'error', message: '아이디어 생성에 실패했습니다.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
