/**
 * POST /api/todos/extract
 * 기존 회의록 document_id 기반 재추출 + 선택된 항목 todos 테이블 일괄 INSERT
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import {
  extractTodosFromText,
  insertExtractedTodos,
  saveTodoExtractionHistory,
  type ExtractedTodo,
} from '@/lib/ai/extract-todos';
import { canAccessDocument, getUserRoleInfo } from '@/lib/permissions';

export const maxDuration = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DocRow = { id: string; title: string; content: string | null; created_by: string };

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'AI 서비스가 설정되지 않았습니다.' }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
  }

  const authUserId = await getAuthUserId(supabase);
  if (!authUserId) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const roleInfo = await getUserRoleInfo(supabase, authUserId);
  if (!roleInfo) {
    return NextResponse.json({ error: '사용자 정보가 없습니다.' }, { status: 403 });
  }

  let body: { documentId?: string; selectedTodos?: ExtractedTodo[]; reExtract?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const { documentId, selectedTodos, reExtract = false } = body;

  if (!documentId || typeof documentId !== 'string') {
    return NextResponse.json({ error: 'documentId는 필수입니다.' }, { status: 400 });
  }

  if (!UUID_RE.test(documentId)) {
    return NextResponse.json({ error: '유효하지 않은 documentId입니다.' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  // ── 문서 조회 ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc, error: docError } = await (admin as any)
    .from('documents')
    .select('id, title, content, created_by')
    .eq('id', documentId)
    .single() as { data: DocRow | null; error: unknown };

  if (docError || !doc) {
    return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
  }

  const canAccess = await canAccessDocument(supabase, authUserId, roleInfo.role, roleInfo.department_id, documentId);
  if (!canAccess) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const content = doc.content?.trim() ?? '';
  if (!content) {
    return NextResponse.json({ error: '문서 내용이 없어 할일을 추출할 수 없습니다.' }, { status: 422 });
  }

  // ── 재추출 모드: GPT-4o 호출 후 추출 결과만 반환 ──────────────────────────
  if (reExtract) {
    const extractedTodos = await extractTodosFromText(content);
    return NextResponse.json({ success: true, data: { extractedTodos } });
  }

  // ── 등록 모드: 선택된 항목 todos INSERT ───────────────────────────────────
  if (!Array.isArray(selectedTodos) || selectedTodos.length === 0) {
    return NextResponse.json({ error: '등록할 할일을 선택해주세요.' }, { status: 400 });
  }

  const result = await insertExtractedTodos(selectedTodos, doc.title, authUserId);

  if (result.inserted > 0) {
    await saveTodoExtractionHistory(
      documentId,
      authUserId,
      result.todos.map((t) => t.id),
    );
  }

  return NextResponse.json({ success: true, data: result });
}
