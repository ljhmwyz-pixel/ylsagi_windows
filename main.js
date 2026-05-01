const { app } = require('electron');
const {
  applyAutoLaunch,
  configureAppIdentity,
  configureProcessGuards,
  configureRendererSecurity
} = require('./src/main/app-lifecycle');
const { initLogger, logError, logInfo } = require('./src/main/logger');
const { normalizeSettings, readSettings, writeSettings, updateSettings } = require('./src/main/settings');
const { startDataService, stopDataService } = require('./src/main/data-service');
const {
  createWindows,
  registerDisplayRecoveryHandlers,
  setAlwaysOnTopForWindows,
  setContextMenuHandler,
  showBubble,
  unregisterDisplayRecoveryHandlers
} = require('./src/main/windows');
const { buildTray, destroyTray, refreshTrayMenu, showBubbleContextMenu } = require('./src/main/tray');
const { registerIpc } = require('./src/main/ipc');

global.isQuitting = false;

configureAppIdentity();
configureProcessGuards();

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

async function setAlwaysOnTop(value) {
  await updateSettings((settings) => {
    settings.alwaysOnTop = Boolean(value);
    return settings;
  });
  setAlwaysOnTopForWindows(Boolean(value));
  await refreshTrayMenu(setAlwaysOnTop);
}

app.whenReady()
  .then(async () => {
    initLogger();
    configureRendererSecurity();

    const settings = normalizeSettings(await readSettings());
    await writeSettings(settings);
    applyAutoLaunch(settings.launchAtLogin);
    registerIpc(() => refreshTrayMenu(setAlwaysOnTop));
    await createWindows(settings);
    registerDisplayRecoveryHandlers();
    setContextMenuHandler(() => showBubbleContextMenu(setAlwaysOnTop));
    buildTray(setAlwaysOnTop);
    await startDataService(settings);
    logInfo('app:ready');

    app.on('activate', () => {
      showBubble();
    });
  })
  .catch((error) => {
    logError('app:startup-failed', error);
    app.quit();
  });

app.on('second-instance', () => {
  showBubble();
});

app.on('before-quit', () => {
  unregisterDisplayRecoveryHandlers();
  stopDataService();
  destroyTray();
  logInfo('app:before-quit');
});

app.on('window-all-closed', (event) => {
  event?.preventDefault?.();
});
