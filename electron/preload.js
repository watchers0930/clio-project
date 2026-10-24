const { contextBridge, ipcRenderer } = require('electron');

// heartbeat tick 구독 콜백 매핑 (off 시 동일 참조로 해제하기 위해 보관)
const heartbeatListeners = new Map();
// app-quitting(정상 종료 직전) 구독 콜백 매핑
const quitListeners = new Map();

contextBridge.exposeInMainWorld('electronAPI', {
  // 파일을 네이티브 앱(한글, Word 등)으로 열기
  openFile: (absolutePath) => ipcRenderer.invoke('file:open', absolutePath),

  // 파인더/탐색기에서 파일 위치 열기
  showInFolder: (absolutePath) => ipcRenderer.invoke('file:showInFolder', absolutePath),

  // 폴더 선택 다이얼로그 (절대 경로 반환)
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),

  // 저장된 폴더 경로
  getFolderPath: () => ipcRenderer.invoke('folder:getPath'),
  setFolderPath: (p) => ipcRenderer.invoke('folder:setPath', p),

  // 파일 시스템 (Node.js 기반, Web API 대체)
  listFiles: (folderPath) => ipcRenderer.invoke('fs:listFiles', folderPath),
  readFile: (absolutePath) => ipcRenderer.invoke('fs:readFile', absolutePath),
  stat: (absolutePath) => ipcRenderer.invoke('fs:stat', absolutePath),

  // 근태 heartbeat (설계서 §4.1) — main이 보내는 tick 구독 + 자동실행 제어
  attendance: {
    // main의 3분 tick 구독. cb는 인자 없이 호출된다(이벤트 객체 미노출).
    onHeartbeatTick: (cb) => {
      if (typeof cb !== 'function') return;
      const listener = () => cb();
      heartbeatListeners.set(cb, listener);
      ipcRenderer.on('attendance:heartbeat-tick', listener);
    },
    offHeartbeatTick: (cb) => {
      const listener = heartbeatListeners.get(cb);
      if (listener) {
        ipcRenderer.removeListener('attendance:heartbeat-tick', listener);
        heartbeatListeners.delete(cb);
      }
    },
    // 정상 종료 직전 신호 구독(renderer가 마지막 heartbeat=퇴근시각을 전송)
    onAppQuitting: (cb) => {
      if (typeof cb !== 'function') return;
      const listener = () => cb();
      quitListeners.set(cb, listener);
      ipcRenderer.on('attendance:app-quitting', listener);
    },
    offAppQuitting: (cb) => {
      const listener = quitListeners.get(cb);
      if (listener) {
        ipcRenderer.removeListener('attendance:app-quitting', listener);
        quitListeners.delete(cb);
      }
    },
    // 자동실행 상태 조회/변경 → { openAtLogin, supported }
    getAutoLaunch: () => ipcRenderer.invoke('attendance:getAutoLaunch'),
    setAutoLaunch: (enabled) => ipcRenderer.invoke('attendance:setAutoLaunch', enabled),
  },

  // Electron 여부 식별
  isElectron: true,
  platform: process.platform,
});
