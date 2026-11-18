/**
 * 검색 결과 본문 읽기 — AI 질의(chat)와 결과 'AI 요약'(search/summary)이 같은 규칙으로 쓴다.
 *
 * 결과 id 는 세 곳 중 하나다: 문서(documents) / 업로드·Gmail 파일(files + file_chunks) / 로컬 파일(local_file_index + local_file_chunks).
 * 권한은 검색이 결과를 거를 때와 같은 앱 규칙으로 판정한다 — 문서=getAccessibleDocumentIds, 파일=filterAccessibleFileRows(+Gmail 은 본인 것만),
 * 로컬=본인 것만(메신저 공유 file_shares 는 검색에도 안 나오므로 여기서도 보지 않는다). 사용자 세션(RLS: 본인·같은 부서)으로 읽으면 공유받은 문서·파일이 빠지고, 같은 부서 문서는 공유 없이 읽혔다.
 * 행은 service role 로 읽되 권한 판정을 통과한 id 의 본문만 돌려준다.
 * DB 오류는 던진다 — 빈 결과로 덮으면 '본문이 처리되지 않았다'는 엉뚱한 안내(재처리 유도)가 나간다.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripEmbeddedInputs } from '@/lib/documents/embedded-inputs';
import { filterAccessibleFileRows, getAccessibleDocumentIds } from '@/lib/permissions';

const DEFAULT_CHUNKS_PER_FILE = 4; // 여러 결과를 함께 읽을 때 파일마다 앞 청크 몇 개 — 한 파일이 문맥을 다 차지하지 않게

export interface ResultViewer {
  userId: string;
  role: string;
  departmentId: string | null;
}

export interface ResultText {
  id: string;
  name: string;
  text: string;
}

/** 조회 오류는 던지고 행만 돌려준다 */
function rowsOf<T>(res: { data: unknown; error: { message: string } | null }, what: string): T[] {
  if (res.error) throw new Error(`[result-content] ${what}: ${res.error.message}`);
  return (res.data ?? []) as T[];
}

/** 청크를 id 별로 chunk_index 순서대로 이어 붙인다 */
function joinChunks(rows: Array<{ owner: string; chunk_index: number; content: string }>): Map<string, string> {
  const sorted = [...rows].sort((a, b) => a.chunk_index - b.chunk_index);
  const byOwner = new Map<string, string[]>();
  for (const r of sorted) {
    const list = byOwner.get(r.owner) ?? [];
    list.push(r.content);
    byOwner.set(r.owner, list);
  }
  return new Map([...byOwner].map(([id, parts]) => [id, parts.join('\n')]));
}

async function loadDocuments(admin: SupabaseClient, viewer: ResultViewer, ids: string[]): Promise<ResultText[]> {
  const rows = rowsOf<{ id: string; title: string; content: string | null; created_by: string | null }>(
    await admin.from('documents').select('id, title, content, created_by').in('id', ids), 'documents');
  if (rows.length === 0) return [];
  // 공유 기록은 서버 권한으로 판정(문서 상세 canAccessDocument 와 같은 기준)
  const allowed = await getAccessibleDocumentIds(admin, viewer.userId, viewer.role, viewer.departmentId, rows);
  return rows
    .filter((d) => allowed.has(d.id))
    .map((d) => ({ id: d.id, name: d.title, text: stripEmbeddedInputs(d.content ?? '').trim() })); // 내부 입력값 주석 제외
}

async function loadFiles(admin: SupabaseClient, user: SupabaseClient, viewer: ResultViewer, ids: string[], chunks: number): Promise<ResultText[]> {
  const rows = rowsOf<{ id: string; name: string; uploaded_by: string | null; department_id: string | null; source: string | null }>(
    await admin.from('files').select('id, name, uploaded_by, department_id, source').in('id', ids), 'files');
  if (rows.length === 0) return [];
  const accessible = (await filterAccessibleFileRows(user, viewer.userId, viewer.role, viewer.departmentId, rows))
    // Gmail 메일은 본인이 동기화한 것만(검색 노출 규칙과 같음)
    .filter((f) => f.source !== 'gmail' || f.uploaded_by === viewer.userId);
  if (accessible.length === 0) return [];
  const chunkRows = rowsOf<{ file_id: string; chunk_index: number; content: string }>(
    await admin.from('file_chunks').select('file_id, chunk_index, content')
      .in('file_id', accessible.map((f) => f.id)).lt('chunk_index', chunks), 'file_chunks');
  const texts = joinChunks(chunkRows
    .map((c) => ({ owner: c.file_id, chunk_index: c.chunk_index, content: c.content })));
  return accessible.map((f) => ({ id: f.id, name: f.name, text: (texts.get(f.id) ?? '').trim() }));
}

async function loadLocalFiles(user: SupabaseClient, viewer: ResultViewer, ids: string[], chunks: number): Promise<ResultText[]> {
  const rows = rowsOf<{ id: string; file_name: string }>(
    await user.from('local_file_index').select('id, file_name').in('id', ids).eq('user_id', viewer.userId), 'local_file_index');
  if (rows.length === 0) return [];
  const chunkRows = rowsOf<{ local_file_id: string; chunk_index: number; content: string }>(
    await user.from('local_file_chunks').select('local_file_id, chunk_index, content')
      .in('local_file_id', rows.map((r) => r.id)).lt('chunk_index', chunks), 'local_file_chunks');
  const texts = joinChunks(chunkRows
    .map((c) => ({ owner: c.local_file_id, chunk_index: c.chunk_index, content: c.content })));
  return rows.map((r) => ({ id: r.id, name: r.file_name, text: (texts.get(r.id) ?? '').trim() }));
}

/**
 * 볼 수 있는 결과만, 넘겨받은 id 순서대로. 본문이 빈 결과도 돌려준다(이름은 있고 내용 처리가 안 된 파일 안내용).
 * 볼 수 없거나 없는 id 는 빠진다(존재 여부를 드러내지 않음).
 */
export async function loadResultTexts(
  admin: SupabaseClient,
  user: SupabaseClient,
  viewer: ResultViewer,
  ids: string[],
  chunksPerFile = DEFAULT_CHUNKS_PER_FILE,
): Promise<ResultText[]> {
  if (ids.length === 0) return [];
  // id 는 UUID 라 세 출처가 겹치지 않는다 → 순서대로 기다리지 않고 함께 조회
  const [docs, files, locals] = await Promise.all([
    loadDocuments(admin, viewer, ids),
    loadFiles(admin, user, viewer, ids, chunksPerFile),
    loadLocalFiles(user, viewer, ids, chunksPerFile),
  ]);
  const byId = new Map<string, ResultText>([...docs, ...files, ...locals].map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is ResultText => !!r);
}
