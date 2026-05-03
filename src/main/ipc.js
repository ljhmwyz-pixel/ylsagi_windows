const { ipcMain, shell } = require('electron');
const { applyAutoLaunch } = require('./app-lifecycle');
const { publicSettings, refreshData, scheduleRefresh, stateSnapshot } = require('./data-service');
const { copyDiagnostics } = require('./diagnostics');
const { logsDirectory } = require('./logger');
const { readSettings, settingsDirectory, updateSettings } = require('./settings');
const {
  parseBoolean,
  parseContentHeight,
  parseDelta,
  parseSettingsPayload
} = require('./validators');
const {
  beginBubbleDrag,
  hidePanel,
  hideDockedBubble,
  moveBubbleBy,
  revealDockedBubble,
  resizePanelToContent,
  resetBubblePlacement,
  setAlwaysOnTopForWindows,
  setPanelLightDismiss,
  showBubbleContextMenu,
  snapBubbleToEdge,
  togglePanel
} = require('./windows');

function notifySettingsChanged() {
  const { getBubbleWindow, getPanelWindow } = require('./windows');
  getBubbleWindow()?.webContents.send('settings-changed');
  getPanelWindow()?.webContents.send('settings-changed');
}

function registerIpc(refreshTrayMenu) {
  ipcMain.handle('settings:get', async () => {
    return publicSettings(await readSettings());
  });

  ipcMain.handle('settings:save', async (_event, nextSettings) => {
    const payload = parseSettingsPayload(nextSettings);
    const next = await updateSettings((settings) => {
      settings.refreshSeconds = payload.refreshSeconds;
      settings.alwaysOnTop = payload.alwaysOnTop;
      settings.panelLightDismiss = payload.panelLightDismiss;
      settings.launchAtLogin = payload.launchAtLogin;

      if (payload.token) {
        settings.token = payload.token;
      }

      return settings;
    });

    setAlwaysOnTopForWindows(next.alwaysOnTop !== false);
    setPanelLightDismiss(next.panelLightDismiss !== false);
    applyAutoLaunch(next.launchAtLogin);
    await scheduleRefresh(next);
    await refreshTrayMenu();
    notifySettingsChanged();
    return { ok: true };
  });

  ipcMain.handle('settings:clear-token', async () => {
    await updateSettings((settings) => {
      delete settings.token;
      return settings;
    });
    await refreshData();
    notifySettingsChanged();
    return { ok: true };
  });

  ipcMain.handle('data:get-state', async () => {
    return stateSnapshot();
  });

  ipcMain.handle('data:refresh', async () => {
    return refreshData();
  });

  ipcMain.handle('window:minimize-to-tray', () => {
    hidePanel();
  });

  ipcMain.handle('window:set-always-on-top', async (_event, value) => {
    const alwaysOnTop = parseBoolean(value);
    await updateSettings((settings) => {
      settings.alwaysOnTop = alwaysOnTop;
      return settings;
    });
    setAlwaysOnTopForWindows(alwaysOnTop);
    await refreshTrayMenu();
    notifySettingsChanged();
    return { ok: true };
  });

  ipcMain.handle('window:toggle-panel', () => {
    togglePanel();
    return { ok: true };
  });

  ipcMain.handle('window:hide-panel', () => {
    hidePanel();
    return { ok: true };
  });

  ipcMain.handle('window:resize-panel-to-content', (_event, height) => {
    return resizePanelToContent(parseContentHeight(height));
  });

  ipcMain.handle('window:move-bubble-by', (_event, delta) => {
    const next = parseDelta(delta);
    moveBubbleBy(next.dx, next.dy);
    return { ok: true };
  });

  ipcMain.handle('window:begin-bubble-drag', () => {
    return beginBubbleDrag();
  });

  ipcMain.handle('window:snap-bubble', async () => {
    await snapBubbleToEdge();
    return { ok: true };
  });

  ipcMain.handle('window:reveal-docked-bubble', () => {
    revealDockedBubble();
    return { ok: true };
  });

  ipcMain.handle('window:hide-docked-bubble', () => {
    hideDockedBubble();
    return { ok: true };
  });

  ipcMain.handle('window:show-bubble-menu', () => {
    showBubbleContextMenu();
    return { ok: true };
  });

  ipcMain.handle('app:open-logs', async () => {
    await shell.openPath(logsDirectory());
    return { ok: true };
  });

  ipcMain.handle('app:open-settings-dir', async () => {
    await shell.openPath(settingsDirectory());
    return { ok: true };
  });

  ipcMain.handle('app:copy-diagnostics', copyDiagnostics);

  ipcMain.handle('window:reset-placement', async () => {
    return resetBubblePlacement();
  });
}

module.exports = {
  registerIpc
};
