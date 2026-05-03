const { API_MAX_ATTEMPTS, API_RETRY_DELAY_MS, API_TIMEOUT_MS, API_URL, TOKEN_ENV_NAMES } = require('./constants');
const { readSettings } = require('./settings');
const { normalizeTokenInput } = require('./validators');
const path = require('node:path');
const fs = require('node:fs');

function getAppVersion() {
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

const APP_VERSION = getAppVersion();

function envToken() {
  for (const name of TOKEN_ENV_NAMES) {
    const value = process.env[name];
    if (value && value.trim()) {
      return normalizeTokenInput(value);
    }
  }
  return '';
}

async function getToken() {
  const fromEnv = envToken();
  if (fromEnv) return fromEnv;

  const settings = await readSettings();
  return normalizeTokenInput(settings.token);
}

function makeError(message, code, status, body) {
  const error = new Error(message);
  if (code) error.code = code;
  if (status) error.status = status;
  if (body !== undefined) error.body = body;
  return error;
}

function parseBodyText(bodyText) {
  try {
    return bodyText ? JSON.parse(bodyText) : null;
  } catch {
    return bodyText;
  }
}

function responseMessage(body, fallback) {
  return typeof body === 'object' && body && typeof body.msg === 'string' && body.msg.trim()
    ? body.msg
    : fallback;
}

function shouldRetry(error) {
  if (error?.code === 'REQUEST_TIMEOUT') return true;
  if (Number(error?.status) >= 500) return true;
  return !error?.status && error?.code !== 'NO_TOKEN' && error?.code !== 'API_ERROR' && error?.code !== 'BAD_RESPONSE';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError' || controller.signal.aborted) {
      throw makeError(`接口请求超时（${Math.round(timeoutMs / 1000)} 秒）`, 'REQUEST_TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function requestInfo(token, timeoutMs) {
  const response = await fetchWithTimeout(
    API_URL,
    {
      method: 'GET',
      headers: {
        Accept: '*/*',
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        'User-Agent': `ylsagi-codex-monitor/${APP_VERSION}`
      }
    },
    timeoutMs
  );

  const body = parseBodyText(await response.text());

  if (!response.ok) {
    throw makeError(responseMessage(body, `接口请求失败：HTTP ${response.status}`), 'HTTP_ERROR', response.status, body);
  }

  if (!body || typeof body !== 'object') {
    throw makeError('接口返回格式异常', 'BAD_RESPONSE', null, body);
  }

  if (Number(body.code) !== 0 && !body.state) {
    throw makeError(responseMessage(body, '接口返回业务错误'), 'API_ERROR', null, body);
  }

  return body;
}

async function fetchInfo(options = {}) {
  const token = await getToken();
  if (!token) {
    throw makeError('请先配置 Bearer Token', 'NO_TOKEN');
  }

  const timeoutMs = Math.max(1, Number(options.timeoutMs) || API_TIMEOUT_MS);
  const attempts = Math.max(1, Number(options.attempts) || API_MAX_ATTEMPTS);
  const retryDelayMs = Math.max(0, Number(options.retryDelayMs) || API_RETRY_DELAY_MS);
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await requestInfo(token, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetry(error)) {
        throw error;
      }
      await delay(retryDelayMs);
    }
  }

  throw lastError;
}

module.exports = {
  envToken,
  fetchInfo,
  parseBodyText
};
