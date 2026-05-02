const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');

let logFile = null;
const LOG_MAX_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_LOG_FILES = 5;

function initLogger() {
  const logDir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  logFile = path.join(logDir, 'app.log');
  rotateLogFile(logFile);
  logInfo('logger:init', { file: logFile, version: getAppVersion() });
}

function getAppVersion() {
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

function logsDirectory() {
  return path.join(app.getPath('userData'), 'logs');
}

function rotateLogFile(file) {
  try {
    if (!fs.existsSync(file)) return;
    const stat = fs.statSync(file);
    if (stat.size < LOG_MAX_SIZE) return;

    const oldestFile = `${file}.${MAX_LOG_FILES}`;
    if (fs.existsSync(oldestFile)) {
      fs.unlinkSync(oldestFile);
    }

    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const oldFile = `${file}.${i}`;
      if (fs.existsSync(oldFile)) {
        fs.renameSync(oldFile, `${file}.${i + 1}`);
      }
    }

    fs.renameSync(file, `${file}.1`);
  } catch (error) {
    console.error('[log rotate failed]', error);
  }
}

function serialize(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }
  return value;
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return util.inspect(value);
  }
}

function formatConsole(level, message, meta) {
  const time = new Date().toISOString().slice(11, 19);
  const colors = {
    info: '\x1b[36m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    debug: '\x1b[90m'
  };
  const reset = '\x1b[0m';
  const color = colors[level] || '';
  const metaStr = meta ? ` ${safeJson(serialize(meta))}` : '';
  return `${color}[${time}] ${level.toUpperCase()}: ${message}${metaStr}${reset}`;
}

function write(level, message, meta) {
  const logEntry = safeJson({
    time: new Date().toISOString(),
    level,
    message,
    meta: serialize(meta)
  });

  const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
  console[consoleMethod](formatConsole(level, message, meta));

  if (!logFile) {
    return;
  }

  try {
    fs.appendFileSync(logFile, `${logEntry}\n`, 'utf8');
  } catch (error) {
    console.error('[log write failed]', error);
  }
}

function logInfo(message, meta) {
  write('info', message, meta);
}

function logWarn(message, meta) {
  write('warn', message, meta);
}

function logError(message, meta) {
  write('error', message, meta);
}

function formatUnknownError(error) {
  return error instanceof Error ? error : new Error(util.inspect(error));
}

module.exports = {
  formatUnknownError,
  initLogger,
  logsDirectory,
  logError,
  logInfo,
  logWarn
};
