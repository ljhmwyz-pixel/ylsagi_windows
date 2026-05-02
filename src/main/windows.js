const { BrowserWindow, screen } = require('electron');
const path = require('node:path');
const { assetPath } = require('./assets');
const { animateBounds, stopBoundsAnimation } = require('./bounds-animation');
const { BUBBLE_SIZE, PANEL_MAX_HEIGHT, PANEL_MIN_HEIGHT, PANEL_SIZE } = require('./constants');
const {
  dockPreviewForBubble,
  isNearAnyEdge,
  dockBoundsForEdge,
  initialBubbleBounds,
  panelBoundsForBubble,
  resolveBubbleRelease,
  clampBubbleBounds,
  clampDockedBubbleBounds,
  undockedBoundsFromDock,
  visibleAnchorFromDock
} = require('./geometry');
const { logError, logWarn } = require('./logger');
const { updateSettings } = require('./settings');

let bubbleWindow;
let panelWindow;
let saveBubbleTimer;
let panelHideTimer;
let panelState = 'hidden';
let panelLightDismiss = true;
let preferredPanelHeight = PANEL_SIZE.height;
let lastPanelBlurHideAt = 0;
let dockedEdge = null;
let dockedHiddenBounds = null;
let contextMenuHandler = null;
let dragSession = null;
let lastDockPreview = { active: false, edge: null };
let displayRecoveryTimer = null;

function getBubbleWindow() {
  return bubbleWindow;
}

function getPanelWindow() {
  return panelWindow;
}

function isPanelOpen() {
  return panelState === 'showing' || panelState === 'visible';
}

function setPanelLightDismiss(value) {
  panelLightDismiss = value !== false;
}

function makeWindow(options) {
  const transparent = options.transparent !== false;
  const win = new BrowserWindow({
    frame: false,
    transparent,
    resizable: false,
    maximizable: false,
    minimizable: false,
    alwaysOnTop: options.alwaysOnTop,
    skipTaskbar: true,
    focusable: options.focusable !== false,
    hasShadow: options.hasShadow !== false,
    backgroundColor: options.backgroundColor ?? (transparent ? '#00000000' : '#0b0f10'),
    paintWhenInitiallyHidden: true,
    show: options.show,
    width: options.width,
    height: options.height,
    minWidth: options.minWidth ?? options.width,
    minHeight: options.minHeight ?? options.height,
    maxWidth: options.maxWidth ?? options.width,
    maxHeight: options.maxHeight ?? options.height,
    x: options.x,
    y: options.y,
    icon: assetPath('logo2.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload.js'),
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    logError('window:render-process-gone', details);
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logError('window:did-fail-load', { errorCode, errorDescription, validatedURL });
  });

  win.webContents.on('unresponsive', () => {
    logWarn('window:unresponsive');
  });

  return win;
}

async function loadRenderer(win, mode) {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await win.loadURL(`${devUrl}?mode=${mode}`);
    return;
  }

  await win.loadFile(path.join(__dirname, '..', '..', 'renderer-dist', 'index.html'), {
    query: { mode }
  });
}

function setAlwaysOnTopForWindows(value) {
  for (const win of [bubbleWindow, panelWindow]) {
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(Boolean(value), Boolean(value) ? 'screen-saver' : 'normal');
    }
  }
}

async function createWindows(settings) {
  const alwaysOnTop = settings.alwaysOnTop !== false;
  setPanelLightDismiss(settings.panelLightDismiss);
  dockedEdge = settings.bubbleDockedEdge || null;
  const visibleBubbleBounds = initialBubbleBounds(settings);
  const bubbleBounds = dockedEdge
    ? dockBoundsForEdge(visibleBubbleBounds, dockedEdge)
    : visibleBubbleBounds;
  dockedHiddenBounds = dockedEdge ? bubbleBounds : null;

  bubbleWindow = makeWindow({
    ...bubbleBounds,
    ...BUBBLE_SIZE,
    alwaysOnTop,
    transparent: true,
    backgroundColor: '#00000000',
    focusable: false,
    hasShadow: false,
    show: true
  });
  setAlwaysOnTopForWindows(alwaysOnTop);
  await loadRenderer(bubbleWindow, 'bubble');

  const initialPanelBounds = panelBoundsForBubble(bubbleWindow.getBounds(), preferredPanelHeight).bounds;
  panelWindow = makeWindow({
    ...initialPanelBounds,
    alwaysOnTop,
    hasShadow: true,
    minWidth: PANEL_SIZE.width,
    maxWidth: PANEL_SIZE.width,
    minHeight: PANEL_MIN_HEIGHT,
    maxHeight: PANEL_MAX_HEIGHT,
    show: false
  });
  setAlwaysOnTopForWindows(alwaysOnTop);
  await loadRenderer(panelWindow, 'panel');

  panelWindow.on('blur', () => {
    if (panelLightDismiss && isPanelOpen()) {
      hidePanel('blur');
    }
  });

  for (const win of [bubbleWindow, panelWindow]) {
    win.on('close', (event) => {
      if (!global.isQuitting) {
        event.preventDefault();
        hidePanel();
        bubbleWindow?.hide();
      }
    });
  }
}

function scheduleDisplayRecovery() {
  clearTimeout(displayRecoveryTimer);
  displayRecoveryTimer = setTimeout(() => {
    recoverWindowPositions();
  }, 180);
}

function registerDisplayRecoveryHandlers() {
  for (const eventName of ['display-added', 'display-removed', 'display-metrics-changed']) {
    screen.on(eventName, scheduleDisplayRecovery);
  }
}

function unregisterDisplayRecoveryHandlers() {
  clearTimeout(displayRecoveryTimer);
  for (const eventName of ['display-added', 'display-removed', 'display-metrics-changed']) {
    screen.removeListener(eventName, scheduleDisplayRecovery);
  }
}

function currentVisibleBubbleBounds() {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return null;
  const current = bubbleWindow.getBounds();
  return dockedEdge ? visibleAnchorFromDock(current, dockedEdge) : clampBubbleBounds(current);
}

function persistBubblePlacementSoon() {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return;
  clearTimeout(saveBubbleTimer);
  saveBubbleTimer = setTimeout(async () => {
    if (!bubbleWindow || bubbleWindow.isDestroyed()) return;
    const anchor = currentVisibleBubbleBounds();
    if (!anchor) return;
    await updateSettings((settings) => {
      settings.bubbleBounds = anchor;
      settings.bubbleDockedEdge = dockedEdge || null;
      return settings;
    });
  }, 200);
}

function recoverWindowPositions() {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return;
  const anchor = currentVisibleBubbleBounds() || initialBubbleBounds({});
  const fixedAnchor = clampBubbleBounds(anchor);
  const nextBubbleBounds = dockedEdge ? dockBoundsForEdge(fixedAnchor, dockedEdge) : fixedAnchor;

  dockedHiddenBounds = dockedEdge ? nextBubbleBounds : null;
  animateBounds(bubbleWindow, nextBubbleBounds, { duration: 180 });
  syncPanelToBubble(false);
  persistBubblePlacementSoon();
}

async function resetBubblePlacement() {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return { ok: false };
  dockedEdge = null;
  dockedHiddenBounds = null;
  dragSession = null;
  sendDockPreview({ active: false, edge: null });
  const bounds = initialBubbleBounds({});
  animateBounds(bubbleWindow, bounds, { duration: 220 });
  syncPanelToBubble(true);
  await updateSettings((settings) => {
    settings.bubbleBounds = bounds;
    settings.bubbleDockedEdge = null;
    return settings;
  });
  return { ok: true };
}

function saveBubbleBoundsSoon() {
  persistBubblePlacementSoon();
}

function sendDockPreview(preview) {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return;
  const next = preview || { active: false, edge: null };
  if (next.active === lastDockPreview.active && next.edge === lastDockPreview.edge) return;
  lastDockPreview = { active: Boolean(next.active), edge: next.edge || null };
  bubbleWindow.webContents.send('bubble-dock-preview', lastDockPreview);
}

function sendPanelLayout(layout) {
  if (!panelWindow || panelWindow.isDestroyed()) return;
  panelWindow.webContents.send('panel-layout', layout);
}

function syncPanelToBubble(animated = false) {
  if (!panelWindow || !bubbleWindow || panelWindow.isDestroyed() || bubbleWindow.isDestroyed()) return;
  if (!isPanelOpen()) return;
  const next = panelBoundsForBubble(bubbleWindow.getBounds(), preferredPanelHeight);
  panelWindow.setBounds(next.bounds, animated);
  sendPanelLayout(next.layout);
}

function beginBubbleDrag() {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return { ok: false };
  stopBoundsAnimation(bubbleWindow);
  const current = bubbleWindow.getBounds();
  const wasDocked = Boolean(dockedEdge);
  const startBounds = wasDocked ? clampDockedBubbleBounds(current) : clampBubbleBounds(current);
  dockedEdge = null;
  dockedHiddenBounds = null;
  dragSession = {
    x: startBounds.x,
    y: startBounds.y,
    allowPartial: wasDocked
  };
  bubbleWindow.setBounds(startBounds, false);
  syncPanelToBubble(false);
  sendDockPreview(dockPreviewForBubble(startBounds));
  return { ok: true };
}

function moveBubbleBy(dx, dy) {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return;
  stopBoundsAnimation(bubbleWindow);
  if (!dragSession) {
    const current = bubbleWindow.getBounds();
    const wasDocked = Boolean(dockedEdge);
    const startBounds = wasDocked ? clampDockedBubbleBounds(current) : clampBubbleBounds(current);
    dragSession = { x: startBounds.x, y: startBounds.y, allowPartial: wasDocked };
    bubbleWindow.setBounds(startBounds, false);
  }
  dockedEdge = null;
  dockedHiddenBounds = null;
  const current = dragSession;
  const next = (dragSession.allowPartial ? clampDockedBubbleBounds : clampBubbleBounds)({
    x: current.x + dx,
    y: current.y + dy,
    ...BUBBLE_SIZE
  });
  if (dragSession) {
    dragSession.x = next.x;
    dragSession.y = next.y;
  }
  bubbleWindow.setBounds(next, false);
  syncPanelToBubble(false);
  sendDockPreview(dockPreviewForBubble(next));
}

async function snapBubbleToEdge() {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return;
  dragSession = null;
  sendDockPreview({ active: false, edge: null });
  const current = bubbleWindow.getBounds();
  if (!isNearAnyEdge(current)) {
    dockedEdge = null;
    dockedHiddenBounds = null;
    await updateSettings((settings) => {
      settings.bubbleBounds = clampBubbleBounds(current);
      settings.bubbleDockedEdge = null;
      return settings;
    });
    return;
  }

  const result = resolveBubbleRelease(current);
  animateBounds(bubbleWindow, result.bounds, {
    duration: 210,
    onDone: () => syncPanelToBubble(false)
  });
  dockedEdge = result.docked ? result.edge : null;
  dockedHiddenBounds = result.docked ? result.bounds : null;
  const anchor = result.docked ? visibleAnchorFromDock(result.bounds, result.edge) : result.bounds;

  await updateSettings((settings) => {
    settings.bubbleBounds = anchor;
    settings.bubbleDockedEdge = dockedEdge;
    return settings;
  });
}

function revealDockedBubble() {
  if (!bubbleWindow || bubbleWindow.isDestroyed() || !dockedEdge) return;
  const current = bubbleWindow.getBounds();
  dockedHiddenBounds = dockedHiddenBounds || current;
  animateBounds(bubbleWindow, undockedBoundsFromDock(current, dockedEdge), {
    duration: 180,
    onDone: () => syncPanelToBubble(false)
  });
}

function hideDockedBubble() {
  if (!bubbleWindow || bubbleWindow.isDestroyed() || !dockedEdge) return;
  const current = bubbleWindow.getBounds();
  const next = dockedHiddenBounds || dockBoundsForEdge(current, dockedEdge);
  animateBounds(bubbleWindow, next, {
    duration: 220,
    onDone: () => syncPanelToBubble(false)
  });
}

function showPanel() {
  if (!panelWindow || !bubbleWindow || panelWindow.isDestroyed() || bubbleWindow.isDestroyed()) return;
  clearTimeout(panelHideTimer);
  panelState = 'showing';
  const next = panelBoundsForBubble(bubbleWindow.getBounds(), preferredPanelHeight);
  panelWindow.setBounds(next.bounds, false);
  panelWindow.showInactive();
  sendPanelLayout(next.layout);
  panelWindow.webContents.send('panel-visibility', true);
  panelWindow.focus();
  setTimeout(() => {
    if (panelState === 'showing') {
      panelState = 'visible';
    }
  }, 0);
}

function resizePanelToContent(height) {
  if (!panelWindow || !bubbleWindow || panelWindow.isDestroyed() || bubbleWindow.isDestroyed()) {
    return { ok: false };
  }
  const nextHeight = Number(height);
  if (!Number.isFinite(nextHeight)) return { ok: false };
  preferredPanelHeight = nextHeight;
  if (!isPanelOpen()) return { ok: true };
  const next = panelBoundsForBubble(bubbleWindow.getBounds(), preferredPanelHeight);
  panelWindow.setBounds(next.bounds, false);
  sendPanelLayout(next.layout);
  return { ok: true };
}

function hidePanel(reason = 'manual') {
  if (!panelWindow || panelWindow.isDestroyed()) return;
  if (panelState === 'hidden') return;
  if (reason === 'blur') {
    lastPanelBlurHideAt = Date.now();
  }
  clearTimeout(panelHideTimer);
  panelState = 'hiding';
  panelWindow.webContents.send('panel-visibility', false);
  panelHideTimer = setTimeout(() => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.hide();
    }
    if (panelState === 'hiding') {
      panelState = 'hidden';
    }
  }, 160);
}

function togglePanel() {
  if (!panelWindow || panelWindow.isDestroyed()) return;
  if (panelState === 'hiding' && Date.now() - lastPanelBlurHideAt < 120) {
    return;
  }
  isPanelOpen() ? hidePanel() : showPanel();
}

function showBubble() {
  bubbleWindow?.show();
}

function hideBubbleAndPanel() {
  hidePanel();
  bubbleWindow?.hide();
}

function setContextMenuHandler(handler) {
  contextMenuHandler = handler;
}

function showBubbleContextMenu() {
  if (typeof contextMenuHandler === 'function') {
    contextMenuHandler();
  }
}

module.exports = {
  createWindows,
  getBubbleWindow,
  getPanelWindow,
  setAlwaysOnTopForWindows,
  setPanelLightDismiss,
  registerDisplayRecoveryHandlers,
  unregisterDisplayRecoveryHandlers,
  recoverWindowPositions,
  resetBubblePlacement,
  beginBubbleDrag,
  moveBubbleBy,
  snapBubbleToEdge,
  revealDockedBubble,
  hideDockedBubble,
  showPanel,
  hidePanel,
  togglePanel,
  resizePanelToContent,
  showBubble,
  hideBubbleAndPanel,
  setContextMenuHandler,
  showBubbleContextMenu
};
