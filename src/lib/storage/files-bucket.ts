// 'files' 저장소 버킷 접근 단일 창구.
// storage.objects 는 RLS 정책 0개로 두어 사용자 세션(브라우저 REST 포함)의 직접 접근을 막는다.
// 서버는 앱 권한 확인(인증·RLS 행 조회·canDeleteFile 등)을 마친 뒤에만 이 헬퍼(service role)로 접근한다.
// (2026-11-14: 리전 이전 후 정책 부재로 사용자 세션 업로드·다운로드가 전부 실패하던 것을 이 방식으로 통일)
// DB 행(files/documents.storage_path, users.signature_path)에서 온 경로는 사용자가 위조할 수 있으므로,
// service role 로 읽기·삭제·서명URL 발급 전에 반드시 isAllowedStoragePath 로 종류별 접두사를 확인한다.
import { uuid } from '@/lib/attendance/date';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export const FILES_BUCKET = 'files';

export function filesBucket() {
  return createAdminSupabaseClient().storage.from(FILES_BUCKET);
}

export type StoragePathKind = 'file' | 'document' | 'signature';

// 종류별 허용 접두사 — 운영 데이터의 정상 경로 패턴(uploads/·attachments/·generated/·signatures/)
const ALLOWED_PREFIXES: Record<StoragePathKind, readonly string[]> = {
  file: ['uploads/', 'attachments/'],
  document: ['generated/'],
  signature: ['signatures/'],
};

// 상위 경로·백슬래시·인코딩된 . / 구분자·제어문자 — 정상 경로에는 나오지 않는다
const FORBIDDEN_PATTERN = /\.\.|\\|%2e|%2f|%5c|[\u0000-\u001f\u007f]/i;

/** 행에서 읽은 저장소 경로가 해당 종류의 정상 경로인지 확인한다. signature 는 userId 를 주면 본인 폴더만 허용. */
export function isAllowedStoragePath(
  path: unknown,
  kind: StoragePathKind,
  opts: { userId?: string } = {},
): path is string {
  if (typeof path !== 'string' || path.length === 0 || path.startsWith('/')) return false;
  if (FORBIDDEN_PATTERN.test(path)) return false;
  if (kind === 'signature' && opts.userId !== undefined) {
    return !!opts.userId && path.startsWith(`signatures/${opts.userId}/`) && path.length > `signatures/${opts.userId}/`.length;
  }
  return ALLOWED_PREFIXES[kind].some((prefix) => path.startsWith(prefix) && path.length > prefix.length);
}

/** 서버가 정한 소유자 폴더(prefix, 예: `autofill-temp/<userId>/`) 안의 경로인지 확인한다 — 사용자 수정 가능한 컬럼에서 온 경로용. */
export function isOwnedStoragePath(path: unknown, prefix: string): path is string {
  return typeof path === 'string' && !FORBIDDEN_PATTERN.test(path) && path.startsWith(prefix) && path.length > prefix.length;
}

/** 저장 경로의 파일명 조각으로 쓸 수 있게 경로 구분자·상위 경로·제어문자를 '_'로 바꾼다. */
export function safeFileNameSegment(name: string): string {
  return name.replace(/\.\.|[\\/]|[\u0000-\u001f\u007f]/g, '_');
}

/** 업로드 경로에 쓰일 부서 폴더명. 없으면 'general', UUID 가 아니면 null(→ 호출부에서 400). */
export function departmentFolder(departmentId: unknown): string | null {
  if (departmentId === undefined || departmentId === null || departmentId === '') return 'general';
  return uuid(departmentId) ? departmentId : null;
}

/** 행 경로 검사 + 실패 시 짧은 경고(행 id만 기록). 비어 있는 경로는 조용히 false — 호출부는 '파일 없음'으로 처리한다. */
export function checkRowStoragePath(
  path: unknown,
  kind: StoragePathKind,
  where: string,
  rowId: string | null | undefined,
  opts: { userId?: string } = {},
): path is string {
  if (isAllowedStoragePath(path, kind, opts)) return true;
  if (path) console.warn(`[${where}] 허용되지 않은 저장 경로 — 없는 파일로 처리 (id: ${rowId ?? '알 수 없음'})`);
  return false;
}
