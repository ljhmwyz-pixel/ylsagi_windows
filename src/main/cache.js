const { app } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

function cachePath() {
  return path.join(app.getPath('userData'), 'codex-info-cache.json');
}

async function readInfoCache() {
  try {
    const raw = await fs.readFile(cachePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.data) {
      return null;
    }
    return {
      data: parsed.data,
      fetchedAt: typeof parsed.fetchedAt === 'string' ? parsed.fetchedAt : null
    };
  } catch {
    return null;
  }
}

async function writeInfoCache(data, fetchedAt = new Date().toISOString()) {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(cachePath(), JSON.stringify({ data, fetchedAt }, null, 2), 'utf8');
  return { data, fetchedAt };
}

module.exports = {
  readInfoCache,
  writeInfoCache
};
