const { app } = require('electron');
const path = require('node:path');
const { readJsonFile, writeJsonFileAtomic } = require('./file-store');

function cachePath() {
  return path.join(app.getPath('userData'), 'codex-info-cache.json');
}

async function readInfoCache() {
  const parsed = await readJsonFile(cachePath(), null);
  if (!parsed || typeof parsed !== 'object' || !parsed.data) {
    return null;
  }
  return {
    data: parsed.data,
    fetchedAt: typeof parsed.fetchedAt === 'string' ? parsed.fetchedAt : null
  };
}

async function writeInfoCache(data, fetchedAt = new Date().toISOString()) {
  await writeJsonFileAtomic(cachePath(), { data, fetchedAt });
  return { data, fetchedAt };
}

module.exports = {
  readInfoCache,
  writeInfoCache
};
