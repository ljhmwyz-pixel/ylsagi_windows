const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const root = path.join(__dirname, '..');

function freshRequire(filePath) {
  const resolved = require.resolve(filePath);
  delete require.cache[resolved];
  return require(resolved);
}

function withElectronMock(mock, factory) {
  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === 'electron') return mock;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const result = factory();
    if (result && typeof result.then === 'function') {
      return result.finally(() => {
        Module._load = originalLoad;
      });
    }

    Module._load = originalLoad;
    return result;
  } catch (error) {
    Module._load = originalLoad;
    throw error;
  }
}

function makeScreenMock(area = { x: 0, y: 0, width: 1000, height: 800 }) {
  const display = {
    id: 1,
    scaleFactor: 1,
    bounds: area,
    workArea: area
  };

  return {
    getPrimaryDisplay: () => display,
    getDisplayMatching: () => display,
    getAllDisplays: () => [display]
  };
}

function loadGeometry(screenArea) {
  return withElectronMock({ screen: makeScreenMock(screenArea) }, () =>
    freshRequire(path.join(root, 'src', 'main', 'geometry.js'))
  );
}

function testGeometry() {
  const geometry = loadGeometry();
  const { BUBBLE_SIZE, PANEL_SIZE } = require(path.join(root, 'src', 'main', 'constants.js'));

  assert.deepEqual(geometry.clampBubbleBounds({ x: -50, y: 900 }), {
    x: 0,
    y: 800 - BUBBLE_SIZE.height,
    ...BUBBLE_SIZE
  });

  assert.deepEqual(geometry.dockBoundsForEdge({ x: 20, y: 100, ...BUBBLE_SIZE }, 'left'), {
    x: -110,
    y: 100,
    ...BUBBLE_SIZE
  });

  assert.deepEqual(geometry.dockBoundsForEdge({ x: 800, y: 100, ...BUBBLE_SIZE }, 'right'), {
    x: 920,
    y: 100,
    ...BUBBLE_SIZE
  });

  assert.deepEqual(geometry.visibleAnchorFromDock({ x: 920, y: 100, ...BUBBLE_SIZE }, 'right'), {
    x: 1000 - BUBBLE_SIZE.width,
    y: 100,
    ...BUBBLE_SIZE
  });

  const release = geometry.resolveBubbleRelease({ x: 1000 - BUBBLE_SIZE.width - 10, y: 100, ...BUBBLE_SIZE });
  assert.equal(release.docked, true);
  assert.equal(release.edge, 'right');
  assert.equal(release.bounds.x, 920);

  const panel = geometry.panelBoundsForBubble({ x: 800, y: 120, ...BUBBLE_SIZE }, 560);
  assert.equal(panel.bounds.width, PANEL_SIZE.width);
  assert.equal(panel.bounds.height, 560);
  assert.equal(panel.layout.side, 'right');
  assert.equal(panel.bounds.x, 800 - PANEL_SIZE.width - 12);
  assert.ok(panel.layout.arrowY >= 28);
}

async function testSettingsEncryption() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-monitor-settings-'));
  const settings = withElectronMock(
    {
      app: {
        getPath: () => tmp
      },
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(`encrypted:${value}`, 'utf8'),
        decryptString: (buffer) => buffer.toString('utf8').replace(/^encrypted:/, '')
      }
    },
    () => freshRequire(path.join(root, 'src', 'main', 'settings.js'))
  );

  await settings.writeSettings({
    token: 'Bearer test-token',
    refreshSeconds: 5,
    bubbleBounds: { x: 12, y: 34 }
  });

  const raw = JSON.parse(fs.readFileSync(path.join(tmp, 'settings.json'), 'utf8'));
  assert.equal(raw.schemaVersion, 2);
  assert.equal(raw.token, undefined);
  assert.equal(typeof raw.tokenEncrypted, 'string');
  assert.equal(raw.tokenStorage, 'safeStorage');

  const read = await settings.readSettings();
  assert.equal(read.token, 'test-token');
  assert.equal(read.tokenStorage, 'safeStorage');
  assert.equal(read.schemaVersion, 2);

  const normalized = settings.normalizeSettings(read);
  assert.equal(normalized.schemaVersion, 2);
  assert.equal(normalized.refreshSeconds, 15);
  assert.equal(normalized.bubbleBounds.width, 190);
  assert.equal(normalized.bubbleBounds.height, 60);

  fs.writeFileSync(settings.configPath(), '{bad json', 'utf8');
  assert.deepEqual(await settings.readSettings(), {});
  assert.ok(fs.readdirSync(tmp).some((file) => file.startsWith('settings.json.corrupt-')));
}

async function testSettingsMigration() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-monitor-migration-'));
  const settings = withElectronMock(
    {
      app: {
        getPath: () => tmp
      },
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(`encrypted:${value}`, 'utf8'),
        decryptString: (buffer) => buffer.toString('utf8').replace(/^encrypted:/, '')
      }
    },
    () => freshRequire(path.join(root, 'src', 'main', 'settings.js'))
  );

  fs.writeFileSync(
    settings.configPath(),
    JSON.stringify({
      token: 'Bearer legacy-token',
      refreshSeconds: 5,
      bubbleBounds: { x: 12, y: 34, width: 88, height: 88 }
    }),
    'utf8'
  );

  const migrated = await settings.readSettings();
  assert.equal(migrated.token, 'legacy-token');
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.lastMigration.from, 1);
  assert.equal(migrated.lastMigration.to, 2);
  assert.ok(migrated.lastMigration.steps.includes('plain-token-to-safe-storage'));
  assert.ok(migrated.lastMigration.steps.includes('normalize-capsule-bubble-bounds'));

  const normalized = settings.normalizeSettings(migrated);
  assert.equal(normalized.refreshSeconds, 15);
  assert.equal(normalized.bubbleBounds.width, 190);
  assert.equal(normalized.bubbleBounds.height, 60);

  await settings.writeSettings(normalized);
  const raw = JSON.parse(fs.readFileSync(settings.configPath(), 'utf8'));
  assert.equal(raw.schemaVersion, 2);
  assert.equal(raw.token, undefined);
  assert.equal(raw.tokenStorage, 'safeStorage');
  assert.equal(typeof raw.tokenEncrypted, 'string');
}

async function testApiFetch() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-monitor-api-'));
  const electronMock = {
    app: {
      getPath: () => tmp
    },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(`encrypted:${value}`, 'utf8'),
      decryptString: (buffer) => buffer.toString('utf8').replace(/^encrypted:/, '')
    }
  };

  const originalFetch = global.fetch;

  try {
    await withElectronMock(electronMock, async () => {
      const settingsPath = path.join(root, 'src', 'main', 'settings.js');
      const apiPath = path.join(root, 'src', 'main', 'api.js');
      const settings = freshRequire(settingsPath);
      await settings.writeSettings({ token: 'Bearer api-token' });

      let attempts = 0;
      let authorization = '';
      global.fetch = async (_url, options) => {
        attempts += 1;
        authorization = options.headers.Authorization;
        if (attempts === 1) {
          return {
            ok: false,
            status: 502,
            text: async () => JSON.stringify({ msg: 'bad gateway' })
          };
        }
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ code: 0, state: { ok: true } })
        };
      };

      const api = freshRequire(apiPath);
      const data = await api.fetchInfo({ attempts: 2, retryDelayMs: 1, timeoutMs: 50 });
      assert.equal(attempts, 2);
      assert.equal(authorization, 'Bearer api-token');
      assert.equal(data.state.ok, true);

      global.fetch = (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });

      await assert.rejects(
        () => api.fetchInfo({ attempts: 1, timeoutMs: 1 }),
        (error) => error.code === 'REQUEST_TIMEOUT'
      );
    });
  } finally {
    global.fetch = originalFetch;
  }
}

async function testCacheStore() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-monitor-cache-'));
  const cache = withElectronMock(
    {
      app: {
        getPath: () => tmp
      }
    },
    () => freshRequire(path.join(root, 'src', 'main', 'cache.js'))
  );

  const written = await cache.writeInfoCache({ state: { ok: true } }, '2026-05-02T00:00:00.000Z');
  assert.equal(written.fetchedAt, '2026-05-02T00:00:00.000Z');

  const read = await cache.readInfoCache();
  assert.deepEqual(read, {
    data: { state: { ok: true } },
    fetchedAt: '2026-05-02T00:00:00.000Z'
  });

  fs.writeFileSync(path.join(tmp, 'codex-info-cache.json'), '{bad cache', 'utf8');
  assert.equal(await cache.readInfoCache(), null);
  assert.ok(fs.readdirSync(tmp).some((file) => file.startsWith('codex-info-cache.json.corrupt-')));
}

function testDataFreshness() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-monitor-freshness-'));
  const dataService = withElectronMock(
    {
      app: {
        getPath: () => tmp
      },
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(`encrypted:${value}`, 'utf8'),
        decryptString: (buffer) => buffer.toString('utf8').replace(/^encrypted:/, '')
      },
      screen: makeScreenMock(),
      BrowserWindow: function BrowserWindow() {}
    },
    () => freshRequire(path.join(root, 'src', 'main', 'data-service.js'))
  );
  const now = new Date('2026-05-02T10:00:00.000Z').getTime();

  assert.equal(dataService.stateSnapshot().phase, 'idle');
  assert.deepEqual(dataService.freshnessForFetchedAt(null, now), {
    ageMs: null,
    stale: false,
    expired: false
  });
  assert.deepEqual(dataService.freshnessForFetchedAt('2026-05-02T09:55:00.000Z', now), {
    ageMs: 5 * 60 * 1000,
    stale: false,
    expired: false
  });
  assert.deepEqual(dataService.freshnessForFetchedAt('2026-05-02T09:40:00.000Z', now), {
    ageMs: 20 * 60 * 1000,
    stale: true,
    expired: false
  });
  assert.deepEqual(dataService.freshnessForFetchedAt('2026-05-02T08:30:00.000Z', now), {
    ageMs: 90 * 60 * 1000,
    stale: true,
    expired: true
  });
}

function testSystemRefreshHandlers() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-monitor-system-events-'));
  const dataService = withElectronMock(
    {
      app: {
        getPath: () => tmp
      },
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(`encrypted:${value}`, 'utf8'),
        decryptString: (buffer) => buffer.toString('utf8').replace(/^encrypted:/, '')
      },
      screen: makeScreenMock(),
      BrowserWindow: function BrowserWindow() {}
    },
    () => freshRequire(path.join(root, 'src', 'main', 'data-service.js'))
  );

  const powerMonitor = new EventEmitter();
  const cleanup = dataService.registerSystemRefreshHandlers(powerMonitor, { delayMs: 1 });
  assert.equal(powerMonitor.listenerCount('resume'), 1);
  assert.equal(powerMonitor.listenerCount('unlock-screen'), 1);

  cleanup();
  assert.equal(powerMonitor.listenerCount('resume'), 0);
  assert.equal(powerMonitor.listenerCount('unlock-screen'), 0);

  dataService.registerSystemRefreshHandlers(powerMonitor, { delayMs: 1 });
  dataService.unregisterSystemRefreshHandlers();
  assert.equal(powerMonitor.listenerCount('resume'), 0);
  assert.equal(powerMonitor.listenerCount('unlock-screen'), 0);
}

function testValidators() {
  const validators = freshRequire(path.join(root, 'src', 'main', 'validators.js'));

  assert.equal(validators.normalizeTokenInput('Bearer abc'), 'abc');
  assert.equal(validators.normalizeTokenInput('  token  '), 'token');
  assert.equal(validators.normalizeTokenInput(null), '');

  assert.deepEqual(validators.parseSettingsPayload({
    token: 'Bearer saved-token',
    refreshSeconds: 2,
    alwaysOnTop: false,
    panelLightDismiss: false,
    launchAtLogin: 1
  }), {
    token: 'saved-token',
    refreshSeconds: 15,
    alwaysOnTop: false,
    panelLightDismiss: false,
    launchAtLogin: true
  });

  assert.deepEqual(validators.parseDelta({ dx: 999999, dy: -999999 }), {
    dx: 5000,
    dy: -5000
  });
  assert.equal(validators.parseContentHeight('700'), 700);
  assert.equal(validators.parseContentHeight('bad'), 1);
}

async function main() {
  testGeometry();
  await testSettingsEncryption();
  await testSettingsMigration();
  await testApiFetch();
  await testCacheStore();
  testDataFreshness();
  testSystemRefreshHandlers();
  testValidators();
  console.log('Unit tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
