'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  saveDirectoryHandle,
  loadDirectoryHandle,
  clearDirectoryHandle,
  checkPermission,
  requestPermission,
  isFileSystemAccessSupported,
  hashBuffer,
  collectFiles,
} from '@/lib/local-file-index-db';
import { useAuthStore } from '@/store/auth-store';

export type SyncStatus = 'idle' | 'connecting' | 'requesting-permission' | 'syncing' | 'ready' | 'error' | 'unsupported';

export interface SyncProgress {
  current: number;
  total: number;
  currentFileName: string;
}

export interface LocalSyncState {
  status: SyncStatus;
  folderName: string | null;
  lastSynced: Date | null;
  indexedCount: number;
  progress: SyncProgress | null;
  errorMessage: string | null;
}

interface ElectronAPI {
  isElectron: boolean;
  openFolderDialog: () => Promise<string | null>;
  getFolderPath: () => Promise<string | null>;
  setFolderPath: (p: string) => Promise<boolean>;
  listFiles: (folderPath: string) => Promise<Array<{ name: string; path: string; absolutePath: string }>>;
  readFile: (absolutePath: string) => Promise<{ ok: boolean; data?: string; size?: number; error?: string }>;
  stat: (absolutePath: string) => Promise<{ ok: boolean; lastModified?: number; size?: number }>;
}

function getElectronAPI(): ElectronAPI | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { electronAPI?: ElectronAPI }).electronAPI ?? null;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const bin = atob(base64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

const INITIAL_STATE: LocalSyncState = {
  status: 'idle',
  folderName: null,
  lastSynced: null,
  indexedCount: 0,
  progress: null,
  errorMessage: null,
};

export function useLocalFileSync() {
  const { user } = useAuthStore();
  const userId = user?.id ?? null;

  const [state, setState] = useState<LocalSyncState>(INITIAL_STATE);
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [serverHashes, setServerHashes] = useState<Record<string, string>>({});

  const updateState = (partial: Partial<LocalSyncState>) =>
    setState((prev) => ({ ...prev, ...partial }));

  useEffect(() => {
    if (!userId) return;
    const eAPI = getElectronAPI();
    if (eAPI) {
      void restoreElectron(eAPI);
    } else if (!isFileSystemAccessSupported()) {
      updateState({ status: 'unsupported' });
    } else {
      void restoreHandle();
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadIndexedCount = useCallback(async () => {
    const res = await fetch('/api/local-files/list');
    if (!res.ok) return;
    const data = await res.json() as { files: Array<{ file_path: string; file_hash?: string }> };
    const hashes: Record<string, string> = {};
    (data.files ?? []).forEach((f) => { if (f.file_hash) hashes[f.file_path] = f.file_hash; });
    setServerHashes(hashes);
    updateState({ indexedCount: data.files?.length ?? 0 });
  }, []);

  /* ── Electron 복원 ── */
  const restoreElectron = async (eAPI: ElectronAPI) => {
    updateState({ status: 'connecting' });
    const savedPath = await eAPI.getFolderPath();
    if (savedPath) {
      const folderName = savedPath.split('/').pop() ?? savedPath;
      await loadIndexedCount();
      updateState({ status: 'ready', folderName });
    } else {
      updateState({ status: 'idle' });
    }
  };

  /* ── 웹 복원 ── */
  const restoreHandle = async () => {
    if (!userId) return;
    updateState({ status: 'connecting' });
    try {
      const saved = await loadDirectoryHandle(userId);
      if (!saved) { updateState({ status: 'idle' }); return; }
      const perm = await checkPermission(saved);
      if (perm === 'granted') {
        setHandle(saved);
        await loadIndexedCount();
        updateState({ status: 'ready', folderName: saved.name });
      } else if (perm === 'prompt') {
        setHandle(saved);
        updateState({ status: 'requesting-permission', folderName: saved.name });
      } else {
        updateState({ status: 'idle' });
      }
    } catch {
      updateState({ status: 'idle' });
    }
  };

  /* ── 연결 ── */
  const connect = useCallback(async () => {
    if (!userId) return;
    const eAPI = getElectronAPI();

    if (eAPI) {
      const folderPath = await eAPI.openFolderDialog();
      if (!folderPath) return;
      const folderName = folderPath.split('/').pop() ?? folderPath;
      await loadIndexedCount();
      updateState({ status: 'ready', folderName, errorMessage: null });
      void sync(); // 연결 후 자동 동기화
    } else {
      try {
        const dir = await window.showDirectoryPicker({ mode: 'read' });
        await saveDirectoryHandle(userId, dir);
        setHandle(dir);
        await loadIndexedCount();
        updateState({ status: 'ready', folderName: dir.name, errorMessage: null });
        void sync(dir); // 연결 후 자동 동기화 (handle 상태 반영 전에 dir 직접 전달)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          updateState({ status: 'error', errorMessage: '폴더 연결에 실패했습니다.' });
        }
      }
    }
  }, [userId, loadIndexedCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const grantPermission = useCallback(async () => {
    if (!handle) return;
    const perm = await requestPermission(handle);
    if (perm === 'granted') {
      await loadIndexedCount();
      updateState({ status: 'ready' });
    } else {
      updateState({ status: 'error', errorMessage: '접근 권한이 거부되었습니다.' });
    }
  }, [handle, loadIndexedCount]);

  /* ── 동기화 ── */
  const sync = useCallback(async (overrideHandle?: FileSystemDirectoryHandle) => {
    if (!userId) return;
    const eAPI = getElectronAPI();
    updateState({ status: 'syncing', errorMessage: null, progress: null });

    try {
      if (eAPI) {
        await syncElectron(eAPI);
      } else {
        const activeHandle = overrideHandle ?? handle;
        if (!activeHandle) return;
        await syncWeb(activeHandle);
      }
      await loadIndexedCount();
      updateState({ status: 'ready', lastSynced: new Date(), progress: null });
    } catch (e) {
      updateState({ status: 'error', errorMessage: (e as Error).message, progress: null });
    }
  }, [handle, userId, serverHashes, loadIndexedCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncElectron = async (eAPI: ElectronAPI) => {
    const folderPath = await eAPI.getFolderPath();
    if (!folderPath) throw new Error('폴더 경로가 없습니다.');
    const files = await eAPI.listFiles(folderPath);
    const newHashes: Record<string, string> = { ...serverHashes };
    let processed = 0;

    for (const fileInfo of files) {
      updateState({ progress: { current: processed, total: files.length, currentFileName: fileInfo.name } });

      const statRes = await eAPI.stat(fileInfo.absolutePath);
      const readRes = await eAPI.readFile(fileInfo.absolutePath);
      if (!readRes.ok || !readRes.data) { processed++; continue; }

      const buffer = base64ToArrayBuffer(readRes.data);
      const hash = await hashBuffer(buffer);
      if (serverHashes[fileInfo.path] === hash) { processed++; continue; }

      const ext = fileInfo.name.split('.').pop()?.toLowerCase() ?? '';
      const form = new FormData();
      form.append('file', new File([buffer], fileInfo.name, { type: `application/${ext}` }));
      form.append('filePath', fileInfo.path);
      form.append('fileHash', hash);
      if (statRes.ok && statRes.lastModified) form.append('lastModified', String(statRes.lastModified));

      const res = await fetch('/api/local-files/process', { method: 'POST', body: form });
      if (res.ok) newHashes[fileInfo.path] = hash;
      processed++;
    }
    setServerHashes(newHashes);
  };

  const syncWeb = async (dir: FileSystemDirectoryHandle) => {
    const files = await collectFiles(dir);
    const newHashes: Record<string, string> = { ...serverHashes };
    let processed = 0;

    for (const { handle: fileHandle, path } of files) {
      updateState({ progress: { current: processed, total: files.length, currentFileName: fileHandle.name } });
      const file = await fileHandle.getFile();
      const buffer = await file.arrayBuffer();
      const hash = await hashBuffer(buffer);
      if (serverHashes[path] === hash) { processed++; continue; }

      const form = new FormData();
      form.append('file', new File([buffer], file.name, { type: file.type }));
      form.append('filePath', path);
      form.append('fileHash', hash);
      form.append('lastModified', String(file.lastModified));

      const res = await fetch('/api/local-files/process', { method: 'POST', body: form });
      if (res.ok) newHashes[path] = hash;
      processed++;
    }
    setServerHashes(newHashes);
  };

  /* ── 해제 ── */
  const disconnect = useCallback(async () => {
    if (!userId) return;
    const eAPI = getElectronAPI();
    if (eAPI) {
      await eAPI.setFolderPath('');
    } else {
      await clearDirectoryHandle(userId);
    }
    setHandle(null);
    setServerHashes({});
    setState({ ...INITIAL_STATE, status: 'idle' });
  }, [userId]);

  return { state, connect, grantPermission, sync, disconnect };
}
