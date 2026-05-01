const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');

let logFile = null;

function initLogger() {
  const logDir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  logFile = path.join(logDir, 'app.log');
  rotateLogFile(logFile);
  logInfo('logger:init', { file: logFile });
}

function logsDirectory() {
  return path.join(app.getPath('userData'), 'logs');
}

function rotateLogFile(file) {
  try {
    if (!fs.existsSync(file)) return;
    const stat = fs.statSync(file);
    if (stat.size < 1024 * 1024) return;
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

function write(level, message, meta) {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    meta: serialize(meta)
  });

  if (!logFile) {
    console[level === 'error' ? 'error' : 'log'](line);
    return;
  }

  try {
    fs.appendFileSync(logFile, `${line}\n`, 'utf8');
  } catch (error) {
    console.error('[log write failed]', error);
    console.log(line);
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
