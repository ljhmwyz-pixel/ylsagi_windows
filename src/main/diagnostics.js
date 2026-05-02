const { app, clipboard, screen } = require('electron');
const { publicSettings, stateSnapshot } = require('./data-service');
const { logsDirectory } = require('./logger');
const { readSettings, settingsDirectory } = require('./settings');

async function collectDiagnostics() {
  const { getBubbleWindow, getPanelWindow } = require('./windows');
  const rawSettings = await readSettings();
  const settings = publicSettings(rawSettings);
  const data = stateSnapshot();

  return {
    app: {
      name: app.getName(),
      version: app.getVersion(),
      packaged: app.isPackaged,
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node
    },
    displays: screen.getAllDisplays().map((display) => ({
      id: display.id,
      scaleFactor: display.scaleFactor,
      bounds: display.bounds,
      workArea: display.workArea
    })),
    windows: {
      bubble: getWindowBounds(getBubbleWindow()),
      panel: getWindowBounds(getPanelWindow())
    },
    settings,
    settingsMeta: {
      schemaVersion: rawSettings.schemaVersion || null,
      lastMigration: rawSettings.lastMigration || null
    },
    data: {
      loading: data.loading,
      cached: data.cached,
      fetchedAt: data.fetchedAt,
      freshness: data.freshness,
      hasData: Boolean(data.data),
      error: data.error,
      warning: data.warning
    },
    paths: {
      logs: logsDirectory(),
      settings: settingsDirectory()
    }
  };
}

function getWindowBounds(win) {
  return win && !win.isDestroyed() ? win.getBounds() : null;
}

async function copyDiagnostics() {
  clipboard.writeText(JSON.stringify(await collectDiagnostics(), null, 2));
  return { ok: true };
}

module.exports = {
  collectDiagnostics,
  copyDiagnostics
};
