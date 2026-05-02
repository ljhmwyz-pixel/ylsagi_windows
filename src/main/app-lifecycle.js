const { app, session } = require('electron');
const path = require('node:path');
const { logError, logInfo, logWarn, formatUnknownError } = require('./logger');

const USER_DATA_DIR = 'Codex 用量悬浮窗';
const loggedPermissionDenials = new Set();

function configureProcessGuards() {
  process.on('uncaughtException', (error) => {
    logError('process:uncaught-exception', formatUnknownError(error));
  });

  process.on('unhandledRejection', (reason) => {
    logError('process:unhandled-rejection', formatUnknownError(reason));
  });

  app.on('child-process-gone', (_event, details) => {
    logWarn('app:child-process-gone', details);
  });
}

function configureAppIdentity() {
  app.setName('Codex');
  app.setPath('userData', path.join(app.getPath('appData'), USER_DATA_DIR));
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.ylsagi.codex.quota.floating');
  }
}

function isAllowedNavigationUrl(url) {
  if (url.startsWith('file://')) return true;
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  return Boolean(devUrl && url.startsWith(devUrl));
}

function configureRendererSecurity() {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    logPermissionDeniedOnce('request', permission);
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    logPermissionDeniedOnce('check', permission);
    return false;
  });

  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler((details) => {
      logWarn('security:window-open-denied', { url: details.url });
      return { action: 'deny' };
    });

    contents.on('will-navigate', (event, url) => {
      if (isAllowedNavigationUrl(url)) return;
      event.preventDefault();
      logWarn('security:navigation-denied', { url });
    });
  });
}

function logPermissionDeniedOnce(scope, permission) {
  const key = `${scope}:${permission}`;
  if (loggedPermissionDenials.has(key)) return;
  loggedPermissionDenials.add(key);
  logWarn(`security:permission-${scope}-denied`, { permission });
}

function applyAutoLaunch(enabled) {
  const openAtLogin = Boolean(enabled);
  if (!app.isPackaged) {
    logInfo('app:auto-launch-skipped-dev', { openAtLogin });
    return;
  }

  app.setLoginItemSettings({
    openAtLogin,
    openAsHidden: true
  });
  logInfo('app:auto-launch-updated', { openAtLogin });
}

module.exports = {
  applyAutoLaunch,
  configureAppIdentity,
  configureProcessGuards,
  configureRendererSecurity
};
