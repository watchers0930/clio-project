'use client';

const DB_NAME = 'clio-local-sync';
const DB_VERSION = 1;
const STORE = 'handles';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDirectoryHandle(userId: string, handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(handle, userId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadDirectoryHandle(userId: string): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(userId);
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearDirectoryHandle(userId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(userId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function checkPermission(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
  return handle.queryPermission({ mode: 'read' });
}

export async function requestPermission(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
  return handle.requestPermission({ mode: 'read' });
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/** 파일 ArrayBuffer → SHA-256 hex hash */
export async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const SUPPORTED_EXTS = new Set(['pdf', 'docx', 'hwp', 'hwpx', 'xlsx', 'pptx', 'txt', 'md', 'csv']);

export function isSupportedFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return SUPPORTED_EXTS.has(ext);
}

/** 디렉토리 재귀 탐색 → FileSystemFileHandle[] */
export async function collectFiles(
  dir: FileSystemDirectoryHandle,
  basePath = '',
): Promise<Array<{ handle: FileSystemFileHandle; path: string }>> {
  const results: Array<{ handle: FileSystemFileHandle; path: string }> = [];
  for await (const [name, entry] of dir.entries()) {
    if (name.startsWith('.')) continue;
    const entryPath = basePath ? `${basePath}/${name}` : name;
    if (entry.kind === 'file' && isSupportedFile(name)) {
      results.push({ handle: entry as FileSystemFileHandle, path: entryPath });
    } else if (entry.kind === 'directory') {
      const sub = await collectFiles(entry as FileSystemDirectoryHandle, entryPath);
      results.push(...sub);
    }
  }
  return results;
}
