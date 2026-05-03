const { app, safeStorage } = require('electron');
const path = require('node:path');
const { BUBBLE_SIZE } = require('./constants');
const { readJsonFile, writeJsonFileAtomic } = require('./file-store');
const { normalizeTokenInput } = require('./validators');

const SETTINGS_SCHEMA_VERSION = 2;

function configPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function settingsDirectory() {
  return app.getPath('userData');
}

function normalizeToken(value) {
  return normalizeTokenInput(value);
}

function decryptToken(settings) {
  const next = { ...settings };
  const encrypted = typeof next.tokenEncrypted === 'string' ? next.tokenEncrypted : '';
  if (encrypted) {
    try {
      next.token = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
      next.tokenStorage = 'safeStorage';
    } catch {
      delete next.token;
      next.tokenStorage = 'unavailable';
    }
  } else if (normalizeToken(next.token)) {
    next.token = normalizeToken(next.token);
    next.tokenStorage = 'plain';
  } else {
    delete next.token;
    next.tokenStorage = 'none';
  }
  return next;
}

function serializeSettings(settings) {
  const next = { ...settings };
  const token = normalizeToken(next.token);
  const existingEncryptedToken = typeof next.tokenEncrypted === 'string' ? next.tokenEncrypted : '';

  next.schemaVersion = SETTINGS_SCHEMA_VERSION;
  delete next.token;
  delete next.tokenEncrypted;
  delete next.tokenStorage;

  if (!token) {
    if (settings.tokenStorage === 'unavailable' && existingEncryptedToken) {
      next.tokenEncrypted = existingEncryptedToken;
      next.tokenStorage = 'unavailable';
    }
    return next;
  }

  if (safeStorage.isEncryptionAvailable()) {
    next.tokenEncrypted = safeStorage.encryptString(token).toString('base64');
    next.tokenStorage = 'safeStorage';
  } else {
    next.token = token;
    next.tokenStorage = 'plain';
  }

  return next;
}

function migrateSettings(settings) {
  if (!settings || typeof settings !== 'object' || Object.keys(settings).length === 0) {
    return {};
  }

  const next = { ...settings };
  const fromVersion = Math.max(1, Number(next.schemaVersion) || 1);
  const steps = [];

  if (fromVersion < 2) {
    if (normalizeToken(next.token) && !next.tokenEncrypted) {
      steps.push('plain-token-to-safe-storage');
    }
    if (next.bubbleBounds) {
      steps.push('normalize-capsule-bubble-bounds');
    }
  }

  next.schemaVersion = SETTINGS_SCHEMA_VERSION;
  if (steps.length) {
    next.lastMigration = {
      from: fromVersion,
      to: SETTINGS_SCHEMA_VERSION,
      at: new Date().toISOString(),
      steps
    };
  }

  return next;
}

async function readSettings() {
  const settings = await readJsonFile(configPath(), {});
  if (!settings || typeof settings !== 'object' || Object.keys(settings).length === 0) {
    return {};
  }
  return decryptToken(migrateSettings(settings));
}

async function writeSettings(settings) {
  await writeJsonFileAtomic(configPath(), serializeSettings(settings));
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
  next.schemaVersion = SETTINGS_SCHEMA_VERSION;
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
  const token = normalizeToken(next.token);
  if (token) {
    next.token = token;
    next.tokenStorage = next.tokenStorage || 'plain';
  } else {
    delete next.token;
    next.tokenStorage = 'none';
  }
  next.refreshSeconds = Math.min(3600, Math.max(15, Number(next.refreshSeconds) || 60));
  next.alwaysOnTop = next.alwaysOnTop !== false;
  next.panelLightDismiss = next.panelLightDismiss !== false;
  next.launchAtLogin = Boolean(next.launchAtLogin);
  return next;
}

module.exports = {
  SETTINGS_SCHEMA_VERSION,
  configPath,
  readSettings,
  settingsDirectory,
  writeSettings,
  updateSettings,
  normalizeSettings
};
