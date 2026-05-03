// @ts-check

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 */
function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  const safe = Number.isFinite(number) ? number : fallback;
  return Math.min(max, Math.max(min, safe));
}

/**
 * @param {unknown} value
 */
function normalizeTokenInput(value) {
  return typeof value === 'string' ? value.trim().replace(/^Bearer\s+/i, '') : '';
}

/**
 * @param {unknown} value
 */
function parseSettingsPayload(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    token: normalizeTokenInput(source.token),
    refreshSeconds: clampNumber(source.refreshSeconds, 15, 3600, 60),
    alwaysOnTop: source.alwaysOnTop !== false,
    panelLightDismiss: source.panelLightDismiss !== false,
    launchAtLogin: Boolean(source.launchAtLogin)
  };
}

/**
 * @param {unknown} value
 */
function parseBoolean(value) {
  return Boolean(value);
}

/**
 * @param {unknown} value
 */
function parseDelta(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    dx: clampNumber(source.dx, -5000, 5000, 0),
    dy: clampNumber(source.dy, -5000, 5000, 0)
  };
}

/**
 * @param {unknown} value
 */
function parseContentHeight(value) {
  return clampNumber(value, 1, 5000, 0);
}

module.exports = {
  clampNumber,
  normalizeTokenInput,
  parseBoolean,
  parseContentHeight,
  parseDelta,
  parseSettingsPayload
};
