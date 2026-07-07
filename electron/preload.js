const { contextBridge, ipcRenderer } = require('electron');

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

  // Electron 여부 식별
  isElectron: true,
  platform: process.platform,
});
