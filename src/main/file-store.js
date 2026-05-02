const fs = require('node:fs/promises');
const path = require('node:path');

function corruptPath(filePath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${filePath}.corrupt-${stamp}`;
}

async function quarantineFile(filePath) {
  try {
    await fs.rename(filePath, corruptPath(filePath));
  } catch {
    // Best effort only. Callers still fall back to defaults.
  }
}

async function readJsonFile(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      await quarantineFile(filePath);
    }
    return fallback;
  }
}

async function writeJsonFileAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const payload = typeof value === 'string' ? value : JSON.stringify(value, null, 2);

  try {
    await fs.writeFile(tmpPath, payload, 'utf8');
    await fs.rename(tmpPath, filePath);
  } finally {
    try {
      await fs.unlink(tmpPath);
    } catch {
      // The temp file is normally gone after a successful rename.
    }
  }
}

module.exports = {
  readJsonFile,
  writeJsonFileAtomic
};
