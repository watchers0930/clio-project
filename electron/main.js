const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const CLIO_URL = 'https://clioai.vercel.app';

let mainWindow = null;
// 연결된 로컬 폴더 절대 경로 (main process에서 관리)
let localFolderPath = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'CLIO',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(CLIO_URL);

  // 외부 링크는 기본 브라우저로
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(CLIO_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ── IPC 핸들러 ── */

// 파일을 네이티브 앱으로 열기
ipcMain.handle('file:open', async (_, absolutePath) => {
  const err = await shell.openPath(absolutePath);
  return { ok: !err, error: err || null };
});

// 파인더/탐색기에서 파일 위치 열기
ipcMain.handle('file:showInFolder', (_, absolutePath) => {
  shell.showItemInFolder(absolutePath);
  return { ok: true };
});

// 로컬 폴더 선택 다이얼로그 (절대 경로 반환)
ipcMain.handle('dialog:openFolder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '로컬 폴더 선택',
  });
  if (canceled || !filePaths.length) return null;
  localFolderPath = filePaths[0];
  return localFolderPath;
});

// 저장된 폴더 경로 반환
ipcMain.handle('folder:getPath', () => localFolderPath);

// 폴더 경로 저장 (앱 재시작 시 복원용)
ipcMain.handle('folder:setPath', (_, p) => {
  localFolderPath = p;
  return true;
});

// 디렉토리 재귀 탐색 (Node.js fs 사용)
const SUPPORTED = new Set(['pdf', 'docx', 'hwp', 'hwpx', 'xlsx', 'pptx', 'txt', 'md', 'csv']);

function walkDir(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(abs, rel));
    } else {
      const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
      if (SUPPORTED.has(ext)) results.push({ name: entry.name, path: rel, absolutePath: abs });
    }
  }
  return results;
}

ipcMain.handle('fs:listFiles', (_, folderPath) => {
  try {
    return walkDir(folderPath);
  } catch (e) {
    return [];
  }
});

// 파일 읽기 (Buffer → base64로 전달)
ipcMain.handle('fs:readFile', async (_, absolutePath) => {
  try {
    const buf = fs.readFileSync(absolutePath);
    return { ok: true, data: buf.toString('base64'), size: buf.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 파일 수정일 조회
ipcMain.handle('fs:stat', (_, absolutePath) => {
  try {
    const stat = fs.statSync(absolutePath);
    return { ok: true, lastModified: stat.mtimeMs, size: stat.size };
  } catch {
    return { ok: false };
  }
});
