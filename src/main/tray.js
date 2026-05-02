const { Menu, Tray, nativeImage, shell } = require('electron');
const { assetPath } = require('./assets');
const { refreshData } = require('./data-service');
const { copyDiagnostics } = require('./diagnostics');
const { logInfo, logsDirectory } = require('./logger');
const { readSettings, settingsDirectory } = require('./settings');
const {
  getBubbleWindow,
  getPanelWindow,
  hideBubbleAndPanel,
  resetBubblePlacement,
  showBubble,
  showPanel,
  togglePanel
} = require('./windows');

let tray;

function quitApp() {
  global.isQuitting = true;
  logInfo('app:quit-requested');
  require('electron').app.quit();
}

function createTrayIcon() {
  return nativeImage.createFromPath(assetPath('logo2.png')).resize({ width: 16, height: 16 });
}

function sendRefresh() {
  void refreshData();
}

function openLogs() {
  void shell.openPath(logsDirectory());
}

function openSettingsDirectory() {
  void shell.openPath(settingsDirectory());
}

function copyDiagnosticsToClipboard() {
  void copyDiagnostics();
}

function buildContextMenuTemplate(setAlwaysOnTop) {
  return [
    {
      label: '打开/关闭面板',
      click: () => {
        showBubble();
        togglePanel();
      }
    },
    {
      label: '刷新数据',
      click: sendRefresh
    },
    {
      label: '设置 Token',
      click: () => {
        showBubble();
        showPanel();
        getPanelWindow()?.webContents.send('open-settings');
      }
    },
    {
      label: '重置悬浮球位置',
      click: () => {
        showBubble();
        void resetBubblePlacement();
      }
    },
    {
      label: '打开日志目录',
      click: openLogs
    },
    {
      label: '复制诊断信息',
      click: copyDiagnosticsToClipboard
    },
    { type: 'separator' },
    {
      label: '隐藏悬浮球',
      click: hideBubbleAndPanel
    },
    {
      label: '退出',
      click: quitApp
    }
  ];
}

function showBubbleContextMenu(setAlwaysOnTop) {
  const menu = Menu.buildFromTemplate(buildContextMenuTemplate(setAlwaysOnTop));
  menu.popup({ window: getBubbleWindow() });
}

async function refreshTrayMenu(setAlwaysOnTop) {
  if (!tray) return;
  const settings = await readSettings();
  const alwaysOnTop = settings.alwaysOnTop !== false;

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '显示/隐藏悬浮球',
        click: () => {
          const bubbleWindow = getBubbleWindow();
          if (!bubbleWindow) return;
          bubbleWindow.isVisible() ? hideBubbleAndPanel() : showBubble();
        }
      },
      {
        label: '打开/关闭面板',
        click: () => {
          showBubble();
          togglePanel();
        }
      },
      {
        label: '刷新数据',
        click: sendRefresh
      },
      {
        label: alwaysOnTop ? '取消置顶' : '窗口置顶',
        click: async () => {
          await setAlwaysOnTop(!alwaysOnTop);
          getBubbleWindow()?.webContents.send('settings-changed');
          getPanelWindow()?.webContents.send('settings-changed');
        }
      },
      {
        label: '设置 Token',
        click: () => {
          showBubble();
          showPanel();
          getPanelWindow()?.webContents.send('open-settings');
        }
      },
      {
        label: '重置悬浮球位置',
        click: () => {
          showBubble();
          void resetBubblePlacement();
        }
      },
      {
        label: '打开日志目录',
        click: openLogs
      },
      {
        label: '打开配置目录',
        click: openSettingsDirectory
      },
      {
        label: '复制诊断信息',
        click: copyDiagnosticsToClipboard
      },
      { type: 'separator' },
      {
        label: '退出',
        click: quitApp
      }
    ])
  );
}

function buildTray(setAlwaysOnTop) {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Codex 用量');
  refreshTrayMenu(setAlwaysOnTop);

  tray.on('click', () => {
    showBubble();
    togglePanel();
  });
}

function destroyTray() {
  if (!tray) return;
  tray.destroy();
  tray = null;
}

module.exports = {
  buildTray,
  destroyTray,
  refreshTrayMenu,
  showBubbleContextMenu
};
