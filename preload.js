const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('floatingApi', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  clearToken: () => ipcRenderer.invoke('settings:clear-token'),
  getDataState: () => ipcRenderer.invoke('data:get-state'),
  refreshData: () => ipcRenderer.invoke('data:refresh'),
  hide: () => ipcRenderer.invoke('window:minimize-to-tray'),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('window:set-always-on-top', value),
  beginDrag: () => ipcRenderer.invoke('window:begin-bubble-drag'),
  togglePanel: () => ipcRenderer.invoke('window:toggle-panel'),
  hidePanel: () => ipcRenderer.invoke('window:hide-panel'),
  resizePanelToContent: (height) => ipcRenderer.invoke('window:resize-panel-to-content', height),
  moveBy: (delta) => ipcRenderer.invoke('window:move-bubble-by', delta),
  snapBubble: () => ipcRenderer.invoke('window:snap-bubble'),
  revealDockedBubble: () => ipcRenderer.invoke('window:reveal-docked-bubble'),
  hideDockedBubble: () => ipcRenderer.invoke('window:hide-docked-bubble'),
  showBubbleMenu: () => ipcRenderer.invoke('window:show-bubble-menu'),
  openLogs: () => ipcRenderer.invoke('app:open-logs'),
  openSettingsDir: () => ipcRenderer.invoke('app:open-settings-dir'),
  copyDiagnostics: () => ipcRenderer.invoke('app:copy-diagnostics'),
  resetPlacement: () => ipcRenderer.invoke('window:reset-placement'),
  onOpenSettings: (callback) => {
    ipcRenderer.on('open-settings', callback);
    return () => ipcRenderer.removeListener('open-settings', callback);
  },
  onSettingsChanged: (callback) => {
    ipcRenderer.on('settings-changed', callback);
    return () => ipcRenderer.removeListener('settings-changed', callback);
  },
  onDataState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('data-state', listener);
    return () => ipcRenderer.removeListener('data-state', listener);
  },
  onDockPreview: (callback) => {
    const listener = (_event, preview) => callback(preview);
    ipcRenderer.on('bubble-dock-preview', listener);
    return () => ipcRenderer.removeListener('bubble-dock-preview', listener);
  },
  onPanelLayout: (callback) => {
    const listener = (_event, layout) => callback(layout);
    ipcRenderer.on('panel-layout', listener);
    return () => ipcRenderer.removeListener('panel-layout', listener);
  },
  onPanelVisibility: (callback) => {
    const listener = (_event, visible) => callback(Boolean(visible));
    ipcRenderer.on('panel-visibility', listener);
    return () => ipcRenderer.removeListener('panel-visibility', listener);
  }
});
