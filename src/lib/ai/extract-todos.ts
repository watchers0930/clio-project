/**
 * 회의록 → 할일 자동 추출 서비스
 * GPT-4o로 액션 아이템·담당자·기한 추출 → todos 테이블 INSERT
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

// ─── 타입 ────────────────────────────────────────────────────────────────────

/** GPT-4o가 반환하는 개별 할일 항목 */
export interface ExtractedTodo {
  title: string;           // 할일 제목 (필수)
  assigneeName: string;    // 담당자 이름 (빈 문자열 가능)
  dueDate: string | null;  // ISO 날짜 YYYY-MM-DD 또는 null
  priority: 'high' | 'medium' | 'low';
}

/** todos 테이블 일괄 INSERT 결과 */
export interface TodoInsertResult {
  inserted: number;
  skipped: number;
  todos: Array<{ id: string; title: string }>;
}

// ─── 프롬프트 ─────────────────────────────────────────────────────────────────

const EXTRACT_SYSTEM_PROMPT = `당신은 회의록에서 액션 아이템을 추출하는 전문 AI입니다.

규칙:
1. 회의 내용에서 실제 할 일(action item)만 추출합니다. 논의사항이나 정보 공유는 제외합니다.
2. 담당자가 명시된 경우에만 assigneeName을 채웁니다. 불명확하면 빈 문자열("")로 설정합니다.
3. 기한이 명시된 경우에만 dueDate를 채웁니다. 불명확하거나 언급 없으면 null로 설정합니다.
4. dueDate는 반드시 ISO 8601 형식(YYYY-MM-DD)으로 작성합니다. 상대적 표현("다음 주", "3일 후")은 오늘 날짜 기준으로 계산합니다.
5. priority는 긴급도·중요도 기준:
   - high: "긴급", "오늘까지", "내일까지", "빠르게" 등의 표현
   - low: "여유 있게", "나중에", "검토해보면" 등의 표현
   - medium: 그 외 (기본값)
6. 반드시 JSON만 응답합니다. 설명 텍스트 금지.`;

function buildExtractUserPrompt(transcriptText: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `다음은 회의 내용입니다 (오늘 날짜: ${today}):

---
${transcriptText.slice(0, 15000)}
---

위 회의 내용에서 액션 아이템을 추출하여 아래 JSON 형식으로만 응답하세요:

{
  "todos": [
    {
      "title": "할일 제목",
      "assigneeName": "담당자 이름 또는 빈 문자열",
      "dueDate": "YYYY-MM-DD 또는 null",
      "priority": "high | medium | low"
    }
  ]
}

액션 아이템이 없으면 todos를 빈 배열([])로 반환합니다.`;
}

// ─── 핵심 함수 ────────────────────────────────────────────────────────────────

/**
 * 회의록 텍스트에서 할일 목록을 추출한다.
 * 실패 시 예외를 던지지 않고 빈 배열 반환.
 */
export async function extractTodosFromText(
  transcriptText: string,
): Promise<ExtractedTodo[]> {
  try {
    const { text } = await generateText({
      model: openai('gpt-4o'),
      system: EXTRACT_SYSTEM_PROMPT,
      prompt: buildExtractUserPrompt(transcriptText),
      maxOutputTokens: 2000,
      temperature: 0.1,
    });

    const cleaned = text.replace(/```json\n?|```/g, '').trim();
    const parsed = JSON.parse(cleaned) as { todos: ExtractedTodo[] };

    if (!Array.isArray(parsed.todos)) return [];
    return parsed.todos.filter((t) => t.title && t.title.trim().length > 0);
  } catch (err) {
    console.error('[extract-todos] GPT-4o 추출 실패:', err);
    return [];
  }
}

/**
 * 담당자 이름을 users 테이블에서 조회하여 user_id를 반환한다.
 * 일치하지 않으면 requestUserId(요청자 본인)를 반환한다.
 */
export async function resolveAssigneeUserId(
  assigneeName: string,
  requestUserId: string,
): Promise<string> {
  if (!assigneeName.trim()) return requestUserId;

  const admin = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('users')
    .select('id')
    .ilike('name', assigneeName.trim())
    .eq('is_active', true)
    .limit(1)
    .single() as { data: { id: string } | null };

  return data?.id ?? requestUserId;
}

/**
 * 선택된 ExtractedTodo 배열을 todos 테이블에 일괄 INSERT한다.
 * admin 클라이언트 사용 (RLS bypass — 담당자 user_id 직접 지정).
 */
export async function insertExtractedTodos(
  selectedTodos: ExtractedTodo[],
  docTitle: string,
  requestUserId: string,
): Promise<TodoInsertResult> {
  const admin = createAdminSupabaseClient();
  const insertedRows: Array<{ id: string; title: string }> = [];
  let skipped = 0;

  for (const todo of selectedTodos) {
    const userId = await resolveAssigneeUserId(todo.assigneeName, requestUserId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from('todos')
      .insert({
        title: todo.title,
        description: `회의록 자동 추출 (문서: ${docTitle})`,
        due_date: todo.dueDate ?? null,
        priority: todo.priority,
        status: 'active',
        user_id: userId,
      })
      .select('id, title')
      .single() as { data: { id: string; title: string } | null; error: unknown };

    if (error || !data) {
      console.error('[insert-todos] INSERT 실패:', error);
      skipped++;
    } else {
      insertedRows.push({ id: data.id, title: data.title });
    }
  }

  return {
    inserted: insertedRows.length,
    skipped,
    todos: insertedRows,
  };
}

/**
 * todo_extractions 이력 테이블에 저장 (FR-10 중복 방지 추적)
 */
export async function saveTodoExtractionHistory(
  documentId: string,
  extractedBy: string,
  todoIds: string[],
): Promise<void> {
  const admin = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('todo_extractions')
    .insert({
      document_id: documentId,
      extracted_by: extractedBy,
      todo_ids: todoIds,
      todo_count: todoIds.length,
    })
    .then(() => {}, (err: unknown) => {
      console.error('[todo-extractions] 이력 저장 실패:', err);
    });
}
