const { API_URL, TOKEN_ENV_NAMES } = require('./constants');
const { readSettings } = require('./settings');
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
      return value.trim().replace(/^Bearer\s+/i, '');
    }
  }
  return '';
}

async function getToken() {
  const fromEnv = envToken();
  if (fromEnv) return fromEnv;

  const settings = await readSettings();
  return typeof settings.token === 'string' ? settings.token.trim().replace(/^Bearer\s+/i, '') : '';
}

async function fetchInfo() {
  const token = await getToken();
  if (!token) {
    const error = new Error('请先配置 Bearer Token');
    error.code = 'NO_TOKEN';
    throw error;
  }

  const response = await fetch(API_URL, {
    method: 'GET',
    headers: {
      Accept: '*/*',
      Authorization: `Bearer ${token}`,
      'Cache-Control': 'no-cache',
      'User-Agent': `ylsagi-codex-monitor/${APP_VERSION}`
    }
  });

  const bodyText = await response.text();
  let body;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    body = bodyText;
  }

  if (!response.ok) {
    const message =
      typeof body === 'object' && body && typeof body.msg === 'string'
        ? body.msg
        : `接口请求失败：HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

module.exports = {
  envToken,
  fetchInfo
};
