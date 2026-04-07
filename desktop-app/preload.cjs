const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onMachineInfo: (callback) => ipcRenderer.on('machine-info', (_event, info) => callback(info)),
});
