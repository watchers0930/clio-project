import { withMutation } from '@/lib/http/mutation-guard';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { generateEmbedding } from '@/lib/ai/embeddings';
import OpenAI from 'openai';
import { getUserRoleInfo } from '@/lib/permissions';
import { loadResultTexts } from '@/lib/search/result-content';
import { parseResultIds } from '@/lib/search/result-ids';

const CONTEXT_CHARS = 20000; // 고정 결과 본문 전체 예산 — 결과 수로 나눈다(한 건이면 한 파일을 깊게, 여러 건이면 고르게)
const SINGLE_RESULT_CHUNKS = 20; // 한 건만 물을 때 읽는 앞 청크 수(예전 단일 파일 질의와 같은 양)

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const HISTORY_TURNS = 8;
const HISTORY_CHARS = 4000; // 한 턴 상한 — 이전 답변(최대 800토큰)보다 넉넉히

/** 이전 대화 — 사용자·어시스턴트 턴만(본문에 role 'system' 을 넣어 지시를 바꾸지 못하게), 문자열·길이 상한 */
function safeHistory(history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m): m is ChatMessage => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, HISTORY_CHARS) }));
}

/**
 * POST /api/chat
 * body: { message: string, history: ChatMessage[], fileIds?: string[] }
 * 벡터 검색 → 컨텍스트 구성 → GPT-4o 답변 생성
 */
export async function POST(request: NextRequest) {
  // 변이 요청: 출처 + CSRF 토큰 + 활성 사용자 확인 (기존 권한 확인은 아래 그대로)
  const mutation = await withMutation(request);
  if (mutation.error) return mutation.error;
  try {
    const { message, history = [], fileIds } = await request.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: '메시지를 입력해 주세요.' }, { status: 400 });
    }
    const pinnedIds = fileIds === undefined ? [] : parseResultIds(fileIds);
    if (!pinnedIds) return NextResponse.json({ error: '조회 대상 형식이 올바르지 않습니다.' }, { status: 400 });

    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const roleInfo = await getUserRoleInfo(supabase, authUserId);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OpenAI API 키가 설정되지 않았습니다.' }, { status: 503 });

    // 1. 내 파일 목록 조회 (메타데이터 질문 대응)
    const { data: userFiles } = await supabase
      .from('files')
      .select('id, name, created_at, size')
      .eq('uploaded_by', authUserId)
      .order('created_at', { ascending: false })
      .limit(50);

    const myFileIds = new Set((userFiles ?? []).map((f: { id: string }) => f.id));

    // 2. 고정 결과 본문 또는 벡터 검색
    let relevantChunks: Array<{ file_id: string; content: string }> = [];

    let notProcessedFileIds: string[] = [];
    const extraNameMap = new Map<string, string>(); // 결과 ID → 이름 (uploader 무관)

    if (pinnedIds.length > 0) {
      // 검색 결과(문서·파일·로컬 파일)의 본문 — 권한은 검색이 결과를 거를 때와 같은 규칙. 문서와 파일이 섞여 있어도 둘 다 읽는다
      // (전에는 파일 청크가 하나라도 있으면 문서를 건너뛰고, 사용자 세션으로 읽어 공유받은 문서·파일이 빠졌다)
      const texts = await loadResultTexts(mutation.admin, supabase, {
        userId: authUserId, role: roleInfo?.role ?? 'user', departmentId: roleInfo?.department_id ?? null,
      }, pinnedIds, pinnedIds.length === 1 ? SINGLE_RESULT_CHUNKS : undefined);
      for (const t of texts) extraNameMap.set(t.id, t.name);
      const withText = texts.filter((t) => t.text.length > 0);
      // 예산은 본문이 있는 결과끼리 나눈다(권한 없음·미처리 결과까지 세면 문서 본문이 쓸데없이 줄어든다)
      const perResultChars = Math.floor(CONTEXT_CHARS / Math.max(1, withText.length));
      relevantChunks = withText.map((t) => ({ file_id: t.id, content: t.text.slice(0, perResultChars) }));
      // 본문이 없는 결과 — 전부 없으면 재처리 안내, 일부만 없으면 AI 가 내용을 지어내지 않게 이름을 알린다
      notProcessedFileIds = texts.filter((t) => t.text.length === 0).map((t) => t.id);
    } else {
      // 파일 미특정: 전체 내 파일 대상 벡터 검색
      const embedding = await generateEmbedding(message);
      const { data: chunks } = await supabase.rpc('match_file_chunks', {
        query_embedding: embedding,
        match_count: 12,
        match_threshold: 0.25,
      });
      relevantChunks = ((chunks ?? []) as Array<{ file_id: string; content: string }>).filter(
        (c) => myFileIds.has(c.file_id),
      );
    }

    // 4. 컨텍스트 구성 (파일명 포함)
    let context = '';
    let sourceFileIds: string[] = [];

    if (relevantChunks.length > 0) {
      const uniqueFileIds = [...new Set(relevantChunks.map((c) => c.file_id))];
      sourceFileIds = uniqueFileIds;

      const fileNameMap = new Map([
        ...(userFiles ?? []).map((f: { id: string; name: string }) => [f.id, f.name] as [string, string]),
        ...extraNameMap,
      ]);

      context = relevantChunks
        .map((c) => `[${fileNameMap.get(c.file_id) ?? '문서'}]\n${c.content}`)
        .join('\n\n---\n\n');
    }

    // 5. 파일 목록 컨텍스트 (최근 20개 — 메타데이터 질문 대응)
    const fileListContext =
      (userFiles ?? []).length > 0
        ? (userFiles ?? [])
            .slice(0, 20)
            .map((f: { name: string; created_at: string }, i: number) => {
              const date = new Date(f.created_at).toLocaleDateString('ko-KR');
              return `${i + 1}. ${f.name} (등록일: ${date})`;
            })
            .join('\n')
        : '등록된 파일이 없습니다.';

    // 6. 시스템 프롬프트 구성
    const fileNameMap2 = new Map([
      ...(userFiles ?? []).map((f: { id: string; name: string }) => [f.id, f.name] as [string, string]),
      ...extraNameMap,
    ]);
    const notProcessedNames = notProcessedFileIds
      .map((id) => fileNameMap2.get(id) ?? id)
      .join(', ');

    // 핀된 파일명 목록 (시스템 프롬프트에 명시)
    const pinnedFileNames = pinnedIds.length > 0
      ? pinnedIds.map((id) => fileNameMap2.get(id)).filter(Boolean).join(', ')
      : '';

    const systemPrompt = context
      ? `당신은 CLIO 문서관리 시스템의 AI 어시스턴트입니다. 아래 제공된 문서 내용을 바탕으로 사용자의 질문에 한국어로 정확하게 답변하세요.${pinnedFileNames ? `\n\n[조회 대상 파일]\n${pinnedFileNames}` : ''}${notProcessedNames ? `\n\n[내용을 읽지 못한 파일 — 이 파일들의 내용은 추측하지 말고 읽지 못했다고 밝히세요]\n${notProcessedNames}` : ''}\n\n[참고 문서 내용]\n${context}`
      : notProcessedFileIds.length > 0
        ? `당신은 CLIO 문서관리 시스템의 AI 어시스턴트입니다. 사용자가 질문한 파일(${notProcessedNames})은 아직 내용이 처리되지 않아 읽을 수 없습니다. 사용자에게 파일 관리 페이지에서 해당 파일을 재처리한 뒤 다시 질문해달라고 안내하세요.`
        : `당신은 CLIO 문서관리 시스템의 AI 어시스턴트입니다. 관련 문서 내용을 찾지 못했지만 아래 파일 목록 정보를 바탕으로 답변할 수 있습니다.\n\n[등록된 파일 목록]\n${fileListContext}`;

    // 7. GPT-4o-mini 호출
    const openai = new OpenAI({ apiKey });
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...safeHistory(history),
      { role: 'user' as const, content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 800,
      temperature: 0.3,
    });

    const answer = completion.choices[0]?.message?.content ?? '답변을 생성할 수 없습니다.';

    return NextResponse.json({ answer, sourceFileIds });
  } catch (err) {
    console.error('[chat]', err);
    return NextResponse.json({ error: '답변 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
