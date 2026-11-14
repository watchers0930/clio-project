// 행 삭제 후 저장소 파일(blob) 정리 — 문서·파일을 지워도 저장소 파일이 남던 고아 누적을 막는다.
// 버전 문서가 같은 storage_path 를 공유하거나 문서가 업로드 원본을 가리킬 수 있고, 위조된 행이 남의 경로를 가리킬 수도 있으므로
// 종류별 정상 경로 중 삭제 후에도 어떤 문서·파일도 참조하지 않는 것만 지운다. 참조 확인에 실패하면 지우지 않는다(비파괴).
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { filesBucket, isAllowedStoragePath, type StoragePathKind } from '@/lib/storage/files-bucket';

/** 삭제가 끝난 행들의 storage_path 를 받아, 더 이상 참조되지 않는 정상 경로만 저장소에서 지운다. 실패는 로그만 남긴다. */
export async function removeUnreferencedBlobs(
  paths: Array<string | null | undefined>,
  kind: Exclude<StoragePathKind, 'signature'>,
): Promise<void> {
  const candidates = [...new Set(paths.filter((p): p is string => isAllowedStoragePath(p, kind)))];
  if (candidates.length === 0) return;

  const admin = createAdminSupabaseClient();
  const [docs, files] = await Promise.all([
    admin.from('documents').select('storage_path').in('storage_path', candidates),
    admin.from('files').select('storage_path').in('storage_path', candidates),
  ]);
  if (docs.error || files.error) {
    console.error('[blob-cleanup] 참조 확인 실패 — 정리 생략:', docs.error?.message ?? files.error?.message);
    return;
  }

  const stillReferenced = new Set([...(docs.data ?? []), ...(files.data ?? [])].map((row) => row.storage_path));
  const removable = candidates.filter((path) => !stillReferenced.has(path));
  if (removable.length === 0) return;

  const { error } = await filesBucket().remove(removable);
  if (error) console.error('[blob-cleanup] 저장소 삭제 실패:', error.message);
}
