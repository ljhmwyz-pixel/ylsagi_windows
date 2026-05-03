const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');

function testEnv(userData) {
  const env = { ...process.env, YLSAGI_TEST_USER_DATA: userData };
  for (const key of ['YLS_Codex_TOKEN', 'YLS_CODEX_TOKEN', 'CODEX_INFO_TOKEN']) {
    delete env[key];
  }
  delete env.VITE_DEV_SERVER_URL;
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDevToolsPort(userData, child) {
  const portFile = path.join(userData, 'DevToolsActivePort');
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (fs.existsSync(portFile)) {
      return fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0];
    }
    if (child.exitCode !== null) {
      throw new Error(`Electron exited before DevTools was ready: ${child.exitCode}`);
    }
    await delay(80);
  }
  throw new Error('Timed out waiting for Electron DevTools port');
}

async function findPage(browser, mode) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const page = browser.contexts().flatMap((context) => context.pages()).find((item) => item.url().includes(`mode=${mode}`));
    if (page) return page;
    await delay(80);
  }
  throw new Error(`Timed out waiting for ${mode} page`);
}

function removeDirSoon(dir) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
    }
  }
}

async function main() {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-monitor-smoke-'));
  const electronBin = require('electron');
  const child = spawn(electronBin, ['--remote-debugging-port=0', '.'], {
    cwd: root,
    env: testEnv(userData),
    stdio: 'ignore',
    windowsHide: true
  });

  let browser;
  try {
    const port = await waitForDevToolsPort(userData, child);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);

    const bubble = await findPage(browser, 'bubble');
    const panel = await findPage(browser, 'panel');

    await bubble.waitForSelector('.bubble-view', { state: 'visible', timeout: 10000 });
    const bubbleLabel = await bubble.locator('.bubble-view').getAttribute('aria-label');
    assert.match(bubbleLabel || '', /今日剩余/);

    await bubble.evaluate(() => window.floatingApi.togglePanel());
    await panel.waitForSelector('.panel-shell.is-visible', { state: 'attached', timeout: 10000 });
    await panel.locator('[aria-label="设置"]').click();
    await panel.waitForSelector('.settings-panel', { state: 'visible', timeout: 10000 });
    await panel.locator('input[type="password"]').fill('Bearer smoke-token');
    await panel.locator('.switch-control').first().click();
    await panel.locator('[aria-label="关闭设置"]').click();
    await panel.waitForSelector('.settings-panel', { state: 'detached', timeout: 10000 });

    await bubble.evaluate(() => window.floatingApi.resetPlacement());
    await bubble.evaluate(() => window.floatingApi.hidePanel());
    await panel.waitForSelector('.panel-shell.is-visible', { state: 'detached', timeout: 10000 });
  } finally {
    await browser?.close().catch(() => {});
    child.kill();
    await delay(500);
    removeDirSoon(userData);
  }

  console.log('Electron smoke tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
