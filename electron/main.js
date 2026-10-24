const { app, BrowserWindow, ipcMain, shell, dialog, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CLIO_URL = 'https://clioai.vercel.app';
const HEARTBEAT_INTERVAL_MS = 180_000; // 3분 (설계서 §4.1) — main이 타이머 소유자, renderer가 실제 HTTP 수행

let mainWindow = null;
let heartbeatTimer = null;
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

  // 페이지 로드 완료 시 heartbeat 타이머 (재)시작. 로그인/네비게이션마다 호출되나
  // startHeartbeat가 기존 타이머를 먼저 정리하므로 중복되지 않는다.
  mainWindow.webContents.on('did-finish-load', () => startHeartbeat());

  mainWindow.on('closed', () => {
    stopHeartbeat();
    mainWindow = null;
  });
}

/* ── heartbeat (설계서 §4.1 · §119~121) ──
 * main이 3분 타이머 소유자다. tick만 renderer로 보내고, 실제 POST는 renderer가
 * 쿠키+CSRF로 수행한다. 세션/서비스키를 main·preload에 저장·복사하지 않는다. */
function sendHeartbeatTick() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const wc = mainWindow.webContents;
  // 승인된 웹앱 출처가 로드된 상태에서만 tick 송신 (설계 §120)
  if (!wc.getURL().startsWith(CLIO_URL)) return;
  wc.send('attendance:heartbeat-tick');
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeatTick, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/* ── 자동실행 (설계서 §4.1 §426) ── 설치 앱(packaged)에서만 지원. 개발 실행과 구분.
 *
 * ⚠️ macOS 13+(Tahoe 포함)의 app.setLoginItemSettings는 내부적으로 SMAppService를 쓰며
 * '코드 서명된 앱'을 요구한다. 미서명 배포(현재 CLIO)에서는 등록이 거부되어 status가
 * 'not-found'로 '조용히 실패'한다(실측: write(true) 직후에도 status=not-found, 재부팅 시
 * 자동실행 안 됨). 따라서 macOS는 setLoginItemSettings 대신
 * ~/Library/LaunchAgents/kr.clio.desktop.plist 를 직접 생성/삭제하는 구식 launchd 방식으로
 * 등록한다. 서명 없이 동작하며, 로그인 시 launchd가 LaunchAgents 폴더의 plist를 자동 로드한다.
 * 상태(read)는 plist 파일 존재로 판정한다(즉시 반영, UI 되돌아감 없음).
 * Windows 등은 기존 setLoginItemSettings가 정상 동작하므로 유지한다.
 * 실제 OS 반영값은 auto-launch.log로 남겨 실기기에서 확정 검증한다(추측 금지). */

const AUTO_LAUNCH_LABEL = 'kr.clio.desktop'; // build.appId와 동일

// userData/auto-launch.log 에 실측 스냅샷 기록 (기능에 영향 주지 않는 보조 진단)
function logAutoLaunch(action, snapshot) {
  try {
    const line = `[${new Date().toISOString()}] ${action} ${JSON.stringify(snapshot)}\n`;
    fs.appendFileSync(path.join(app.getPath('userData'), 'auto-launch.log'), line);
  } catch {
    /* 로그 실패는 무시 */
  }
}

// ── macOS: LaunchAgent(plist) 방식 ──
function macLaunchAgentPath() {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${AUTO_LAUNCH_LABEL}.plist`);
}

// 설치된 .app 번들 경로 (exe = …/CLIO.app/Contents/MacOS/CLIO → …/CLIO.app)
function macAppBundlePath() {
  const exe = app.getPath('exe');
  const marker = '/Contents/MacOS/';
  const idx = exe.indexOf(marker);
  return idx === -1 ? null : exe.slice(0, idx);
}

// open -a 로 .app 을 띄운다(이미 실행 중이면 중복 실행 안 함, Dock 정상)
function macBuildPlist(appBundle) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '  <key>Label</key>',
    `  <string>${AUTO_LAUNCH_LABEL}</string>`,
    '  <key>ProgramArguments</key>',
    '  <array>',
    '    <string>/usr/bin/open</string>',
    '    <string>-a</string>',
    `    <string>${appBundle}</string>`,
    '  </array>',
    '  <key>RunAtLoad</key>',
    '  <true/>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
}

function macReadAutoLaunch() {
  const p = macLaunchAgentPath();
  const enabled = fs.existsSync(p);
  logAutoLaunch('read', { enabled, status: enabled ? 'plist-present' : 'plist-absent', path: p });
  return { openAtLogin: enabled, supported: true, requiresApproval: false };
}

function macWriteAutoLaunch(enabled) {
  const p = macLaunchAgentPath();
  const appBundle = macAppBundlePath();
  if (enabled && !appBundle) {
    logAutoLaunch('write-error', { message: 'app bundle path not resolved', exe: app.getPath('exe') });
    return { openAtLogin: false, supported: false };
  }
  if (enabled) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, macBuildPlist(appBundle), 'utf8');
  } else if (fs.existsSync(p)) {
    fs.unlinkSync(p);
  }
  const nowEnabled = fs.existsSync(p);
  logAutoLaunch(`write(${!!enabled})`, {
    enabled: nowEnabled,
    status: nowEnabled ? 'plist-present' : 'plist-absent',
    appBundle,
  });
  return { openAtLogin: nowEnabled, supported: true, requiresApproval: false };
}

// ── Windows 등: 기존 setLoginItemSettings (정상 동작) ──
function nativeReadAutoLaunch() {
  const s = app.getLoginItemSettings();
  logAutoLaunch('read', { openAtLogin: s.openAtLogin, status: s.status ?? null });
  return { openAtLogin: s.openAtLogin, supported: true, requiresApproval: false };
}

function nativeWriteAutoLaunch(enabled) {
  app.setLoginItemSettings({ openAtLogin: !!enabled });
  const s = app.getLoginItemSettings();
  logAutoLaunch(`write(${!!enabled})`, { openAtLogin: s.openAtLogin, status: s.status ?? null });
  return { openAtLogin: s.openAtLogin, supported: true, requiresApproval: false };
}

function readAutoLaunch() {
  if (!app.isPackaged) return { openAtLogin: false, supported: false };
  try {
    return process.platform === 'darwin' ? macReadAutoLaunch() : nativeReadAutoLaunch();
  } catch (e) {
    logAutoLaunch('read-error', { message: String(e && e.message) });
    return { openAtLogin: false, supported: false };
  }
}

function writeAutoLaunch(enabled) {
  if (!app.isPackaged) return { openAtLogin: false, supported: false };
  try {
    return process.platform === 'darwin' ? macWriteAutoLaunch(enabled) : nativeWriteAutoLaunch(enabled);
  } catch (e) {
    logAutoLaunch('write-error', { message: String(e && e.message) });
    return { openAtLogin: false, supported: false };
  }
}

/* IPC sender가 승인된 클리오 출처인지 검증 (설계 §120) */
function isClioSender(event) {
  try {
    const url = event.senderFrame?.url ?? '';
    return url.startsWith(CLIO_URL);
  } catch {
    return false;
  }
}

// 단일 인스턴스 락 — 타이머 중복(출퇴근 이중 송신) 방지 (설계 §121)
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  // 두 번째 실행 시도 시 기존 창을 활성화
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    // 절전/화면잠금 중엔 tick 중단, 복귀 시 재개 + 즉시 1회 (설계 §4.1 절전/계정전환 처리)
    powerMonitor.on('suspend', stopHeartbeat);
    powerMonitor.on('resume', () => {
      startHeartbeat();
      sendHeartbeatTick();
    });
    powerMonitor.on('lock-screen', stopHeartbeat);
    powerMonitor.on('unlock-screen', () => {
      startHeartbeat();
      sendHeartbeatTick();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    stopHeartbeat();
    if (process.platform !== 'darwin') app.quit();
  });

  // 정상 종료 시 renderer가 마지막 heartbeat(퇴근시각 확정)를 보낼 짧은 시간을 준다.
  // 강제종료·방전 등으로 신호가 없어도 서버는 마지막 수신 heartbeat를 퇴근으로 쓰므로 안전망이 있다.
  let isQuittingAttendance = false;
  app.on('before-quit', (e) => {
    if (isQuittingAttendance) return;
    const wc = mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null;
    if (!wc || !wc.getURL().startsWith(CLIO_URL)) return;
    e.preventDefault();
    isQuittingAttendance = true;
    wc.send('attendance:app-quitting');
    setTimeout(() => app.quit(), 800);
  });

  /* ── IPC 핸들러 ── */

  // 자동실행 상태 조회/변경 (sender 출처 검증 후에만)
  ipcMain.handle('attendance:getAutoLaunch', (event) => {
    if (!isClioSender(event)) return { openAtLogin: false, supported: false };
    return readAutoLaunch();
  });

  ipcMain.handle('attendance:setAutoLaunch', (event, enabled) => {
    if (!isClioSender(event)) return { openAtLogin: false, supported: false };
    return writeAutoLaunch(enabled);
  });

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

  ipcMain.handle('fs:listFiles', (_, folderPath) => {
    try {
      return walkDir(folderPath);
    } catch {
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
}

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
