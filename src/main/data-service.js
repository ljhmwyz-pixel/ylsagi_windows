const { envToken, fetchInfo } = require('./api');
const { readInfoCache, writeInfoCache } = require('./cache');
const { logError, logInfo, logWarn } = require('./logger');
const { normalizeSettings, readSettings } = require('./settings');
const { getBubbleWindow, getPanelWindow } = require('./windows');

const defaultState = {
  loading: false,
  data: null,
  fetchedAt: null,
  cached: false,
  error: null,
  warning: null
};

let state = { ...defaultState };
let refreshTimer = null;
let activeFetch = null;

function publicSettings(settings) {
  const normalized = normalizeSettings(settings || {});
  const hasEnvToken = Boolean(envToken());
  const savedToken = typeof normalized.token === 'string' && normalized.token.trim();

  return {
    hasToken: hasEnvToken || Boolean(savedToken),
    tokenSource: hasEnvToken ? 'env' : savedToken ? 'saved' : 'none',
    refreshSeconds: Number(normalized.refreshSeconds) || 60,
    compact: true,
    alwaysOnTop: normalized.alwaysOnTop !== false,
    panelLightDismiss: normalized.panelLightDismiss !== false,
    launchAtLogin: Boolean(normalized.launchAtLogin)
  };
}

function stateSnapshot() {
  return { ...state };
}

function sendToRenderers(channel, payload) {
  for (const win of [getBubbleWindow(), getPanelWindow()]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

function emitState() {
  sendToRenderers('data-state', stateSnapshot());
}

function normalizeError(error) {
  return {
    code: error?.code || 'REQUEST_FAILED',
    message: error?.message || '请求失败',
    status: error?.status || null
  };
}

async function hydrateFromCache() {
  const cached = await readInfoCache();
  if (!cached?.data) return stateSnapshot();

  state = {
    ...state,
    data: cached.data,
    fetchedAt: cached.fetchedAt || new Date().toISOString(),
    cached: true,
    warning: null,
    error: null
  };
  emitState();
  logInfo('data:cache-hydrated', { fetchedAt: state.fetchedAt });
  return stateSnapshot();
}

async function refreshData() {
  if (activeFetch) return activeFetch;

  state = { ...state, loading: true, error: null };
  emitState();

  activeFetch = (async () => {
    try {
      const data = await fetchInfo();
      const cached = await writeInfoCache(data);
      state = {
        loading: false,
        data: cached.data,
        fetchedAt: cached.fetchedAt,
        cached: false,
        error: null,
        warning: null
      };
      logInfo('data:refresh-success', { fetchedAt: state.fetchedAt, cached: false });
    } catch (error) {
      const normalizedError = normalizeError(error);
      const cached = await readInfoCache();

      if (cached?.data) {
        state = {
          loading: false,
          data: cached.data,
          fetchedAt: cached.fetchedAt || new Date().toISOString(),
          cached: true,
          error: null,
          warning: normalizedError
        };
        logWarn('data:refresh-fallback-cache', normalizedError);
      } else {
        state = {
          ...state,
          loading: false,
          error: normalizedError,
          warning: null
        };
        logError('data:refresh-failed', normalizedError);
      }
    } finally {
      activeFetch = null;
      emitState();
    }

    return stateSnapshot();
  })();

  return activeFetch;
}

async function scheduleRefresh(settings) {
  clearInterval(refreshTimer);
  const normalized = normalizeSettings(settings || (await readSettings()));
  const seconds = Math.min(3600, Math.max(15, Number(normalized.refreshSeconds) || 60));
  refreshTimer = setInterval(() => {
    void refreshData();
  }, seconds * 1000);
  return seconds;
}

async function startDataService(settings) {
  await hydrateFromCache();
  await scheduleRefresh(settings);
  void refreshData();
}

function stopDataService() {
  clearInterval(refreshTimer);
  refreshTimer = null;
}

module.exports = {
  hydrateFromCache,
  publicSettings,
  refreshData,
  scheduleRefresh,
  startDataService,
  stateSnapshot,
  stopDataService
};
