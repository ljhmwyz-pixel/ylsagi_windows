const { envToken, fetchInfo } = require('./api');
const { readInfoCache, writeInfoCache } = require('./cache');
const { DATA_STALE_DANGER_MS, DATA_STALE_WARN_MS } = require('./constants');
const { logError, logInfo, logWarn } = require('./logger');
const { normalizeSettings, readSettings } = require('./settings');
const { getBubbleWindow, getPanelWindow } = require('./windows');

const defaultState = {
  loading: false,
  data: null,
  fetchedAt: null,
  freshness: { ageMs: null, stale: false, expired: false },
  cached: false,
  error: null,
  warning: null
};

let state = { ...defaultState };
let refreshTimer = null;
let activeFetch = null;
let systemRefreshTimer = null;
let systemRefreshCleanup = null;

function publicSettings(settings) {
  const normalized = normalizeSettings(settings || {});
  const hasEnvToken = Boolean(envToken());
  const savedToken = typeof normalized.token === 'string' && normalized.token.trim();
  const tokenStorage = hasEnvToken ? 'env' : savedToken ? normalized.tokenStorage || 'plain' : 'none';

  return {
    hasToken: hasEnvToken || Boolean(savedToken),
    tokenSource: hasEnvToken ? 'env' : savedToken ? 'saved' : 'none',
    tokenStorage,
    schemaVersion: normalized.schemaVersion,
    refreshSeconds: Number(normalized.refreshSeconds) || 60,
    compact: true,
    alwaysOnTop: normalized.alwaysOnTop !== false,
    panelLightDismiss: normalized.panelLightDismiss !== false,
    launchAtLogin: Boolean(normalized.launchAtLogin)
  };
}

function stateSnapshot() {
  return {
    ...state,
    freshness: freshnessForFetchedAt(state.fetchedAt)
  };
}

function freshnessForFetchedAt(fetchedAt, now = Date.now()) {
  const timestamp = fetchedAt ? new Date(fetchedAt).getTime() : NaN;
  if (!Number.isFinite(timestamp)) {
    return { ageMs: null, stale: false, expired: false };
  }

  const ageMs = Math.max(0, now - timestamp);
  return {
    ageMs,
    stale: ageMs >= DATA_STALE_WARN_MS,
    expired: ageMs >= DATA_STALE_DANGER_MS
  };
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
    freshness: freshnessForFetchedAt(cached.fetchedAt),
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
        freshness: freshnessForFetchedAt(cached.fetchedAt),
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
          freshness: freshnessForFetchedAt(cached.fetchedAt),
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

function scheduleSystemRecoveryRefresh(reason, delayMs = 1500) {
  clearTimeout(systemRefreshTimer);
  systemRefreshTimer = setTimeout(() => {
    logInfo('data:system-recovery-refresh', { reason });
    void refreshData();
  }, delayMs);
}

function registerSystemRefreshHandlers(powerMonitor, options = {}) {
  if (!powerMonitor || typeof powerMonitor.on !== 'function') return () => {};
  unregisterSystemRefreshHandlers();

  const delayMs = Number.isFinite(Number(options.delayMs)) ? Math.max(0, Number(options.delayMs)) : 1500;
  const events = ['resume', 'unlock-screen'];
  const listeners = events.map((eventName) => {
    const listener = () => scheduleSystemRecoveryRefresh(eventName, delayMs);
    powerMonitor.on(eventName, listener);
    return { eventName, listener };
  });

  systemRefreshCleanup = () => {
    for (const { eventName, listener } of listeners) {
      if (typeof powerMonitor.off === 'function') {
        powerMonitor.off(eventName, listener);
      } else if (typeof powerMonitor.removeListener === 'function') {
        powerMonitor.removeListener(eventName, listener);
      }
    }
    systemRefreshCleanup = null;
  };

  return systemRefreshCleanup;
}

function unregisterSystemRefreshHandlers() {
  clearTimeout(systemRefreshTimer);
  systemRefreshTimer = null;
  if (typeof systemRefreshCleanup === 'function') {
    systemRefreshCleanup();
  }
}

async function startDataService(settings) {
  await hydrateFromCache();
  await scheduleRefresh(settings);
  void refreshData();
}

function stopDataService() {
  clearInterval(refreshTimer);
  refreshTimer = null;
  unregisterSystemRefreshHandlers();
}

module.exports = {
  hydrateFromCache,
  freshnessForFetchedAt,
  publicSettings,
  registerSystemRefreshHandlers,
  refreshData,
  scheduleRefresh,
  scheduleSystemRecoveryRefresh,
  startDataService,
  stateSnapshot,
  stopDataService,
  unregisterSystemRefreshHandlers
};
