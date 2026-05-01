const { app } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { BUBBLE_SIZE } = require('./constants');

function configPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function settingsDirectory() {
  return app.getPath('userData');
}

async function readSettings() {
  try {
    const raw = await fs.readFile(configPath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeSettings(settings) {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(settings, null, 2), 'utf8');
}

async function updateSettings(mutator) {
  const settings = await readSettings();
  const next = mutator({ ...settings }) || settings;
  await writeSettings(next);
  return next;
}

function normalizeSettings(settings) {
  const next = { ...settings };
  const dockedEdges = new Set(['left', 'right', 'top', 'bottom']);
  if (next.bubbleBounds) {
    next.bubbleBounds = {
      x: Number(next.bubbleBounds.x) || 0,
      y: Number(next.bubbleBounds.y) || 0,
      ...BUBBLE_SIZE
    };
  }
  if (!dockedEdges.has(next.bubbleDockedEdge)) {
    delete next.bubbleDockedEdge;
  }
  next.refreshSeconds = Math.min(3600, Math.max(15, Number(next.refreshSeconds) || 60));
  next.alwaysOnTop = next.alwaysOnTop !== false;
  next.panelLightDismiss = next.panelLightDismiss !== false;
  next.launchAtLogin = Boolean(next.launchAtLogin);
  return next;
}

module.exports = {
  configPath,
  readSettings,
  settingsDirectory,
  writeSettings,
  updateSettings,
  normalizeSettings
};
