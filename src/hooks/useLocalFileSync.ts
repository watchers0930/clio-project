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
  // 서버에서 인덱싱된 파일의 hash 맵 (path → hash)
  const [serverHashes, setServerHashes] = useState<Record<string, string>>({});

  const updateState = (partial: Partial<LocalSyncState>) =>
    setState((prev) => ({ ...prev, ...partial }));

  // 앱 로드 시 저장된 핸들 복원
  useEffect(() => {
    if (!userId || !isFileSystemAccessSupported()) {
      if (!isFileSystemAccessSupported()) updateState({ status: 'unsupported' });
      return;
    }
    void restoreHandle();
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

  const connect = useCallback(async () => {
    if (!userId) return;
    try {
      const dir = await window.showDirectoryPicker({ mode: 'read' });
      await saveDirectoryHandle(userId, dir);
      setHandle(dir);
      await loadIndexedCount();
      updateState({ status: 'ready', folderName: dir.name, errorMessage: null });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        updateState({ status: 'error', errorMessage: '폴더 연결에 실패했습니다.' });
      }
    }
  }, [userId, loadIndexedCount]);

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

  const sync = useCallback(async () => {
    if (!handle || !userId) return;
    updateState({ status: 'syncing', errorMessage: null, progress: null });

    try {
      const files = await collectFiles(handle);
      const toProcess = files.filter((f) => {
        const prev = serverHashes[f.path];
        return !prev; // hash 비교는 파일 읽기 후 수행
      });

      let processed = 0;
      const newHashes: Record<string, string> = { ...serverHashes };

      for (const { handle: fileHandle, path } of files) {
        updateState({ progress: { current: processed, total: files.length, currentFileName: fileHandle.name } });

        const file = await fileHandle.getFile();
        const buffer = await file.arrayBuffer();
        const hash = await hashBuffer(buffer);

        // 변경 없으면 스킵
        if (serverHashes[path] === hash) {
          processed++;
          continue;
        }

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
      await loadIndexedCount();
      updateState({
        status: 'ready',
        lastSynced: new Date(),
        progress: null,
      });
    } catch (e) {
      updateState({ status: 'error', errorMessage: (e as Error).message, progress: null });
    }
  }, [handle, userId, serverHashes, loadIndexedCount]);

  const disconnect = useCallback(async () => {
    if (!userId) return;
    await clearDirectoryHandle(userId);
    setHandle(null);
    setServerHashes({});
    updateState({ ...INITIAL_STATE, status: 'idle' });
  }, [userId]);

  return { state, connect, grantPermission, sync, disconnect };
}
