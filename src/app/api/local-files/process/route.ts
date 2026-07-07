import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { extractText } from '@/lib/ai/extract-text';
import { chunkText } from '@/lib/ai/chunk-text';
import OpenAI from 'openai';

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 100;

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
}

async function batchEmbeddings(texts: string[]): Promise<number[][]> {
  const openai = getOpenAI();
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });
  return res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

const sanitize = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });
  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const filePath = formData.get('filePath') as string | null;
  const fileHash = formData.get('fileHash') as string | null;
  const lastModified = formData.get('lastModified') as string | null;

  if (!file || !filePath || !fileHash) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = file.type || `application/${ext}`;

  let text = '';
  try {
    text = await extractText(buffer, mimeType, file.name);
  } catch {
    return NextResponse.json({ error: `텍스트 추출 실패: ${file.name}` }, { status: 422 });
  }

  if (!text.trim()) {
    return NextResponse.json({ error: '추출된 텍스트 없음' }, { status: 422 });
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return NextResponse.json({ error: '청킹 결과 없음' }, { status: 422 });
  }

  // upsert local_file_index
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const indexTable = (supabase as any).from('local_file_index');
  const { data: indexRow, error: indexErr } = await indexTable
    .upsert({
      user_id: userId,
      file_name: file.name,
      file_path: filePath,
      file_type: ext.toUpperCase(),
      file_hash: fileHash,
      file_size: file.size,
      last_modified: lastModified ? Number(lastModified) : null,
      last_synced_at: new Date().toISOString(),
      chunk_count: chunks.length,
    }, { onConflict: 'user_id,file_path' })
    .select('id')
    .single();

  if (indexErr || !indexRow) {
    return NextResponse.json({ error: '인덱스 저장 실패' }, { status: 500 });
  }

  // 기존 청크 삭제
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('local_file_chunks').delete().eq('local_file_id', indexRow.id);

  // 배치 임베딩 + 저장
  let stored = 0;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddings = await batchEmbeddings(batch.map((c) => c.content));
    const rows = batch.map((chunk, j) => ({
      local_file_id: indexRow.id,
      chunk_index: chunk.index,
      content: sanitize(chunk.content),
      embedding: JSON.stringify(embeddings[j]),
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('local_file_chunks').insert(rows);
    if (!error) stored += batch.length;
    if (i + BATCH_SIZE < chunks.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return NextResponse.json({ id: indexRow.id, stored, total: chunks.length });
}
