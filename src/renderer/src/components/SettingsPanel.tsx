import * as Dialog from '@kobalte/core/dialog';
import { createEffect, createSignal } from 'solid-js';
import type { Settings } from '../types';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { MaintenanceActions } from './MaintenanceActions';
import { SettingSwitch } from './SettingSwitch';

export function SettingsPanel(props: {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onSave: (
    token: string,
    refreshSeconds: number,
    alwaysOnTop: boolean,
    panelLightDismiss: boolean,
    launchAtLogin: boolean
  ) => void | Promise<void>;
  onClearToken: () => void | Promise<void>;
  onCopyDiagnostics: () => void | Promise<void>;
}) {
  const [token, setToken] = createSignal('');
  const [refreshSeconds, setRefreshSeconds] = createSignal(60);
  const [alwaysOnTop, setAlwaysOnTop] = createSignal(true);
  const [panelLightDismiss, setPanelLightDismiss] = createSignal(true);
  const [launchAtLogin, setLaunchAtLogin] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  let tokenInput!: HTMLInputElement;

  createEffect(() => {
    if (props.open) {
      setToken('');
      setRefreshSeconds(props.settings.refreshSeconds);
      setAlwaysOnTop(props.settings.alwaysOnTop);
      setPanelLightDismiss(props.settings.panelLightDismiss);
      setLaunchAtLogin(props.settings.launchAtLogin);
      requestAnimationFrame(() => tokenInput?.focus());
    }
  });

  async function handleSave(event?: SubmitEvent) {
    event?.preventDefault();
    if (saving()) return;

    setSaving(true);
    try {
      await props.onSave(
        token(),
        refreshSeconds(),
        alwaysOnTop(),
        panelLightDismiss(),
        launchAtLogin()
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleClearToken() {
    await props.onClearToken();
    setToken('');
  }

  return (
    <Dialog.Root open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay class="settings-overlay" />
        <Dialog.Content class="settings-panel" onOpenAutoFocus={(event) => event.preventDefault()}>
          <form onSubmit={handleSave}>
            <div class="panel-head">
              <div>
                <Dialog.Title class="settings-title">接口设置</Dialog.Title>
                <Dialog.Description class="settings-description">
                  管理 Token、刷新策略和桌面行为。
                </Dialog.Description>
              </div>
              <IconButton label="关闭设置" icon="close" onClick={props.onClose} />
            </div>

            <label class="field">
              <span>Bearer Token</span>
              <input
                ref={tokenInput}
                type="password"
                autocomplete="off"
                placeholder="留空表示沿用当前 Token"
                value={token()}
                onInput={(event) => setToken(event.currentTarget.value)}
              />
            </label>

            <label class="field compact-field">
              <span>刷新间隔</span>
              <input
                type="number"
                min="15"
                max="3600"
                step="15"
                value={refreshSeconds()}
                onInput={(event) => setRefreshSeconds(Number(event.currentTarget.value) || 60)}
              />
              <span>秒</span>
            </label>

            <SettingSwitch
              label="窗口置顶"
              description="保持悬浮窗和面板在其他窗口上方。"
              checked={alwaysOnTop()}
              onChange={setAlwaysOnTop}
            />
            <SettingSwitch
              label="点击外部关闭面板"
              description="面板失去焦点时自动收起。"
              checked={panelLightDismiss()}
              onChange={setPanelLightDismiss}
            />
            <SettingSwitch
              label="开机自动启动"
              description="登录 Windows 后自动启动监控。"
              checked={launchAtLogin()}
              onChange={setLaunchAtLogin}
            />

            <div class="setting-status">
              {props.settings.tokenSource === 'env'
                ? 'Token 来自环境变量'
                : props.settings.tokenSource === 'saved'
                  ? props.settings.tokenStorage === 'safeStorage'
                    ? 'Token 已加密保存在本机'
                    : 'Token 已保存（当前系统未启用加密）'
                  : 'Token 未配置'}
            </div>

            <MaintenanceActions onCopyDiagnostics={props.onCopyDiagnostics} />

            <div class="panel-actions">
              <button class="secondary-button danger-button" type="button" onClick={handleClearToken}>
                <Icon name="trash" />
                清除 Token
              </button>
              <button class="primary-button" type="submit" disabled={saving()}>
                <Icon name="check" />
                {saving() ? '保存中' : '保存并刷新'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
